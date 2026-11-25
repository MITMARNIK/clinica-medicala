const express = require('express');
const { body, param } = require('express-validator');
const medicalRecordController = require('../controllers/medicalRecord.controller');
const { authenticateToken, authorizeRoles } = require('../middlewares/auth.middleware');
const { validateRequest } = require('../middlewares/validate.middleware');

const router = express.Router();

router.use(authenticateToken);

router.get('/', authorizeRoles('PATIENT', 'DOCTOR'), medicalRecordController.list);

router.get(
  '/:id',
  authorizeRoles('PATIENT', 'DOCTOR'),
  [param('id').isInt({ min: 1 }).withMessage('ID-ul fișei medicale este invalid.')],
  validateRequest,
  medicalRecordController.getById
);

router.post(
  '/',
  authorizeRoles('DOCTOR'),
  [
    body('appointment_id').isInt({ min: 1 }).withMessage('ID-ul programării este obligatoriu.'),
    body('symptoms').trim().notEmpty().withMessage('Simptomele / anamneza sunt obligatorii.'),
    body('diagnosis').trim().notEmpty().withMessage('Diagnosticul este obligatoriu.'),
    body('recommendations').trim().notEmpty().withMessage('Recomandările medicale sunt obligatorii.'),
    body('prescriptions').optional().isArray().withMessage('Lista de medicamente trebuie să fie validă.')
  ],
  validateRequest,
  medicalRecordController.create
);

router.put(
  '/:id',
  authorizeRoles('DOCTOR'),
  [
    param('id').isInt({ min: 1 }).withMessage('ID-ul fișei medicale este invalid.'),
    body('symptoms').optional().trim().notEmpty().withMessage('Simptomele nu pot fi goale.'),
    body('diagnosis').optional().trim().notEmpty().withMessage('Diagnosticul nu poate fi gol.'),
    body('recommendations')
      .optional()
      .trim()
      .notEmpty()
      .withMessage('Recomandările nu pot fi goale.'),
    body('prescriptions').optional().isArray().withMessage('Lista de medicamente trebuie să fie validă.')
  ],
  validateRequest,
  medicalRecordController.update
);

module.exports = router;
