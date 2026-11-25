const adminService = require('../services/admin.service');

async function listUsers(req, res, next) {
  try {
    const users = await adminService.listUsers({
      role: req.query.role,
      search: req.query.search
    });
    res.status(200).json({ users });
  } catch (err) {
    next(err);
  }
}

async function createUser(req, res, next) {
  try {
    const user = await adminService.createUser(req.body);
    res.status(201).json({
      message: 'Utilizatorul a fost creat cu succes.',
      user
    });
  } catch (err) {
    next(err);
  }
}

async function updateUser(req, res, next) {
  try {
    const user = await adminService.updateUser(req.params.id, req.body, req.user.id);
    res.status(200).json({
      message: 'Datele utilizatorului au fost actualizate.',
      user
    });
  } catch (err) {
    next(err);
  }
}

async function updateDoctorSchedules(req, res, next) {
  try {
    const schedules = await adminService.updateDoctorSchedules(
      req.params.doctorId,
      req.body.schedules
    );
    res.status(200).json({
      message: 'Orarul medicului a fost actualizat cu succes.',
      schedules
    });
  } catch (err) {
    next(err);
  }
}

async function createSpecialization(req, res, next) {
  try {
    const specialization = await adminService.createSpecialization(req.body);
    res.status(201).json({
      message: 'Specializarea medicală a fost adăugată.',
      specialization
    });
  } catch (err) {
    next(err);
  }
}

async function updateSpecialization(req, res, next) {
  try {
    const specialization = await adminService.updateSpecialization(req.params.id, req.body);
    res.status(200).json({
      message: 'Specializarea medicală a fost actualizată.',
      specialization
    });
  } catch (err) {
    next(err);
  }
}

async function deleteSpecialization(req, res, next) {
  try {
    await adminService.deleteSpecialization(req.params.id);
    res.status(200).json({
      message: 'Specializarea medicală a fost ștearsă.'
    });
  } catch (err) {
    next(err);
  }
}

async function getReports(req, res, next) {
  try {
    const report = await adminService.getAdminReports({
      from_date: req.query.from_date,
      to_date: req.query.to_date
    });
    res.status(200).json(report);
  } catch (err) {
    next(err);
  }
}

async function exportReportsCsv(req, res, next) {
  try {
    const csv = await adminService.exportReportsCsv({
      from_date: req.query.from_date,
      to_date: req.query.to_date
    });
    res.setHeader('Content-Type', 'text/csv; charset=utf-8');
    res.setHeader('Content-Disposition', 'attachment; filename="raport-clinicaweb.csv"');
    res.status(200).send(csv);
  } catch (err) {
    next(err);
  }
}

module.exports = {
  listUsers,
  createUser,
  updateUser,
  updateDoctorSchedules,
  createSpecialization,
  updateSpecialization,
  deleteSpecialization,
  getReports,
  exportReportsCsv
};
