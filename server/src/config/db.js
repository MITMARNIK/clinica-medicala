const mysql = require('mysql2/promise');
const env = require('./env');

const pool = mysql.createPool({
  host: env.db.host,
  port: env.db.port,
  user: env.db.user,
  password: env.db.password,
  database: env.db.database,
  waitForConnections: true,
  connectionLimit: 15,
  queueLimit: 0,
  dateStrings: true,
  timezone: '+00:00'
});

/**
 * Execute a callback inside an atomic MySQL transaction.
 * Automatically commits on success and rolls back on error.
 */
async function withTransaction(callback) {
  const connection = await pool.getConnection();
  try {
    await connection.beginTransaction();
    const result = await callback(connection);
    await connection.commit();
    return result;
  } catch (err) {
    try {
      await connection.rollback();
    } catch (_rollbackErr) {
      // Ignore secondary rollback errors
    }
    throw err;
  } finally {
    connection.release();
  }
}

async function testConnection() {
  const conn = await pool.getConnection();
  try {
    await conn.ping();
    return true;
  } finally {
    conn.release();
  }
}

module.exports = {
  pool,
  withTransaction,
  testConnection
};
