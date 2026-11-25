const authService = require('../services/auth.service');

async function register(req, res, next) {
  try {
    const result = await authService.registerPatient(req.body);
    res.status(201).json({
      message: 'Contul de pacient a fost creat cu succes.',
      ...result
    });
  } catch (err) {
    next(err);
  }
}

async function login(req, res, next) {
  try {
    const result = await authService.loginUser(req.body);
    res.status(200).json({
      message: 'Autentificare reușită.',
      ...result
    });
  } catch (err) {
    next(err);
  }
}

async function getMe(req, res, next) {
  try {
    const profile = await authService.getProfile(req.user.id);
    res.status(200).json({ user: profile });
  } catch (err) {
    next(err);
  }
}

async function updateMe(req, res, next) {
  try {
    const profile = await authService.updateProfile(req.user.id, req.body);
    res.status(200).json({
      message: 'Profilul a fost actualizat cu succes.',
      user: profile
    });
  } catch (err) {
    next(err);
  }
}

module.exports = {
  register,
  login,
  getMe,
  updateMe
};
