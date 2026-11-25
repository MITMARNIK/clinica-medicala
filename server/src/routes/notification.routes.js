const express = require('express');
const { param } = require('express-validator');
const notificationController = require('../controllers/notification.controller');
const { authenticateToken } = require('../middlewares/auth.middleware');
const { validateRequest } = require('../middlewares/validate.middleware');

const router = express.Router();

router.use(authenticateToken);

router.get('/', notificationController.list);
router.patch('/read-all', notificationController.markAllRead);
router.patch(
  '/:id/read',
  [param('id').isInt({ min: 1 }).withMessage('ID notificare invalid.')],
  validateRequest,
  notificationController.markRead
);

module.exports = router;
