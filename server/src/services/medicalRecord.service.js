const { pool, withTransaction } = require('../config/db');
const { AppError } = require('../middlewares/error.middleware');
const { createNotification } = require('./notification.service');

async function attachPrescriptions(records) {
  if (!records.length) return [];
  const ids = records.map((r) => r.id);
  const [prescriptions] = await pool.query(
    `SELECT id, medical_record_id, medication_name, dosage, duration_days, instructions
     FROM prescriptions
     WHERE medical_record_id IN (?)
     ORDER BY id ASC`,
    [ids]
  );

  const map = new Map();
  for (const p of prescriptions) {
    if (!map.has(p.medical_record_id)) {
      map.set(p.medical_record_id, []);
    }
    map.get(p.medical_record_id).push(p);
  }

  return records.map((r) => ({
    ...r,
    prescriptions: map.get(r.id) || []
  }));
}

async function listMedicalRecords(reqUser, filters = {}) {
  const params = [];
  const conditions = [];

  if (reqUser.role === 'PATIENT') {
    // Strict GDPR isolation: a patient can ONLY see their own medical records
    conditions.push('mr.patient_id = ?');
    params.push(reqUser.id);
  } else if (reqUser.role === 'DOCTOR') {
    if (!reqUser.doctor_id) return [];
    if (filters.patient_id) {
      // Doctor can view full history of a patient ONLY if that patient has an appointment with this doctor
      const [rel] = await pool.query(
        'SELECT id FROM appointments WHERE doctor_id = ? AND patient_id = ? LIMIT 1',
        [reqUser.doctor_id, Number(filters.patient_id)]
      );
      if (!rel.length) {
        throw new AppError(
          403,
          'Nu aveți acces la istoricul medical al unui pacient care nu este programat la dumneavoastră.'
        );
      }
      conditions.push('mr.patient_id = ?');
      params.push(Number(filters.patient_id));
    } else {
      conditions.push('mr.doctor_id = ?');
      params.push(reqUser.doctor_id);
    }
  } else {
    throw new AppError(403, 'Accesul la fișele medicale este permis doar medicului și pacientului titular.');
  }

  const whereClause = conditions.length ? `WHERE ${conditions.join(' AND ')}` : '';

  const [rows] = await pool.query(
    `SELECT mr.id, mr.appointment_id, mr.patient_id, mr.doctor_id,
            mr.symptoms, mr.diagnosis, mr.recommendations,
            mr.created_at, mr.updated_at,
            a.appointment_date, a.start_time, a.end_time,
            pu.full_name AS patient_name, pu.email AS patient_email, pu.phone AS patient_phone,
            du.full_name AS doctor_name, d.cabinet_number,
            s.name AS specialization_name
     FROM medical_records mr
     INNER JOIN appointments a ON a.id = mr.appointment_id
     INNER JOIN users pu ON pu.id = mr.patient_id
     INNER JOIN doctors d ON d.id = mr.doctor_id
     INNER JOIN users du ON du.id = d.user_id
     INNER JOIN specializations s ON s.id = d.specialization_id
     ${whereClause}
     ORDER BY a.appointment_date DESC, mr.created_at DESC`,
    params
  );

  return attachPrescriptions(rows);
}

async function getMedicalRecordById(recordId, reqUser) {
  const [rows] = await pool.query(
    `SELECT mr.id, mr.appointment_id, mr.patient_id, mr.doctor_id,
            mr.symptoms, mr.diagnosis, mr.recommendations,
            mr.created_at, mr.updated_at,
            a.appointment_date, a.start_time, a.end_time,
            pu.full_name AS patient_name, pu.email AS patient_email, pu.phone AS patient_phone,
            du.full_name AS doctor_name, d.cabinet_number,
            s.name AS specialization_name
     FROM medical_records mr
     INNER JOIN appointments a ON a.id = mr.appointment_id
     INNER JOIN users pu ON pu.id = mr.patient_id
     INNER JOIN doctors d ON d.id = mr.doctor_id
     INNER JOIN users du ON du.id = d.user_id
     INNER JOIN specializations s ON s.id = d.specialization_id
     WHERE mr.id = ?
     LIMIT 1`,
    [Number(recordId)]
  );

  if (!rows.length) {
    throw new AppError(404, 'Fișa medicală solicitată nu a fost găsită.');
  }

  const record = rows[0];

  if (reqUser.role === 'PATIENT') {
    if (record.patient_id !== reqUser.id) {
      throw new AppError(403, 'Nu aveți permisiunea să vizualizați fișa medicală a altui pacient.');
    }
  } else if (reqUser.role === 'DOCTOR') {
    if (record.doctor_id !== reqUser.doctor_id) {
      // Allow only if this doctor has an appointment with this patient
      const [rel] = await pool.query(
        'SELECT id FROM appointments WHERE doctor_id = ? AND patient_id = ? LIMIT 1',
        [reqUser.doctor_id, record.patient_id]
      );
      if (!rel.length) {
        throw new AppError(403, 'Nu aveți permisiunea să accesați această fișă medicală.');
      }
    }
  } else {
    throw new AppError(403, 'Accesul la conținutul fișei medicale este restricționat (GDPR).');
  }

  const [enriched] = await attachPrescriptions([record]);
  return enriched;
}

async function createMedicalRecord(
  { appointment_id, symptoms, diagnosis, recommendations, prescriptions = [] },
  reqUser
) {
  if (reqUser.role !== 'DOCTOR' || !reqUser.doctor_id) {
    throw new AppError(403, 'Doar medicii pot crea fișe medicale electronice.');
  }

  return withTransaction(async (connection) => {
    const [apptRows] = await connection.query(
      `SELECT id, patient_id, doctor_id, appointment_date, status
       FROM appointments
       WHERE id = ?
       FOR UPDATE`,
      [Number(appointment_id)]
    );

    if (!apptRows.length) {
      throw new AppError(404, 'Programarea asociată nu a fost găsită.');
    }

    const appt = apptRows[0];
    if (appt.doctor_id !== reqUser.doctor_id) {
      throw new AppError(403, 'Nu puteți completa fișa medicală pentru consultația altui medic.');
    }

    if (appt.status === 'CANCELLED') {
      throw new AppError(400, 'Nu se poate emite fișă medicală pentru o programare anulată.');
    }

    const [existingRecord] = await connection.query(
      'SELECT id FROM medical_records WHERE appointment_id = ? LIMIT 1',
      [appt.id]
    );
    if (existingRecord.length) {
      throw new AppError(409, 'Există deja o fișă medicală creată pentru această consultație.');
    }

    const [insertRes] = await connection.query(
      `INSERT INTO medical_records
         (appointment_id, patient_id, doctor_id, symptoms, diagnosis, recommendations)
       VALUES (?, ?, ?, ?, ?, ?)`,
      [
        appt.id,
        appt.patient_id,
        reqUser.doctor_id,
        String(symptoms).trim(),
        String(diagnosis).trim(),
        String(recommendations).trim()
      ]
    );

    const medicalRecordId = insertRes.insertId;

    if (Array.isArray(prescriptions) && prescriptions.length > 0) {
      for (const item of prescriptions) {
        if (!item.medication_name || !item.dosage || !item.duration_days) {
          throw new AppError(
            400,
            'Fiecare medicament din rețetă necesită denumire, dozaj și durată (zile).'
          );
        }
        await connection.query(
          `INSERT INTO prescriptions
             (medical_record_id, medication_name, dosage, duration_days, instructions)
           VALUES (?, ?, ?, ?, ?)`,
          [
            medicalRecordId,
            String(item.medication_name).trim(),
            String(item.dosage).trim(),
            Number(item.duration_days),
            item.instructions ? String(item.instructions).trim() : null
          ]
        );
      }
    }

    // Mark appointment as COMPLETED automatically
    if (appt.status !== 'COMPLETED') {
      await connection.query(
        `UPDATE appointments SET status = 'COMPLETED' WHERE id = ?`,
        [appt.id]
      );
    }

    await createNotification(connection, {
      userId: appt.patient_id,
      title: 'Fișă medicală și rețetă disponibile',
      message: `Medicul ${reqUser.full_name} a completat fișa medicală pentru consultația din ${appt.appointment_date}. O puteți vizualiza și tipări din istoricul medical.`,
      type: 'SUCCESS'
    });

    const [createdRows] = await connection.query(
      `SELECT mr.id, mr.appointment_id, mr.patient_id, mr.doctor_id,
              mr.symptoms, mr.diagnosis, mr.recommendations,
              mr.created_at, mr.updated_at,
              a.appointment_date, a.start_time, a.end_time,
              pu.full_name AS patient_name, pu.email AS patient_email, pu.phone AS patient_phone,
              du.full_name AS doctor_name, d.cabinet_number,
              s.name AS specialization_name
       FROM medical_records mr
       INNER JOIN appointments a ON a.id = mr.appointment_id
       INNER JOIN users pu ON pu.id = mr.patient_id
       INNER JOIN doctors d ON d.id = mr.doctor_id
       INNER JOIN users du ON du.id = d.user_id
       INNER JOIN specializations s ON s.id = d.specialization_id
       WHERE mr.id = ?`,
      [medicalRecordId]
    );

    const [prescRows] = await connection.query(
      `SELECT id, medical_record_id, medication_name, dosage, duration_days, instructions
       FROM prescriptions
       WHERE medical_record_id = ?
       ORDER BY id ASC`,
      [medicalRecordId]
    );

    return {
      ...createdRows[0],
      prescriptions: prescRows
    };
  });
}

async function updateMedicalRecord(
  recordId,
  { symptoms, diagnosis, recommendations, prescriptions },
  reqUser
) {
  if (reqUser.role !== 'DOCTOR' || !reqUser.doctor_id) {
    throw new AppError(403, 'Doar medicii pot actualiza fișele medicale.');
  }

  return withTransaction(async (connection) => {
    const [rows] = await connection.query(
      'SELECT id, doctor_id FROM medical_records WHERE id = ? FOR UPDATE',
      [Number(recordId)]
    );
    if (!rows.length) {
      throw new AppError(404, 'Fișa medicală nu a fost găsită.');
    }
    if (rows[0].doctor_id !== reqUser.doctor_id) {
      throw new AppError(403, 'Puteți edita doar fișele medicale emise de dumneavoastră.');
    }

    await connection.query(
      `UPDATE medical_records
       SET symptoms = COALESCE(?, symptoms),
           diagnosis = COALESCE(?, diagnosis),
           recommendations = COALESCE(?, recommendations)
       WHERE id = ?`,
      [
        symptoms !== undefined ? String(symptoms).trim() : null,
        diagnosis !== undefined ? String(diagnosis).trim() : null,
        recommendations !== undefined ? String(recommendations).trim() : null,
        Number(recordId)
      ]
    );

    if (Array.isArray(prescriptions)) {
      await connection.query('DELETE FROM prescriptions WHERE medical_record_id = ?', [
        Number(recordId)
      ]);
      for (const item of prescriptions) {
        if (!item.medication_name || !item.dosage || !item.duration_days) {
          throw new AppError(
            400,
            'Fiecare medicament din rețetă necesită denumire, dozaj și durată (zile).'
          );
        }
        await connection.query(
          `INSERT INTO prescriptions
             (medical_record_id, medication_name, dosage, duration_days, instructions)
           VALUES (?, ?, ?, ?, ?)`,
          [
            Number(recordId),
            String(item.medication_name).trim(),
            String(item.dosage).trim(),
            Number(item.duration_days),
            item.instructions ? String(item.instructions).trim() : null
          ]
        );
      }
    }

    const [updatedRows] = await connection.query(
      `SELECT mr.id, mr.appointment_id, mr.patient_id, mr.doctor_id,
              mr.symptoms, mr.diagnosis, mr.recommendations,
              mr.created_at, mr.updated_at,
              a.appointment_date, a.start_time, a.end_time,
              pu.full_name AS patient_name, pu.email AS patient_email, pu.phone AS patient_phone,
              du.full_name AS doctor_name, d.cabinet_number,
              s.name AS specialization_name
       FROM medical_records mr
       INNER JOIN appointments a ON a.id = mr.appointment_id
       INNER JOIN users pu ON pu.id = mr.patient_id
       INNER JOIN doctors d ON d.id = mr.doctor_id
       INNER JOIN users du ON du.id = d.user_id
       INNER JOIN specializations s ON s.id = d.specialization_id
       WHERE mr.id = ?`,
      [Number(recordId)]
    );

    const [prescRows] = await connection.query(
      `SELECT id, medical_record_id, medication_name, dosage, duration_days, instructions
       FROM prescriptions
       WHERE medical_record_id = ?
       ORDER BY id ASC`,
      [Number(recordId)]
    );

    return {
      ...updatedRows[0],
      prescriptions: prescRows
    };
  });
}

module.exports = {
  listMedicalRecords,
  getMedicalRecordById,
  createMedicalRecord,
  updateMedicalRecord
};
