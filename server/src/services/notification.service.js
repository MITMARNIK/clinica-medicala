const { pool } = require('../config/db');

async function createNotification(connectionOrPool, { userId, title, message, type = 'INFO' }) {
  const db = connectionOrPool || pool;
  await db.query(
    `INSERT INTO notifications (user_id, title, message, type)
     VALUES (?, ?, ?, ?)`,
    [userId, title, message, type]
  );
}

async function listUserNotifications(userId, limit = 30) {
  const [rows] = await pool.query(
    `SELECT id, user_id, title, message, type, is_read, created_at
     FROM notifications
     WHERE user_id = ?
     ORDER BY created_at DESC, id DESC
     LIMIT ?`,
    [userId, Number(limit)]
  );
  return rows;
}

async function markNotificationRead(userId, notificationId) {
  await pool.query(
    `UPDATE notifications SET is_read = 1 WHERE id = ? AND user_id = ?`,
    [notificationId, userId]
  );
}

async function markAllNotificationsRead(userId) {
  await pool.query(
    `UPDATE notifications SET is_read = 1 WHERE user_id = ? AND is_read = 0`,
    [userId]
  );
}

module.exports = {
  createNotification,
  listUserNotifications,
  markNotificationRead,
  markAllNotificationsRead
};
