const bcrypt = require('bcrypt');
const { pool, withTransaction } = require('../config/db');
const { AppError } = require('../middlewares/error.middleware');
const { BCRYPT_ROUNDS } = require('./auth.service');
const { normalizeTime, timeToMinutes } = require('../utils/timeSlots');

const ALLOWED_ROLES = ['PATIENT', 'RECEPTIONIST', 'DOCTOR', 'ADMIN'];

async function listUsers({ role, search } = {}) {
  const params = [];
  const conditions = [];

  if (role && ALLOWED_ROLES.includes(role)) {
    conditions.push('u.role = ?');
    params.push(role);
  }
  if (search && String(search).trim()) {
    const like = `%${String(search).trim()}%`;
    conditions.push('(u.full_name LIKE ? OR u.email LIKE ? OR u.phone LIKE ?)');
    params.push(like, like, like);
  }

  const whereClause = conditions.length ? `WHERE ${conditions.join(' AND ')}` : '';

  const [rows] = await pool.query(
    `SELECT u.id, u.full_name, u.email, u.phone, u.role, u.is_active, u.created_at,
            d.id AS doctor_id, d.specialization_id, s.name AS specialization_name,
            d.cabinet_number, d.consultation_price, d.bio
     FROM users u
     LEFT JOIN doctors d ON d.user_id = u.id
     LEFT JOIN specializations s ON s.id = d.specialization_id
     ${whereClause}
     ORDER BY u.role ASC, u.full_name ASC`,
    params
  );

  return rows.map((r) => ({
    ...r,
    is_active: Boolean(r.is_active),
    consultation_price: r.consultation_price !== null ? Number(r.consultation_price) : null
  }));
}

async function createUser({
  full_name,
  email,
  password,
  phone,
  role,
  specialization_id,
  cabinet_number,
  consultation_price,
  bio,
  schedules
}) {
  if (!ALLOWED_ROLES.includes(role)) {
    throw new AppError(400, 'Rol de utilizator invalid.');
  }

  const normalizedEmail = String(email).trim().toLowerCase();

  return withTransaction(async (connection) => {
    const [existing] = await connection.query('SELECT id FROM users WHERE email = ? LIMIT 1', [
      normalizedEmail
    ]);
    if (existing.length) {
      throw new AppError(409, 'Există deja un utilizator cu această adresă de email.');
    }

    const passwordHash = await bcrypt.hash(password, BCRYPT_ROUNDS);
    const [userRes] = await connection.query(
      `INSERT INTO users (full_name, email, password_hash, phone, role, is_active)
       VALUES (?, ?, ?, ?, ?, 1)`,
      [full_name.trim(), normalizedEmail, passwordHash, phone ? phone.trim() : null, role]
    );

    const userId = userRes.insertId;
    let doctorId = null;

    if (role === 'DOCTOR') {
      if (!specialization_id || !cabinet_number) {
        throw new AppError(
          400,
          'Pentru un cont de medic sunt obligatorii specializarea și numărul cabinetului.'
        );
      }

      const [docRes] = await connection.query(
        `INSERT INTO doctors (user_id, specialization_id, cabinet_number, consultation_price, bio)
         VALUES (?, ?, ?, ?, ?)`,
        [
          userId,
          Number(specialization_id),
          String(cabinet_number).trim(),
          Number(consultation_price || 200),
          bio ? String(bio).trim() : null
        ]
      );
      doctorId = docRes.insertId;

      // Default Mon-Fri 09:00-17:00 schedule if none supplied
      const schedList =
        Array.isArray(schedules) && schedules.length > 0
          ? schedules
          : [1, 2, 3, 4, 5].map((day) => ({
              day_of_week: day,
              start_time: '09:00:00',
              end_time: '17:00:00',
              slot_duration_minutes: 30
            }));

      for (const s of schedList) {
        await insertDoctorScheduleRow(connection, doctorId, s);
      }
    }

    return {
      id: userId,
      full_name: full_name.trim(),
      email: normalizedEmail,
      phone: phone ? phone.trim() : null,
      role,
      is_active: true,
      doctor_id: doctorId
    };
  });
}

async function insertDoctorScheduleRow(connection, doctorId, sched) {
  const day = Number(sched.day_of_week);
  if (day < 1 || day > 5) {
    throw new AppError(400, 'Ziua săptămânii trebuie să fie între 1 (Luni) și 5 (Vineri).');
  }
  const start = normalizeTime(sched.start_time);
  const end = normalizeTime(sched.end_time);
  if (!start || !end || timeToMinutes(end) <= timeToMinutes(start)) {
    throw new AppError(400, 'Intervalul orar de lucru este invalid (ora de sfârșit trebuie să fie după ora de început).');
  }
  const duration = Number(sched.slot_duration_minutes || 30);
  if (duration < 10 || duration > 120) {
    throw new AppError(400, 'Durata unui slot trebuie să fie între 10 și 120 de minute.');
  }

  await connection.query(
    `INSERT INTO doctor_schedules (doctor_id, day_of_week, start_time, end_time, slot_duration_minutes)
     VALUES (?, ?, ?, ?, ?)`,
    [doctorId, day, start, end, duration]
  );
}

async function updateUser(userId, updates, currentAdminId) {
  return withTransaction(async (connection) => {
    const [rows] = await connection.query(
      `SELECT u.id, u.full_name, u.email, u.phone, u.role, u.is_active, d.id AS doctor_id
       FROM users u
       LEFT JOIN doctors d ON d.user_id = u.id
       WHERE u.id = ?
       LIMIT 1`,
      [Number(userId)]
    );
    if (!rows.length) {
      throw new AppError(404, 'Utilizatorul nu a fost găsit.');
    }

    const existing = rows[0];
    if (Number(userId) === currentAdminId && updates.is_active === false) {
      throw new AppError(400, 'Nu vă puteți dezactiva propriul cont de administrator.');
    }

    let passwordSql = '';
    const params = [
      updates.full_name !== undefined ? String(updates.full_name).trim() : existing.full_name,
      updates.phone !== undefined ? (updates.phone ? String(updates.phone).trim() : null) : existing.phone,
      updates.is_active !== undefined ? (updates.is_active ? 1 : 0) : existing.is_active
    ];

    if (updates.password && String(updates.password).trim().length >= 6) {
      const hash = await bcrypt.hash(String(updates.password), BCRYPT_ROUNDS);
      passwordSql = ', password_hash = ?';
      params.push(hash);
    }

    params.push(Number(userId));

    await connection.query(
      `UPDATE users SET full_name = ?, phone = ?, is_active = ? ${passwordSql} WHERE id = ?`,
      params
    );

    if (existing.doctor_id) {
      await connection.query(
        `UPDATE doctors
         SET specialization_id = COALESCE(?, specialization_id),
             cabinet_number = COALESCE(?, cabinet_number),
             consultation_price = COALESCE(?, consultation_price),
             bio = COALESCE(?, bio)
         WHERE id = ?`,
        [
          updates.specialization_id ? Number(updates.specialization_id) : null,
          updates.cabinet_number ? String(updates.cabinet_number).trim() : null,
          updates.consultation_price !== undefined ? Number(updates.consultation_price) : null,
          updates.bio !== undefined ? String(updates.bio).trim() : null,
          existing.doctor_id
        ]
      );
    }

    const [updated] = await connection.query(
      `SELECT u.id, u.full_name, u.email, u.phone, u.role, u.is_active,
              d.id AS doctor_id, d.specialization_id, d.cabinet_number, d.consultation_price, d.bio
       FROM users u
       LEFT JOIN doctors d ON d.user_id = u.id
       WHERE u.id = ?`,
      [Number(userId)]
    );

    return {
      ...updated[0],
      is_active: Boolean(updated[0].is_active),
      consultation_price:
        updated[0].consultation_price !== null ? Number(updated[0].consultation_price) : null
    };
  });
}

async function updateDoctorSchedules(doctorId, schedules) {
  if (!Array.isArray(schedules)) {
    throw new AppError(400, 'Lista de orare trebuie să fie un array.');
  }

  return withTransaction(async (connection) => {
    const [docRows] = await connection.query('SELECT id FROM doctors WHERE id = ? LIMIT 1', [
      Number(doctorId)
    ]);
    if (!docRows.length) {
      throw new AppError(404, 'Medicul nu a fost găsit.');
    }

    await connection.query('DELETE FROM doctor_schedules WHERE doctor_id = ?', [Number(doctorId)]);

    for (const s of schedules) {
      await insertDoctorScheduleRow(connection, Number(doctorId), s);
    }

    const [updated] = await connection.query(
      `SELECT id, doctor_id, day_of_week, start_time, end_time, slot_duration_minutes
       FROM doctor_schedules
       WHERE doctor_id = ?
       ORDER BY day_of_week ASC`,
      [Number(doctorId)]
    );

    return updated;
  });
}

async function createSpecialization({ name, description }) {
  const [result] = await pool.query(
    'INSERT INTO specializations (name, description) VALUES (?, ?)',
    [String(name).trim(), description ? String(description).trim() : null]
  );
  return {
    id: result.insertId,
    name: String(name).trim(),
    description: description ? String(description).trim() : null
  };
}

async function updateSpecialization(id, { name, description }) {
  const [existing] = await pool.query('SELECT id FROM specializations WHERE id = ? LIMIT 1', [
    Number(id)
  ]);
  if (!existing.length) {
    throw new AppError(404, 'Specializarea nu a fost găsită.');
  }
  await pool.query(
    'UPDATE specializations SET name = ?, description = ? WHERE id = ?',
    [String(name).trim(), description ? String(description).trim() : null, Number(id)]
  );
  return {
    id: Number(id),
    name: String(name).trim(),
    description: description ? String(description).trim() : null
  };
}

async function deleteSpecialization(id) {
  const [docs] = await pool.query(
    'SELECT id FROM doctors WHERE specialization_id = ? LIMIT 1',
    [Number(id)]
  );
  if (docs.length) {
    throw new AppError(
      409,
      'Specializarea nu poate fi ștearsă deoarece are medici asociați.'
    );
  }
  const [res] = await pool.query('DELETE FROM specializations WHERE id = ?', [Number(id)]);
  if (!res.affectedRows) {
    throw new AppError(404, 'Specializarea nu a fost găsită.');
  }
}

async function getAdminReports({ from_date, to_date } = {}) {
  const params = [];
  const conditions = [];

  if (from_date) {
    conditions.push('a.appointment_date >= ?');
    params.push(from_date);
  }
  if (to_date) {
    conditions.push('a.appointment_date <= ?');
    params.push(to_date);
  }

  const whereClause = conditions.length ? `WHERE ${conditions.join(' AND ')}` : '';
  const joinFilter = conditions.length ? `AND ${conditions.join(' AND ')}` : '';

  // 1. Summary KPIs
  const [summaryRows] = await pool.query(
    `SELECT
       COUNT(*) AS total_appointments,
       SUM(CASE WHEN a.status = 'PENDING' THEN 1 ELSE 0 END) AS pending_count,
       SUM(CASE WHEN a.status = 'CONFIRMED' THEN 1 ELSE 0 END) AS confirmed_count,
       SUM(CASE WHEN a.status = 'COMPLETED' THEN 1 ELSE 0 END) AS completed_count,
       SUM(CASE WHEN a.status = 'CANCELLED' THEN 1 ELSE 0 END) AS cancelled_count,
       COALESCE(SUM(CASE WHEN a.payment_status = 'PAID_AT_RECEPTION' AND a.status <> 'CANCELLED' THEN d.consultation_price ELSE 0 END), 0) AS total_revenue_paid,
       COALESCE(SUM(CASE WHEN a.payment_status = 'UNPAID' AND a.status <> 'CANCELLED' THEN d.consultation_price ELSE 0 END), 0) AS total_revenue_unpaid,
       COUNT(CASE WHEN a.payment_status = 'PAID_AT_RECEPTION' AND a.status <> 'CANCELLED' THEN 1 END) AS paid_appointments_count
     FROM appointments a
     INNER JOIN doctors d ON d.id = a.doctor_id
     ${whereClause}`,
    params
  );

  const s = summaryRows[0];
  const total = Number(s.total_appointments || 0);
  const confirmedAndCompleted = Number(s.confirmed_count || 0) + Number(s.completed_count || 0);
  const cancelled = Number(s.cancelled_count || 0);

  const summary = {
    total_appointments: total,
    pending_count: Number(s.pending_count || 0),
    confirmed_count: Number(s.confirmed_count || 0),
    completed_count: Number(s.completed_count || 0),
    cancelled_count: cancelled,
    confirmation_rate: total > 0 ? Number(((confirmedAndCompleted / total) * 100).toFixed(1)) : 0,
    cancellation_rate: total > 0 ? Number(((cancelled / total) * 100).toFixed(1)) : 0,
    paid_appointments_count: Number(s.paid_appointments_count || 0),
    total_revenue_paid: Number(s.total_revenue_paid || 0),
    total_revenue_unpaid: Number(s.total_revenue_unpaid || 0)
  };

  // 2. Per-doctor stats & weekly slot capacity
  const [doctorRows] = await pool.query(
    `SELECT
       d.id AS doctor_id,
       u.full_name AS doctor_name,
       sp.name AS specialization_name,
       d.cabinet_number,
       d.consultation_price,
       COUNT(a.id) AS total_appointments,
       SUM(CASE WHEN a.status IN ('CONFIRMED', 'COMPLETED') THEN 1 ELSE 0 END) AS active_confirmed,
       SUM(CASE WHEN a.status = 'CANCELLED' THEN 1 ELSE 0 END) AS cancelled_count,
       COALESCE(SUM(CASE WHEN a.payment_status = 'PAID_AT_RECEPTION' AND a.status <> 'CANCELLED' THEN d.consultation_price ELSE 0 END), 0) AS paid_revenue,
       (SELECT COALESCE(SUM(FLOOR(TIME_TO_SEC(TIMEDIFF(ds.end_time, ds.start_time)) / (ds.slot_duration_minutes * 60))), 0)
        FROM doctor_schedules ds WHERE ds.doctor_id = d.id) AS weekly_capacity_slots
     FROM doctors d
     INNER JOIN users u ON u.id = d.user_id
     INNER JOIN specializations sp ON sp.id = d.specialization_id
     LEFT JOIN appointments a ON a.doctor_id = d.id ${joinFilter}
     GROUP BY d.id, u.full_name, sp.name, d.cabinet_number, d.consultation_price
     ORDER BY total_appointments DESC, u.full_name ASC`,
    params
  );

  const by_doctor = doctorRows.map((row) => {
    const activeNonCancelled = Number(row.total_appointments || 0) - Number(row.cancelled_count || 0);
    const weeklyCap = Number(row.weekly_capacity_slots || 0);
    const occupancyRate =
      weeklyCap > 0 ? Math.min(100, Number(((activeNonCancelled / weeklyCap) * 100).toFixed(1))) : 0;
    return {
      doctor_id: row.doctor_id,
      doctor_name: row.doctor_name,
      specialization_name: row.specialization_name,
      cabinet_number: row.cabinet_number,
      consultation_price: Number(row.consultation_price),
      total_appointments: Number(row.total_appointments || 0),
      active_confirmed: Number(row.active_confirmed || 0),
      cancelled_count: Number(row.cancelled_count || 0),
      paid_revenue: Number(row.paid_revenue || 0),
      weekly_capacity_slots: weeklyCap,
      occupancy_rate: occupancyRate
    };
  });

  // 3. Per-specialization stats
  const [specRows] = await pool.query(
    `SELECT
       sp.id AS specialization_id,
       sp.name AS specialization_name,
       COUNT(DISTINCT d.id) AS doctors_count,
       COUNT(a.id) AS total_appointments,
       SUM(CASE WHEN a.status <> 'CANCELLED' AND a.id IS NOT NULL THEN 1 ELSE 0 END) AS active_appointments,
       COALESCE(SUM(CASE WHEN a.payment_status = 'PAID_AT_RECEPTION' AND a.status <> 'CANCELLED' THEN d.consultation_price ELSE 0 END), 0) AS paid_revenue
     FROM specializations sp
     LEFT JOIN doctors d ON d.specialization_id = sp.id
     LEFT JOIN appointments a ON a.doctor_id = d.id ${joinFilter}
     GROUP BY sp.id, sp.name
     ORDER BY total_appointments DESC, sp.name ASC`,
    params
  );

  const by_specialization = specRows.map((r) => ({
    specialization_id: r.specialization_id,
    specialization_name: r.specialization_name,
    doctors_count: Number(r.doctors_count || 0),
    total_appointments: Number(r.total_appointments || 0),
    active_appointments: Number(r.active_appointments || 0),
    paid_revenue: Number(r.paid_revenue || 0)
  }));

  // 4. User counts
  const [userCounts] = await pool.query(
    `SELECT role, COUNT(*) AS count FROM users WHERE is_active = 1 GROUP BY role`
  );
  const users_by_role = {};
  for (const r of userCounts) {
    users_by_role[r.role] = Number(r.count);
  }

  return {
    summary,
    by_doctor,
    by_specialization,
    users_by_role
  };
}

function escapeCsvCell(value) {
  const str = String(value ?? '');
  if (str.includes(',') || str.includes('"') || str.includes('\n')) {
    return `"${str.replace(/"/g, '""')}"`;
  }
  return str;
}

async function exportReportsCsv(filters = {}) {
  const report = await getAdminReports(filters);
  const lines = [
    'Medic,Specializare,Cabinet,Tarif (RON),Total Programari,Confirmate/Finalizate,Anulate,Grad Ocupare (%),Incasari Receptie (RON)'
  ];

  for (const row of report.by_doctor) {
    lines.push(
      [
        row.doctor_name,
        row.specialization_name,
        row.cabinet_number,
        row.consultation_price.toFixed(2),
        row.total_appointments,
        row.active_confirmed,
        row.cancelled_count,
        row.occupancy_rate,
        row.paid_revenue.toFixed(2)
      ]
        .map(escapeCsvCell)
        .join(',')
    );
  }

  // UTF-8 BOM for proper Romanian diacritics in Microsoft Excel
  return `\uFEFF${lines.join('\r\n')}`;
}

module.exports = {
  listUsers,
  createUser,
  updateUser,
  updateDoctorSchedules,
  createSpecialization,
  updateSpecialization,
  deleteSpecialization,
  getAdminReports,
  exportReportsCsv
};
