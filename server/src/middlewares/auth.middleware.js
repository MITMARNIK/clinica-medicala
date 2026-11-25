const jwt = require('jsonwebtoken');
const env = require('../config/env');
const { pool } = require('../config/db');
const { AppError } = require('./error.middleware');

async function resolveUserFromToken(token) {
  let payload;
  try {
    payload = jwt.verify(token, env.jwt.secret);
  } catch (_err) {
    throw new AppError(401, 'Sesiunea a expirat sau token-ul de autentificare este invalid.');
  }

  const [rows] = await pool.query(
    `SELECT u.id, u.full_name, u.email, u.phone, u.role, u.is_active, d.id AS doctor_id
     FROM users u
     LEFT JOIN doctors d ON d.user_id = u.id
     WHERE u.id = ?
     LIMIT 1`,
    [payload.id]
  );

  if (!rows.length) {
    throw new AppError(401, 'Contul asociat sesiunii nu a fost găsit.');
  }

  const user = rows[0];
  if (!user.is_active) {
    throw new AppError(403, 'Contul dumneavoastră este dezactivat. Contactați administratorul clinicii.');
  }

  return {
    id: user.id,
    full_name: user.full_name,
    email: user.email,
    phone: user.phone,
    role: user.role,
    doctor_id: user.doctor_id || null
  };
}

async function authenticateToken(req, _res, next) {
  try {
    const authHeader = req.headers.authorization || '';
    if (!authHeader.startsWith('Bearer ')) {
      throw new AppError(401, 'Autentificarea este obligatorie pentru a accesa această resursă.');
    }
    const token = authHeader.slice(7).trim();
    if (!token) {
      throw new AppError(401, 'Token-ul de autentificare lipsește.');
    }
    req.user = await resolveUserFromToken(token);
    next();
  } catch (err) {
    next(err);
  }
}

function authorizeRoles(...allowedRoles) {
  return (req, _res, next) => {
    if (!req.user) {
      return next(new AppError(401, 'Autentificarea este obligatorie.'));
    }
    if (!allowedRoles.includes(req.user.role)) {
      return next(
        new AppError(403, 'Nu aveți permisiunea necesară pentru a efectua această acțiune.')
      );
    }
    return next();
  };
}

module.exports = {
  authenticateToken,
  authorizeRoles
};
