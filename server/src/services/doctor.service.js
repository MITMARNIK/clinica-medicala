const { pool } = require('../config/db');
const { AppError } = require('../middlewares/error.middleware');
const { getIsoDayOfWeek, generateSlots } = require('../utils/timeSlots');

async function listSpecializations() {
  const [rows] = await pool.query(
    `SELECT s.id, s.name, s.description,
            COUNT(DISTINCT CASE WHEN u.is_active = 1 THEN d.id END) AS doctors_count
     FROM specializations s
     LEFT JOIN doctors d ON d.specialization_id = s.id
     LEFT JOIN users u ON u.id = d.user_id
     GROUP BY s.id, s.name, s.description
     ORDER BY s.name ASC`
  );
  return rows;
}

async function listDoctors({ specialization_id, search } = {}) {
  const params = [];
  let whereClause = 'WHERE u.is_active = 1 AND u.role = "DOCTOR"';

  if (specialization_id) {
    whereClause += ' AND d.specialization_id = ?';
    params.push(Number(specialization_id));
  }

  if (search && String(search).trim()) {
    const like = `%${String(search).trim()}%`;
    whereClause += ' AND (u.full_name LIKE ? OR s.name LIKE ? OR d.bio LIKE ?)';
    params.push(like, like, like);
  }

  const [doctors] = await pool.query(
    `SELECT d.id, d.user_id, u.full_name, u.email, u.phone,
            d.specialization_id, s.name AS specialization_name,
            d.cabinet_number, d.consultation_price, d.bio
     FROM doctors d
     INNER JOIN users u ON u.id = d.user_id
     INNER JOIN specializations s ON s.id = d.specialization_id
     ${whereClause}
     ORDER BY s.name ASC, u.full_name ASC`,
    params
  );

  if (!doctors.length) {
    return [];
  }

  const doctorIds = doctors.map((doc) => doc.id);
  const [schedules] = await pool.query(
    `SELECT id, doctor_id, day_of_week, start_time, end_time, slot_duration_minutes
     FROM doctor_schedules
     WHERE doctor_id IN (?)
     ORDER BY doctor_id ASC, day_of_week ASC`,
    [doctorIds]
  );

  const scheduleMap = new Map();
  for (const sched of schedules) {
    if (!scheduleMap.has(sched.doctor_id)) {
      scheduleMap.set(sched.doctor_id, []);
    }
    scheduleMap.get(sched.doctor_id).push(sched);
  }

  return doctors.map((doc) => ({
    ...doc,
    consultation_price: Number(doc.consultation_price),
    schedules: scheduleMap.get(doc.id) || []
  }));
}

async function getDoctorById(doctorId) {
  const [rows] = await pool.query(
    `SELECT d.id, d.user_id, u.full_name, u.email, u.phone, u.is_active,
            d.specialization_id, s.name AS specialization_name,
            d.cabinet_number, d.consultation_price, d.bio
     FROM doctors d
     INNER JOIN users u ON u.id = d.user_id
     INNER JOIN specializations s ON s.id = d.specialization_id
     WHERE d.id = ?
     LIMIT 1`,
    [Number(doctorId)]
  );

  if (!rows.length) {
    throw new AppError(404, 'Medicul solicitat nu a fost găsit.');
  }

  const [schedules] = await pool.query(
    `SELECT id, doctor_id, day_of_week, start_time, end_time, slot_duration_minutes
     FROM doctor_schedules
     WHERE doctor_id = ?
     ORDER BY day_of_week ASC`,
    [Number(doctorId)]
  );

  return {
    ...rows[0],
    consultation_price: Number(rows[0].consultation_price),
    schedules
  };
}

async function getAvailableSlots(doctorId, dateStr) {
  const dayOfWeek = getIsoDayOfWeek(dateStr);
  if (!dayOfWeek) {
    throw new AppError(400, 'Formatul datei este invalid. Folosiți formatul YYYY-MM-DD.');
  }

  const doctor = await getDoctorById(doctorId);
  if (!doctor.is_active) {
    throw new AppError(400, 'Medicul selectat nu este disponibil momentan.');
  }

  // Weekend days (6 = Saturday, 7 = Sunday) have no clinical schedule
  if (dayOfWeek > 5) {
    return {
      doctor_id: doctor.id,
      doctor_name: doctor.full_name,
      date: dateStr,
      day_of_week: dayOfWeek,
      is_working_day: false,
      slots: []
    };
  }

  const [scheduleRows] = await pool.query(
    `SELECT start_time, end_time, slot_duration_minutes
     FROM doctor_schedules
     WHERE doctor_id = ? AND day_of_week = ?
     LIMIT 1`,
    [doctor.id, dayOfWeek]
  );

  if (!scheduleRows.length) {
    return {
      doctor_id: doctor.id,
      doctor_name: doctor.full_name,
      date: dateStr,
      day_of_week: dayOfWeek,
      is_working_day: false,
      slots: []
    };
  }

  const schedule = scheduleRows[0];
  const allSlots = generateSlots(
    schedule.start_time,
    schedule.end_time,
    schedule.slot_duration_minutes
  );

  const [bookedRows] = await pool.query(
    `SELECT start_time, end_time, status
     FROM appointments
     WHERE doctor_id = ? AND appointment_date = ? AND status <> 'CANCELLED'`,
    [doctor.id, dateStr]
  );

  const bookedStartTimes = new Set(bookedRows.map((b) => String(b.start_time).slice(0, 8)));

  const slots = allSlots.map((slot) => ({
    start_time: slot.start_time,
    end_time: slot.end_time,
    label: `${slot.start_time.slice(0, 5)} - ${slot.end_time.slice(0, 5)}`,
    is_available: !bookedStartTimes.has(slot.start_time)
  }));

  return {
    doctor_id: doctor.id,
    doctor_name: doctor.full_name,
    date: dateStr,
    day_of_week: dayOfWeek,
    is_working_day: true,
    slot_duration_minutes: schedule.slot_duration_minutes,
    slots
  };
}

module.exports = {
  listSpecializations,
  listDoctors,
  getDoctorById,
  getAvailableSlots
};
