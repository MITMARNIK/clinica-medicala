const bcrypt = require('bcrypt');
const jwt = require('jsonwebtoken');
const env = require('../config/env');
const { pool } = require('../config/db');
const { AppError } = require('../middlewares/error.middleware');
const { createNotification } = require('./notification.service');

const BCRYPT_ROUNDS = 10;

function signToken(user) {
  return jwt.sign(
    {
      id: user.id,
      email: user.email,
      role: user.role
    },
    env.jwt.secret,
    { expiresIn: env.jwt.expiresIn }
  );
}

async function registerPatient({ full_name, email, password, phone }) {
  const normalizedEmail = String(email).trim().toLowerCase();

  const [existing] = await pool.query('SELECT id FROM users WHERE email = ? LIMIT 1', [
    normalizedEmail
  ]);
  if (existing.length) {
    throw new AppError(409, 'Există deja un cont înregistrat cu această adresă de email.');
  }

  const passwordHash = await bcrypt.hash(password, BCRYPT_ROUNDS);

  const [result] = await pool.query(
    `INSERT INTO users (full_name, email, password_hash, phone, role, is_active)
     VALUES (?, ?, ?, ?, 'PATIENT', 1)`,
    [full_name.trim(), normalizedEmail, passwordHash, phone ? phone.trim() : null]
  );

  const user = {
    id: result.insertId,
    full_name: full_name.trim(),
    email: normalizedEmail,
    phone: phone ? phone.trim() : null,
    role: 'PATIENT',
    doctor_id: null
  };

  await createNotification(pool, {
    userId: user.id,
    title: 'Bine ați venit la ClinicaWeb!',
    message: 'Contul dumneavoastră de pacient a fost creat cu succes. Puteți efectua acum programări online.',
    type: 'SUCCESS'
  });

  const token = signToken(user);
  return { token, user };
}

async function loginUser({ email, password }) {
  const normalizedEmail = String(email).trim().toLowerCase();

  const [rows] = await pool.query(
    `SELECT u.id, u.full_name, u.email, u.password_hash, u.phone, u.role, u.is_active,
            d.id AS doctor_id
     FROM users u
     LEFT JOIN doctors d ON d.user_id = u.id
     WHERE u.email = ?
     LIMIT 1`,
    [normalizedEmail]
  );

  if (!rows.length) {
    throw new AppError(401, 'Adresa de email sau parola este incorectă.');
  }

  const record = rows[0];
  if (!record.is_active) {
    throw new AppError(403, 'Contul este dezactivat. Vă rugăm să contactați administratorul clinicii.');
  }

  const isMatch = await bcrypt.compare(password, record.password_hash);
  if (!isMatch) {
    throw new AppError(401, 'Adresa de email sau parola este incorectă.');
  }

  const user = {
    id: record.id,
    full_name: record.full_name,
    email: record.email,
    phone: record.phone,
    role: record.role,
    doctor_id: record.doctor_id || null
  };

  const token = signToken(user);
  return { token, user };
}

async function getProfile(userId) {
  const [rows] = await pool.query(
    `SELECT u.id, u.full_name, u.email, u.phone, u.role, u.is_active, u.created_at,
            d.id AS doctor_id, d.cabinet_number, d.consultation_price, d.bio,
            s.name AS specialization_name
     FROM users u
     LEFT JOIN doctors d ON d.user_id = u.id
     LEFT JOIN specializations s ON s.id = d.specialization_id
     WHERE u.id = ?
     LIMIT 1`,
    [userId]
  );

  if (!rows.length) {
    throw new AppError(404, 'Profilul utilizatorului nu a fost găsit.');
  }

  return rows[0];
}

async function updateProfile(userId, { full_name, phone, current_password, new_password }) {
  const [rows] = await pool.query(
    'SELECT id, full_name, phone, password_hash FROM users WHERE id = ? LIMIT 1',
    [userId]
  );
  if (!rows.length) {
    throw new AppError(404, 'Utilizatorul nu a fost găsit.');
  }

  const current = rows[0];
  let newHash = current.password_hash;

  if (new_password) {
    if (!current_password) {
      throw new AppError(400, 'Introduceți parola actuală pentru a seta o parolă nouă.');
    }
    const valid = await bcrypt.compare(current_password, current.password_hash);
    if (!valid) {
      throw new AppError(400, 'Parola actuală este incorectă.');
    }
    newHash = await bcrypt.hash(new_password, BCRYPT_ROUNDS);
  }

  await pool.query(
    `UPDATE users SET full_name = ?, phone = ?, password_hash = ? WHERE id = ?`,
    [
      full_name ? full_name.trim() : current.full_name,
      phone !== undefined ? (phone ? phone.trim() : null) : current.phone,
      newHash,
      userId
    ]
  );

  return getProfile(userId);
}

module.exports = {
  registerPatient,
  loginUser,
  getProfile,
  updateProfile,
  BCRYPT_ROUNDS
};
