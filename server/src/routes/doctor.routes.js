const express = require('express');
const { param, query } = require('express-validator');
const doctorController = require('../controllers/doctor.controller');
const { validateRequest } = require('../middlewares/validate.middleware');

const router = express.Router();
const specializationsRouter = express.Router();

specializationsRouter.get('/', doctorController.getSpecializations);

router.get('/', doctorController.getDoctors);

router.get(
  '/:id',
  [param('id').isInt({ min: 1 }).withMessage('ID-ul medicului este invalid.')],
  validateRequest,
  doctorController.getDoctorById
);

router.get(
  '/:id/available-slots',
  [
    param('id').isInt({ min: 1 }).withMessage('ID-ul medicului este invalid.'),
    query('date')
      .matches(/^\d{4}-\d{2}-\d{2}$/)
      .withMessage('Parametrul date este obligatoriu în formatul YYYY-MM-DD.')
  ],
  validateRequest,
  doctorController.getAvailableSlots
);

router.specializationsRouter = specializationsRouter;

module.exports = router;
