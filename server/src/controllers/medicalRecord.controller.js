const medicalRecordService = require('../services/medicalRecord.service');

async function list(req, res, next) {
  try {
    const medical_records = await medicalRecordService.listMedicalRecords(req.user, {
      patient_id: req.query.patient_id
    });
    res.status(200).json({ medical_records });
  } catch (err) {
    next(err);
  }
}

async function getById(req, res, next) {
  try {
    const medical_record = await medicalRecordService.getMedicalRecordById(req.params.id, req.user);
    res.status(200).json({ medical_record });
  } catch (err) {
    next(err);
  }
}

async function create(req, res, next) {
  try {
    const medical_record = await medicalRecordService.createMedicalRecord(req.body, req.user);
    res.status(201).json({
      message: 'Fișa medicală și rețeta au fost salvate cu succes.',
      medical_record
    });
  } catch (err) {
    next(err);
  }
}

async function update(req, res, next) {
  try {
    const medical_record = await medicalRecordService.updateMedicalRecord(
      req.params.id,
      req.body,
      req.user
    );
    res.status(200).json({
      message: 'Fișa medicală a fost actualizată cu succes.',
      medical_record
    });
  } catch (err) {
    next(err);
  }
}

module.exports = {
  list,
  getById,
  create,
  update
};
