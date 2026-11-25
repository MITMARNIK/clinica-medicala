const doctorService = require('../services/doctor.service');

async function getSpecializations(_req, res, next) {
  try {
    const specializations = await doctorService.listSpecializations();
    res.status(200).json({ specializations });
  } catch (err) {
    next(err);
  }
}

async function getDoctors(req, res, next) {
  try {
    const doctors = await doctorService.listDoctors({
      specialization_id: req.query.specialization_id,
      search: req.query.search
    });
    res.status(200).json({ doctors });
  } catch (err) {
    next(err);
  }
}

async function getDoctorById(req, res, next) {
  try {
    const doctor = await doctorService.getDoctorById(req.params.id);
    res.status(200).json({ doctor });
  } catch (err) {
    next(err);
  }
}

async function getAvailableSlots(req, res, next) {
  try {
    const result = await doctorService.getAvailableSlots(req.params.id, req.query.date);
    res.status(200).json(result);
  } catch (err) {
    next(err);
  }
}

module.exports = {
  getSpecializations,
  getDoctors,
  getDoctorById,
  getAvailableSlots
};
