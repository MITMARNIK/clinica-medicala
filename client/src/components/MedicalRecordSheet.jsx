import React from 'react';

export default function MedicalRecordSheet({ record }) {
  if (!record) return null;

  return (
    <div className="cw-print-sheet cw-printable-area">
      <div className="cw-print-header d-flex justify-content-between align-items-start">
        <div>
          <h4 className="fw-bold mb-1" style={{ color: '#0F1D35' }}>
            ClinicaWeb — Centru Medical
          </h4>
          <div className="text-muted small">
            Fișă Medicală Electronică (EHR) și Prescripție Medicală
          </div>
        </div>
        <div className="text-end small">
          <div>
            <strong>Nr. Fișă:</strong> CW-{String(record.id).padStart(5, '0')}
          </div>
          <div>
            <strong>Data consultației:</strong> {record.appointment_date}
          </div>
          <div>
            <strong>Interval:</strong> {String(record.start_time || '').slice(0, 5)} -{' '}
            {String(record.end_time || '').slice(0, 5)}
          </div>
        </div>
      </div>

      <div className="row g-3 mb-4">
        <div className="col-md-6">
          <div className="p-3 rounded bg-light border">
            <div className="text-uppercase small text-muted fw-semibold mb-1">
              Date Pacient
            </div>
            <div className="fw-bold">{record.patient_name}</div>
            <div className="small text-muted">{record.patient_email}</div>
            {record.patient_phone && (
              <div className="small text-muted">Tel: {record.patient_phone}</div>
            )}
          </div>
        </div>
        <div className="col-md-6">
          <div className="p-3 rounded bg-light border">
            <div className="text-uppercase small text-muted fw-semibold mb-1">
              Medic Curant
            </div>
            <div className="fw-bold">{record.doctor_name}</div>
            <div className="small text-muted">
              Specializare: {record.specialization_name}
            </div>
            <div className="small text-muted">Cabinet: {record.cabinet_number}</div>
          </div>
        </div>
      </div>

      <div className="mb-3">
        <h6 className="fw-bold text-uppercase small text-primary mb-1">
          1. Simptome / Anamneză
        </h6>
        <p className="mb-0 p-2 bg-light rounded border">{record.symptoms}</p>
      </div>

      <div className="mb-3">
        <h6 className="fw-bold text-uppercase small text-primary mb-1">
          2. Diagnostic Clinic
        </h6>
        <p className="mb-0 p-2 bg-light rounded border fw-semibold">{record.diagnosis}</p>
      </div>

      <div className="mb-4">
        <h6 className="fw-bold text-uppercase small text-primary mb-1">
          3. Recomandări Medicale
        </h6>
        <p className="mb-0 p-2 bg-light rounded border">{record.recommendations}</p>
      </div>

      <div className="mb-4">
        <h6 className="fw-bold text-uppercase small text-success mb-2">
          4. Rețetă Electronică (Prescripție)
        </h6>
        {record.prescriptions && record.prescriptions.length > 0 ? (
          <div className="table-responsive">
            <table className="table table-bordered table-sm align-middle mb-0">
              <thead className="table-light">
                <tr>
                  <th>#</th>
                  <th>Medicament</th>
                  <th>Dozaj / Administrare</th>
                  <th>Durată</th>
                  <th>Instrucțiuni</th>
                </tr>
              </thead>
              <tbody>
                {record.prescriptions.map((p, idx) => (
                  <tr key={p.id || idx}>
                    <td>{idx + 1}</td>
                    <td className="fw-semibold">{p.medication_name}</td>
                    <td>{p.dosage}</td>
                    <td>{p.duration_days} zile</td>
                    <td>{p.instructions || '—'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <p className="text-muted small fst-italic mb-0">
            Nu au fost prescrise medicamente pentru această consultație.
          </p>
        )}
      </div>

      <div className="d-flex justify-content-between align-items-end pt-3 border-top small text-muted">
        <div>Document generat electronic prin sistemul ClinicaWeb.</div>
        <div className="text-end">
          <div>Semnătură și parafă medic</div>
          <div className="fw-bold text-dark mt-2">{record.doctor_name}</div>
        </div>
      </div>
    </div>
  );
}

