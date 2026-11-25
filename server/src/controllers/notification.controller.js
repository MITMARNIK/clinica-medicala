const notificationService = require('../services/notification.service');

async function list(req, res, next) {
  try {
    const notifications = await notificationService.listUserNotifications(req.user.id);
    res.status(200).json({ notifications });
  } catch (err) {
    next(err);
  }
}

async function markRead(req, res, next) {
  try {
    await notificationService.markNotificationRead(req.user.id, req.params.id);
    res.status(200).json({ message: 'Notificare marcată ca citită.' });
  } catch (err) {
    next(err);
  }
}

async function markAllRead(req, res, next) {
  try {
    await notificationService.markAllNotificationsRead(req.user.id);
    res.status(200).json({ message: 'Toate notificările au fost marcate ca citite.' });
  } catch (err) {
    next(err);
  }
}

module.exports = {
  list,
  markRead,
  markAllRead
};
