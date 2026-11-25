const express = require('express');
const { body, param } = require('express-validator');
const appointmentController = require('../controllers/appointment.controller');
const { authenticateToken, authorizeRoles } = require('../middlewares/auth.middleware');
const { validateRequest } = require('../middlewares/validate.middleware');

const router = express.Router();

router.use(authenticateToken);

router.get(
  '/patients',
  authorizeRoles('RECEPTIONIST', 'ADMIN'),
  appointmentController.listPatients
);

router.get('/', appointmentController.list);

router.post(
  '/',
  authorizeRoles('PATIENT', 'RECEPTIONIST', 'ADMIN'),
  [
    body('doctor_id').isInt({ min: 1 }).withMessage('Selectați un medic valid.'),
    body('appointment_date')
      .matches(/^\d{4}-\d{2}-\d{2}$/)
      .withMessage('Data programării trebuie să fie în formatul YYYY-MM-DD.'),
    body('start_time')
      .matches(/^\d{1,2}:\d{2}(:\d{2})?$/)
      .withMessage('Ora de început trebuie să fie în formatul HH:MM.')
  ],
  validateRequest,
  appointmentController.create
);

router.get(
  '/:id',
  [param('id').isInt({ min: 1 }).withMessage('ID-ul programării este invalid.')],
  validateRequest,
  appointmentController.getById
);

router.patch(
  '/:id',
  [
    param('id').isInt({ min: 1 }).withMessage('ID-ul programării este invalid.'),
    body('status')
      .optional()
      .isIn(['PENDING', 'CONFIRMED', 'COMPLETED', 'CANCELLED'])
      .withMessage('Status invalid.'),
    body('payment_status')
      .optional()
      .isIn(['UNPAID', 'PAID_AT_RECEPTION'])
      .withMessage('Status de plată invalid.'),
    body('appointment_date')
      .optional()
      .matches(/^\d{4}-\d{2}-\d{2}$/)
      .withMessage('Data reprogramării trebuie să fie în formatul YYYY-MM-DD.'),
    body('start_time')
      .optional()
      .matches(/^\d{1,2}:\d{2}(:\d{2})?$/)
      .withMessage('Ora reprogramării trebuie să fie în formatul HH:MM.')
  ],
  validateRequest,
  appointmentController.update
);

module.exports = router;
