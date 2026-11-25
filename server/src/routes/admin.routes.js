const express = require('express');
const { body, param } = require('express-validator');
const adminController = require('../controllers/admin.controller');
const { authenticateToken, authorizeRoles } = require('../middlewares/auth.middleware');
const { validateRequest } = require('../middlewares/validate.middleware');

const router = express.Router();

router.use(authenticateToken, authorizeRoles('ADMIN'));

// Users & Doctors CRUD
router.get('/users', adminController.listUsers);

router.post(
  '/users',
  [
    body('full_name').trim().isLength({ min: 3, max: 120 }).withMessage('Numele complet este obligatoriu.'),
    body('email').trim().isEmail().withMessage('Adresa de email este invalidă.'),
    body('password').isLength({ min: 6 }).withMessage('Parola trebuie să aibă cel puțin 6 caractere.'),
    body('role')
      .isIn(['PATIENT', 'RECEPTIONIST', 'DOCTOR', 'ADMIN'])
      .withMessage('Rol de utilizator invalid.')
  ],
  validateRequest,
  adminController.createUser
);

router.patch(
  '/users/:id',
  [param('id').isInt({ min: 1 }).withMessage('ID utilizator invalid.')],
  validateRequest,
  adminController.updateUser
);

// Doctor Schedules
router.put(
  '/doctors/:doctorId/schedules',
  [
    param('doctorId').isInt({ min: 1 }).withMessage('ID medic invalid.'),
    body('schedules').isArray().withMessage('Lista de orare este obligatorie.')
  ],
  validateRequest,
  adminController.updateDoctorSchedules
);

// Specializations CRUD
router.post(
  '/specializations',
  [body('name').trim().isLength({ min: 2, max: 100 }).withMessage('Numele specializării este obligatoriu.')],
  validateRequest,
  adminController.createSpecialization
);

router.put(
  '/specializations/:id',
  [
    param('id').isInt({ min: 1 }).withMessage('ID specializare invalid.'),
    body('name').trim().isLength({ min: 2, max: 100 }).withMessage('Numele specializării este obligatoriu.')
  ],
  validateRequest,
  adminController.updateSpecialization
);

router.delete(
  '/specializations/:id',
  [param('id').isInt({ min: 1 }).withMessage('ID specializare invalid.')],
  validateRequest,
  adminController.deleteSpecialization
);

// Reports & CSV Export
router.get('/reports', adminController.getReports);
router.get('/reports/export-csv', adminController.exportReportsCsv);

module.exports = router;
