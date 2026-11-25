const { pool, withTransaction } = require('../config/db');
const { AppError } = require('../middlewares/error.middleware');
const { getIsoDayOfWeek, normalizeTime, generateSlots } = require('../utils/timeSlots');
const { createNotification } = require('./notification.service');

const VALID_STATUSES = ['PENDING', 'CONFIRMED', 'COMPLETED', 'CANCELLED'];
const VALID_PAYMENT_STATUSES = ['UNPAID', 'PAID_AT_RECEPTION'];

async function getAppointmentDetailed(connectionOrPool, appointmentId) {
  const db = connectionOrPool || pool;
  const [rows] = await db.query(
    `SELECT a.id, a.patient_id, a.doctor_id, a.appointment_date, a.start_time, a.end_time,
            a.status, a.payment_status, a.notes, a.created_at,
            pu.full_name AS patient_name, pu.email AS patient_email, pu.phone AS patient_phone,
            du.id AS doctor_user_id, du.full_name AS doctor_name,
            d.cabinet_number, d.consultation_price,
            s.name AS specialization_name,
            mr.id AS medical_record_id
     FROM appointments a
     INNER JOIN users pu ON pu.id = a.patient_id
     INNER JOIN doctors d ON d.id = a.doctor_id
     INNER JOIN users du ON du.id = d.user_id
     INNER JOIN specializations s ON s.id = d.specialization_id
     LEFT JOIN medical_records mr ON mr.appointment_id = a.id
     WHERE a.id = ?
     LIMIT 1`,
    [appointmentId]
  );

  if (!rows.length) return null;
  return {
    ...rows[0],
    consultation_price: Number(rows[0].consultation_price)
  };
}

/**
 * Validate that the requested (doctorId, date, startTime) falls on a valid slot
 * inside the doctor's weekly schedule, and return the matching { start_time, end_time }.
 */
async function resolveValidSlot(connection, doctorId, appointmentDate, startTimeRaw) {
  const dayOfWeek = getIsoDayOfWeek(appointmentDate);
  if (!dayOfWeek) {
    throw new AppError(400, 'Data programării este invalidă. Folosiți formatul YYYY-MM-DD.');
  }
  if (dayOfWeek > 5) {
    throw new AppError(400, 'Clinica funcționează de Luni până Vineri. Alegeți o zi lucrătoare.');
  }

  const normalizedStart = normalizeTime(startTimeRaw);
  if (!normalizedStart) {
    throw new AppError(400, 'Ora de început este invalidă. Folosiți formatul HH:MM.');
  }

  const [schedules] = await connection.query(
    `SELECT start_time, end_time, slot_duration_minutes
     FROM doctor_schedules
     WHERE doctor_id = ? AND day_of_week = ?
     LIMIT 1`,
    [doctorId, dayOfWeek]
  );

  if (!schedules.length) {
    throw new AppError(400, 'Medicul selectat nu are program de lucru în ziua aleasă.');
  }

  const sched = schedules[0];
  const validSlots = generateSlots(sched.start_time, sched.end_time, sched.slot_duration_minutes);
  const matchedSlot = validSlots.find((s) => s.start_time === normalizedStart);

  if (!matchedSlot) {
    throw new AppError(
      400,
      'Intervalul orar ales nu corespunde programului de consultații al medicului.'
    );
  }

  return matchedSlot;
}

/**
 * Atomic booking creation using MySQL transaction + FOR UPDATE lock + DB UNIQUE constraint.
 * Prevents double-booking under concurrent requests -> returns 409 Conflict.
 */
async function createAppointment({ patientId, doctorId, appointmentDate, startTime, notes, initialStatus = 'PENDING' }, reqUser) {
  const targetPatientId =
    reqUser.role === 'PATIENT' ? reqUser.id : Number(patientId);

  if (!targetPatientId) {
    throw new AppError(400, 'Selectați pacientul pentru această programare.');
  }

  const targetDoctorId = Number(doctorId);
  const status =
    reqUser.role === 'PATIENT'
      ? 'PENDING'
      : VALID_STATUSES.includes(initialStatus) && initialStatus !== 'CANCELLED'
        ? initialStatus
        : 'CONFIRMED';

  return withTransaction(async (connection) => {
    // 1. Lock doctor row to serialize concurrent bookings for the same doctor
    const [doctorRows] = await connection.query(
      `SELECT d.id, d.user_id, u.full_name, u.is_active
       FROM doctors d
       INNER JOIN users u ON u.id = d.user_id
       WHERE d.id = ?
       FOR UPDATE`,
      [targetDoctorId]
    );

    if (!doctorRows.length || !doctorRows[0].is_active) {
      throw new AppError(404, 'Medicul selectat nu există sau nu este activ.');
    }
    const doctorInfo = doctorRows[0];

    // 2. Verify patient exists and is active
    const [patientRows] = await connection.query(
      `SELECT id, full_name, role, is_active FROM users WHERE id = ? LIMIT 1`,
      [targetPatientId]
    );
    if (!patientRows.length || !patientRows[0].is_active) {
      throw new AppError(404, 'Pacientul selectat nu există sau nu este activ.');
    }

    // 3. Validate slot against doctor schedule
    const matchedSlot = await resolveValidSlot(
      connection,
      targetDoctorId,
      appointmentDate,
      startTime
    );

    // 4. Lock any existing non-cancelled appointment for this exact slot
    const [existingSlots] = await connection.query(
      `SELECT id
       FROM appointments
       WHERE doctor_id = ?
         AND appointment_date = ?
         AND start_time = ?
         AND status <> 'CANCELLED'
       FOR UPDATE`,
      [targetDoctorId, appointmentDate, matchedSlot.start_time]
    );

    if (existingSlots.length > 0) {
      throw new AppError(
        409,
        'Acest interval orar este deja rezervat. Vă rugăm să alegeți o altă oră.'
      );
    }

    // 5. Insert appointment (also guarded by UNIQUE KEY uq_appointments_active_slot)
    let insertResult;
    try {
      [insertResult] = await connection.query(
        `INSERT INTO appointments
           (patient_id, doctor_id, appointment_date, start_time, end_time, status, payment_status, notes)
         VALUES (?, ?, ?, ?, ?, ?, 'UNPAID', ?)`,
        [
          targetPatientId,
          targetDoctorId,
          appointmentDate,
          matchedSlot.start_time,
          matchedSlot.end_time,
          status,
          notes ? String(notes).trim() : null
        ]
      );
    } catch (err) {
      if (err && (err.code === 'ER_DUP_ENTRY' || err.errno === 1062)) {
        throw new AppError(
          409,
          'Acest interval orar este deja rezervat. Vă rugăm să alegeți o altă oră.'
        );
      }
      throw err;
    }

    // 6. Create internal notifications (patient & doctor)
    const timeLabel = matchedSlot.start_time.slice(0, 5);
    await createNotification(connection, {
      userId: targetPatientId,
      title: status === 'CONFIRMED' ? 'Programare confirmată' : 'Programare înregistrată',
      message: `Programarea la ${doctorInfo.full_name} din data de ${appointmentDate}, ora ${timeLabel}, a fost înregistrată (${status === 'CONFIRMED' ? 'confirmată' : 'în așteptare confirmare'}).`,
      type: 'SUCCESS'
    });

    await createNotification(connection, {
      userId: doctorInfo.user_id,
      title: 'Programare nouă în calendar',
      message: `Pacientul ${patientRows[0].full_name} a fost programat pe ${appointmentDate} la ora ${timeLabel}.`,
      type: 'INFO'
    });

    return getAppointmentDetailed(connection, insertResult.insertId);
  });
}

async function listAppointments(reqUser, filters = {}) {
  const params = [];
  const conditions = [];

  if (reqUser.role === 'PATIENT') {
    conditions.push('a.patient_id = ?');
    params.push(reqUser.id);
  } else if (reqUser.role === 'DOCTOR') {
    if (!reqUser.doctor_id) {
      return [];
    }
    conditions.push('a.doctor_id = ?');
    params.push(reqUser.doctor_id);
  } else {
    // RECEPTIONIST or ADMIN can filter by doctor_id or patient_id
    if (filters.doctor_id) {
      conditions.push('a.doctor_id = ?');
      params.push(Number(filters.doctor_id));
    }
    if (filters.patient_id) {
      conditions.push('a.patient_id = ?');
      params.push(Number(filters.patient_id));
    }
  }

  if (filters.date) {
    conditions.push('a.appointment_date = ?');
    params.push(filters.date);
  }

  if (filters.status && VALID_STATUSES.includes(filters.status)) {
    conditions.push('a.status = ?');
    params.push(filters.status);
  }

  if (filters.payment_status && VALID_PAYMENT_STATUSES.includes(filters.payment_status)) {
    conditions.push('a.payment_status = ?');
    params.push(filters.payment_status);
  }

  if (filters.search && String(filters.search).trim()) {
    const like = `%${String(filters.search).trim()}%`;
    conditions.push('(pu.full_name LIKE ? OR du.full_name LIKE ? OR s.name LIKE ?)');
    params.push(like, like, like);
  }

  const whereClause = conditions.length ? `WHERE ${conditions.join(' AND ')}` : '';

  const [rows] = await pool.query(
    `SELECT a.id, a.patient_id, a.doctor_id, a.appointment_date, a.start_time, a.end_time,
            a.status, a.payment_status, a.notes, a.created_at,
            pu.full_name AS patient_name, pu.email AS patient_email, pu.phone AS patient_phone,
            du.full_name AS doctor_name, d.cabinet_number, d.consultation_price,
            s.name AS specialization_name,
            mr.id AS medical_record_id
     FROM appointments a
     INNER JOIN users pu ON pu.id = a.patient_id
     INNER JOIN doctors d ON d.id = a.doctor_id
     INNER JOIN users du ON du.id = d.user_id
     INNER JOIN specializations s ON s.id = d.specialization_id
     LEFT JOIN medical_records mr ON mr.appointment_id = a.id
     ${whereClause}
     ORDER BY a.appointment_date DESC, a.start_time ASC`,
    params
  );

  return rows.map((r) => ({
    ...r,
    consultation_price: Number(r.consultation_price)
  }));
}

async function getAppointmentById(appointmentId, reqUser) {
  const appointment = await getAppointmentDetailed(pool, Number(appointmentId));
  if (!appointment) {
    throw new AppError(404, 'Programarea solicitată nu a fost găsită.');
  }

  if (reqUser.role === 'PATIENT' && appointment.patient_id !== reqUser.id) {
    throw new AppError(403, 'Nu aveți acces la programările altor pacienți.');
  }
  if (reqUser.role === 'DOCTOR' && appointment.doctor_id !== reqUser.doctor_id) {
    throw new AppError(403, 'Nu aveți acces la programările altor medici.');
  }

  return appointment;
}

async function updateAppointment(appointmentId, updates, reqUser) {
  return withTransaction(async (connection) => {
    const existing = await getAppointmentDetailed(connection, Number(appointmentId));
    if (!existing) {
      throw new AppError(404, 'Programarea solicitată nu a fost găsită.');
    }

    // Role-based authorization checks
    if (reqUser.role === 'PATIENT') {
      if (existing.patient_id !== reqUser.id) {
        throw new AppError(403, 'Nu puteți modifica programările altor pacienți.');
      }
      if (updates.status !== 'CANCELLED' || updates.payment_status || updates.appointment_date || updates.start_time) {
        throw new AppError(403, 'Ca pacient, puteți doar să anulați propria programare.');
      }
      if (existing.status === 'COMPLETED') {
        throw new AppError(400, 'O consultație deja finalizată nu poate fi anulată.');
      }
    } else if (reqUser.role === 'DOCTOR') {
      if (existing.doctor_id !== reqUser.doctor_id) {
        throw new AppError(403, 'Nu puteți modifica programările altor medici.');
      }
      if (updates.payment_status || updates.appointment_date || updates.start_time) {
        throw new AppError(403, 'Reprogramarea și actualizarea plății se efectuează la recepție.');
      }
    }

    let nextDate = existing.appointment_date;
    let nextStart = existing.start_time;
    let nextEnd = existing.end_time;
    let nextStatus = existing.status;
    let nextPaymentStatus = existing.payment_status;
    let nextNotes = updates.notes !== undefined ? updates.notes : existing.notes;
    let rescheduled = false;

    if (updates.status) {
      if (!VALID_STATUSES.includes(updates.status)) {
        throw new AppError(400, 'Status de programare invalid.');
      }
      nextStatus = updates.status;
    }

    if (updates.payment_status) {
      if (!VALID_PAYMENT_STATUSES.includes(updates.payment_status)) {
        throw new AppError(400, 'Status de plată invalid.');
      }
      nextPaymentStatus = updates.payment_status;
    }

    // Handle rescheduling atomically
    if (updates.appointment_date || updates.start_time) {
      const targetDate = updates.appointment_date || existing.appointment_date;
      const targetStart = updates.start_time || existing.start_time;

      await connection.query('SELECT id FROM doctors WHERE id = ? FOR UPDATE', [existing.doctor_id]);
      const matchedSlot = await resolveValidSlot(
        connection,
        existing.doctor_id,
        targetDate,
        targetStart
      );

      if (targetDate !== existing.appointment_date || matchedSlot.start_time !== existing.start_time) {
        const [conflictRows] = await connection.query(
          `SELECT id FROM appointments
           WHERE doctor_id = ?
             AND appointment_date = ?
             AND start_time = ?
             AND status <> 'CANCELLED'
             AND id <> ?
           FOR UPDATE`,
          [existing.doctor_id, targetDate, matchedSlot.start_time, existing.id]
        );
        if (conflictRows.length > 0) {
          throw new AppError(
            409,
            'Intervalul orar ales pentru reprogramare este deja ocupat.'
          );
        }
        nextDate = targetDate;
        nextStart = matchedSlot.start_time;
        nextEnd = matchedSlot.end_time;
        rescheduled = true;
      }
    }

    try {
      await connection.query(
        `UPDATE appointments
         SET appointment_date = ?, start_time = ?, end_time = ?,
             status = ?, payment_status = ?, notes = ?
         WHERE id = ?`,
        [nextDate, nextStart, nextEnd, nextStatus, nextPaymentStatus, nextNotes, existing.id]
      );
    } catch (err) {
      if (err && (err.code === 'ER_DUP_ENTRY' || err.errno === 1062)) {
        throw new AppError(409, 'Acest interval orar este deja rezervat.');
      }
      throw err;
    }

    // Internal notifications for patient
    if (rescheduled) {
      await createNotification(connection, {
        userId: existing.patient_id,
        title: 'Programare reprogramată',
        message: `Programarea la ${existing.doctor_name} a fost mutată pe ${nextDate}, ora ${nextStart.slice(0, 5)}.`,
        type: 'WARNING'
      });
    } else if (nextStatus !== existing.status) {
      const statusMap = {
        CONFIRMED: { title: 'Programare confirmată', text: 'a fost confirmată de recepție', type: 'SUCCESS' },
        CANCELLED: { title: 'Programare anulată', text: 'a fost anulată', type: 'DANGER' },
        COMPLETED: { title: 'Consultație finalizată', text: 'a fost marcată ca finalizată', type: 'INFO' },
        PENDING: { title: 'Programare în așteptare', text: 'este în așteptare', type: 'INFO' }
      };
      const meta = statusMap[nextStatus];
      await createNotification(connection, {
        userId: existing.patient_id,
        title: meta.title,
        message: `Programarea la ${existing.doctor_name} din ${nextDate}, ora ${nextStart.slice(0, 5)}, ${meta.text}.`,
        type: meta.type
      });
    }

    if (nextPaymentStatus !== existing.payment_status && nextPaymentStatus === 'PAID_AT_RECEPTION') {
      await createNotification(connection, {
        userId: existing.patient_id,
        title: 'Plată înregistrată la recepție',
        message: `Plata pentru consultația la ${existing.doctor_name} (${nextDate}) a fost marcată ca achitată la recepție.`,
        type: 'SUCCESS'
      });
    }

    return getAppointmentDetailed(connection, existing.id);
  });
}

async function listPatientsForReception(search = '') {
  const params = [];
  let searchSql = '';
  if (search && String(search).trim()) {
    const like = `%${String(search).trim()}%`;
    searchSql = ' AND (full_name LIKE ? OR email LIKE ? OR phone LIKE ?)';
    params.push(like, like, like);
  }
  const [rows] = await pool.query(
    `SELECT id, full_name, email, phone, created_at
     FROM users
     WHERE role = 'PATIENT' AND is_active = 1 ${searchSql}
     ORDER BY full_name ASC
     LIMIT 100`,
    params
  );
  return rows;
}

module.exports = {
  createAppointment,
  listAppointments,
  getAppointmentById,
  updateAppointment,
  listPatientsForReception
};
