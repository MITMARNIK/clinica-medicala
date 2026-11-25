const express = require('express');
const { body } = require('express-validator');
const authController = require('../controllers/auth.controller');
const { authenticateToken } = require('../middlewares/auth.middleware');
const { validateRequest } = require('../middlewares/validate.middleware');

const router = express.Router();

router.post(
  '/register',
  [
    body('full_name')
      .trim()
      .isLength({ min: 3, max: 120 })
      .withMessage('Numele complet trebuie să aibă cel puțin 3 caractere.'),
    body('email')
      .trim()
      .isEmail()
      .withMessage('Introduceți o adresă de email validă.'),
    body('password')
      .isLength({ min: 6 })
      .withMessage('Parola trebuie să conțină cel puțin 6 caractere.'),
    body('phone')
      .optional({ values: 'falsy' })
      .isLength({ min: 6, max: 30 })
      .withMessage('Numărul de telefon nu este valid.')
  ],
  validateRequest,
  authController.register
);

router.post(
  '/login',
  [
    body('email').trim().isEmail().withMessage('Introduceți o adresă de email validă.'),
    body('password').notEmpty().withMessage('Parola este obligatorie.')
  ],
  validateRequest,
  authController.login
);

router.get('/me', authenticateToken, authController.getMe);

router.patch(
  '/me',
  authenticateToken,
  [
    body('full_name')
      .optional()
      .trim()
      .isLength({ min: 3, max: 120 })
      .withMessage('Numele complet trebuie să aibă cel puțin 3 caractere.'),
    body('new_password')
      .optional({ values: 'falsy' })
      .isLength({ min: 6 })
      .withMessage('Parola nouă trebuie să aibă cel puțin 6 caractere.')
  ],
  validateRequest,
  authController.updateMe
);

module.exports = router;
