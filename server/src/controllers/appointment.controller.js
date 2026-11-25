const appointmentService = require('../services/appointment.service');

async function create(req, res, next) {
  try {
    const appointment = await appointmentService.createAppointment(
      {
        patientId: req.body.patient_id,
        doctorId: req.body.doctor_id,
        appointmentDate: req.body.appointment_date,
        startTime: req.body.start_time,
        notes: req.body.notes,
        initialStatus: req.body.status
      },
      req.user
    );
    res.status(201).json({
      message: 'Programarea a fost creată cu succes.',
      appointment
    });
  } catch (err) {
    next(err);
  }
}

async function list(req, res, next) {
  try {
    const appointments = await appointmentService.listAppointments(req.user, {
      date: req.query.date,
      doctor_id: req.query.doctor_id,
      patient_id: req.query.patient_id,
      status: req.query.status,
      payment_status: req.query.payment_status,
      search: req.query.search
    });
    res.status(200).json({ appointments });
  } catch (err) {
    next(err);
  }
}

async function getById(req, res, next) {
  try {
    const appointment = await appointmentService.getAppointmentById(req.params.id, req.user);
    res.status(200).json({ appointment });
  } catch (err) {
    next(err);
  }
}

async function update(req, res, next) {
  try {
    const appointment = await appointmentService.updateAppointment(
      req.params.id,
      req.body,
      req.user
    );
    res.status(200).json({
      message: 'Programarea a fost actualizată cu succes.',
      appointment
    });
  } catch (err) {
    next(err);
  }
}

async function listPatients(req, res, next) {
  try {
    const patients = await appointmentService.listPatientsForReception(req.query.search);
    res.status(200).json({ patients });
  } catch (err) {
    next(err);
  }
}

module.exports = {
  create,
  list,
  getById,
  update,
  listPatients
};
