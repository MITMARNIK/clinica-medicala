import React, { useEffect, useState, useCallback } from 'react';
import { Link } from 'react-router-dom';
import { apiRequest } from '../services/api';
import { useAuth } from '../context/AuthContext';
import { useToast } from '../context/ToastContext';
import { AppointmentStatusBadge, PaymentStatusBadge } from '../components/StatusBadge';
import PrintableRecordModal from '../components/PrintableRecordModal';

const EMPTY_MED = { medication_name: '', dosage: '', duration_days: 7, instructions: '' };

export default function DoctorDashboard() {
  const { user } = useAuth();
  const { showToast } = useToast();

  const [appointments, setAppointments] = useState([]);
  const [myRecords, setMyRecords] = useState([]);
  const [filterDate, setFilterDate] = useState('');
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState('ALL');
  const [loading, setLoading] = useState(true);

  // EHR Form modal
  const [ehrAppointment, setEhrAppointment] = useState(null);
  const [editingRecordId, setEditingRecordId] = useState(null);
  const [ehrForm, setEhrForm] = useState({
    symptoms: '',
    diagnosis: '',
    recommendations: '',
    prescriptions: [{ ...EMPTY_MED }]
  });
  const [savingEhr, setSavingEhr] = useState(false);

  // Patient History modal
  const [historyPatient, setHistoryPatient] = useState(null);
  const [patientHistory, setPatientHistory] = useState([]);

  // Printable Record modal
  const [printRecord, setPrintRecord] = useState(null);

  const loadData = useCallback(async () => {
    setLoading(true);
    try {
      const q = filterDate ? `?date=${encodeURIComponent(filterDate)}` : '';
      const [apptRes, recRes] = await Promise.all([
        apiRequest(`/appointments${q}`),
        apiRequest('/medical-records')
      ]);
      setAppointments(apptRes.appointments || []);
      setMyRecords(recRes.medical_records || []);
    } catch (err) {
      showToast(err.message, 'danger');
    } finally {
      setLoading(false);
    }
  }, [filterDate, showToast]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  const openEhrModal = (appt) => {
    setEhrAppointment(appt);
    const existing = myRecords.find((r) => r.appointment_id === appt.id);
    if (existing) {
      setEditingRecordId(existing.id);
      setEhrForm({
        symptoms: existing.symptoms,
        diagnosis: existing.diagnosis,
        recommendations: existing.recommendations,
        prescriptions:
          existing.prescriptions && existing.prescriptions.length > 0
            ? existing.prescriptions.map((p) => ({
                medication_name: p.medication_name,
                dosage: p.dosage,
                duration_days: p.duration_days,
                instructions: p.instructions || ''
              }))
            : [{ ...EMPTY_MED }]
      });
    } else {
      setEditingRecordId(null);
      setEhrForm({
        symptoms: '',
        diagnosis: '',
        recommendations: '',
        prescriptions: [{ ...EMPTY_MED }]
      });
    }
  };

  const handleOpenPatientHistory = async (appt) => {
    setHistoryPatient({ id: appt.patient_id, name: appt.patient_name });
    try {
      const data = await apiRequest(`/medical-records?patient_id=${appt.patient_id}`);
      setPatientHistory(data.medical_records || []);
    } catch (err) {
      showToast(err.message, 'danger');
      setPatientHistory([]);
    }
  };

  const handleSaveEhr = async (e) => {
    e.preventDefault();
    setSavingEhr(true);
    try {
      const cleanPrescriptions = ehrForm.prescriptions.filter(
        (p) => p.medication_name.trim() && p.dosage.trim()
      );
      const payload = {
        appointment_id: ehrAppointment.id,
        symptoms: ehrForm.symptoms,
        diagnosis: ehrForm.diagnosis,
        recommendations: ehrForm.recommendations,
        prescriptions: cleanPrescriptions
      };

      if (editingRecordId) {
        await apiRequest(`/medical-records/${editingRecordId}`, {
          method: 'PUT',
          body: JSON.stringify(payload)
        });
        showToast('Fișa medicală a fost actualizată cu succes.', 'success');
      } else {
        await apiRequest('/medical-records', {
          method: 'POST',
          body: JSON.stringify(payload)
        });
        showToast('Fișa medicală și rețeta au fost salvate.', 'success');
      }

      setEhrAppointment(null);
      loadData();
    } catch (err) {
      showToast(err.message, 'danger');
    } finally {
      setSavingEhr(false);
    }
  };

  const updateMedicationRow = (index, field, value) => {
    setEhrForm((prev) => {
      const next = [...prev.prescriptions];
      next[index] = { ...next[index], [field]: value };
      return { ...prev, prescriptions: next };
    });
  };

  const addMedicationRow = () => {
    setEhrForm((prev) => ({
      ...prev,
      prescriptions: [...prev.prescriptions, { ...EMPTY_MED }]
    }));
  };

  const removeMedicationRow = (index) => {
    setEhrForm((prev) => ({
      ...prev,
      prescriptions: prev.prescriptions.filter((_, i) => i !== index)
    }));
  };

  const filteredAppointments = appointments.filter((a) => {
    const matchesStatus = statusFilter === 'ALL' || a.status === statusFilter;
    const q = searchQuery.trim().toLowerCase();
    const matchesQuery =
      !q ||
      (a.patient_name || '').toLowerCase().includes(q) ||
      (a.patient_email || '').toLowerCase().includes(q) ||
      (a.patient_phone || '').toLowerCase().includes(q) ||
      (a.notes || '').toLowerCase().includes(q);
    return matchesStatus && matchesQuery;
  });

  const activeConsultations = appointments.filter(
    (a) => a.status === 'PENDING' || a.status === 'CONFIRMED'
  ).length;
  const completedConsultations = appointments.filter((a) => a.status === 'COMPLETED').length;

  return (
    <div className="container">
      <div className="d-flex flex-wrap justify-content-between align-items-center gap-3 mb-4">
        <div>
          <h3 className="cw-section-title mb-1">
            <i className="bi bi-heart-pulse text-success me-2" />
            Cabinet Medical — {user?.full_name}
          </h3>
          <p className="text-muted small mb-0">
            Calendarul propriu de consultații, istoric medical pacienți, fișe EHR și rețete electronice
          </p>
        </div>

        <div className="d-flex align-items-center gap-2">
          <input
            type="date"
            className="form-control form-control-sm"
            value={filterDate}
            onChange={(e) => setFilterDate(e.target.value)}
          />
          {filterDate && (
            <button
              type="button"
              className="btn btn-sm btn-outline-secondary"
              onClick={() => setFilterDate('')}
            >
              Toate zilele
            </button>
          )}
        </div>
      </div>

      {/* Doctor KPI Summary */}
      <div className="row g-3 mb-4">
        <div className="col-sm-4">
          <div className="cw-card cw-kpi-card p-3">
            <div className="small text-muted">Consultații în calendar</div>
            <div className="fs-3 fw-bold text-dark">{appointments.length}</div>
          </div>
        </div>
        <div className="col-sm-4">
          <div className="cw-card cw-kpi-card teal p-3">
            <div className="small text-muted">În așteptare / Confirmate</div>
            <div className="fs-3 fw-bold text-primary">{activeConsultations}</div>
          </div>
        </div>
        <div className="col-sm-4">
          <div className="cw-card cw-kpi-card navy p-3">
            <div className="small text-muted">Finalizate / Fișe emise</div>
            <div className="fs-3 fw-bold text-success">
              {completedConsultations} / {myRecords.length}
            </div>
          </div>
        </div>
      </div>

      {/* Doctor's Appointments */}
      <div className="cw-card p-3 p-md-4 mb-4">
        <div className="d-flex flex-wrap justify-content-between align-items-center gap-2 mb-3">
          <h5 className="fw-bold mb-0">Calendar Consultații</h5>
          <div className="d-flex flex-wrap gap-2">
            <div className="input-group input-group-sm" style={{ width: 240 }}>
              <span className="input-group-text bg-white">
                <i className="bi bi-search text-muted" />
              </span>
              <input
                type="text"
                className="form-control"
                placeholder="Caută pacient..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
              />
            </div>
            <select
              className="form-select form-select-sm"
              style={{ width: 170 }}
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
            >
              <option value="ALL">Toate statusurile</option>
              <option value="PENDING">În așteptare</option>
              <option value="CONFIRMED">Confirmate</option>
              <option value="COMPLETED">Finalizate</option>
              <option value="CANCELLED">Anulate</option>
            </select>
          </div>
        </div>
        {loading ? (
          <div className="text-center py-4">
            <div className="spinner-border text-primary" />
          </div>
        ) : filteredAppointments.length === 0 ? (
          <div className="text-center py-4 text-muted">
            Nu aveți programări pentru filtrele selectate.
          </div>
        ) : (
          <div className="table-responsive">
            <table className="table table-hover align-middle mb-0 small">
              <thead className="table-light">
                <tr>
                  <th>Data & Ora</th>
                  <th>Pacient</th>
                  <th>Observații</th>
                  <th>Status</th>
                  <th>Plată</th>
                  <th className="text-end">Acțiuni Clinice</th>
                </tr>
              </thead>
              <tbody>
                {filteredAppointments.map((a) => {
                  const rec = myRecords.find((r) => r.appointment_id === a.id);
                  return (
                    <tr key={a.id}>
                      <td>
                        <div className="fw-semibold">{a.appointment_date}</div>
                        <div className="text-muted">
                          {String(a.start_time).slice(0, 5)} – {String(a.end_time).slice(0, 5)}
                        </div>
                      </td>
                      <td>
                        <div className="fw-semibold">{a.patient_name}</div>
                        <div className="text-muted">{a.patient_phone || a.patient_email}</div>
                      </td>
                      <td style={{ maxWidth: 220 }}>{a.notes || '—'}</td>
                      <td>
                        <AppointmentStatusBadge status={a.status} />
                      </td>
                      <td>
                        <PaymentStatusBadge status={a.payment_status} />
                      </td>
                      <td className="text-end">
                        <div className="btn-group btn-group-sm">
                          <button
                            type="button"
                            className="btn btn-outline-secondary"
                            onClick={() => handleOpenPatientHistory(a)}
                          >
                            <i className="bi bi-clock-history me-1" />
                            Istoric
                          </button>

                          {a.status !== 'CANCELLED' && (
                            <button
                              type="button"
                              className="btn btn-cw-primary"
                              onClick={() => openEhrModal(a)}
                            >
                              <i className="bi bi-file-earmark-medical me-1" />
                              {rec ? 'Editează Fișa' : 'Completează Fișa'}
                            </button>
                          )}

                          {rec && (
                            <>
                              <Link
                                to={`/fisa-medicala/${rec.id}`}
                                state={{ record: rec }}
                                className="btn btn-outline-primary"
                                title="Deschide pagina detaliată (View)"
                              >
                                <i className="bi bi-eye me-1" />
                                View
                              </Link>
                              <button
                                type="button"
                                className="btn btn-outline-success"
                                title="Tipărește / Salvează PDF"
                                onClick={() => setPrintRecord(rec)}
                              >
                                <i className="bi bi-printer" />
                              </button>
                            </>
                          )}
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* EHR & Prescription Editor Modal */}
      {ehrAppointment && (
        <div className="modal d-block" style={{ backgroundColor: 'rgba(15, 29, 53, 0.55)' }}>
          <div className="modal-dialog modal-lg modal-dialog-scrollable">
            <form className="modal-content" onSubmit={handleSaveEhr}>
              <div className="modal-header bg-light">
                <h5 className="modal-title fw-bold">
                  <i className="bi bi-file-earmark-medical text-primary me-2" />
                  {editingRecordId ? 'Actualizare Fișă Medicală' : 'Fișă Medicală Electronică (EHR)'} —{' '}
                  {ehrAppointment.patient_name}
                </h5>
                <button
                  type="button"
                  className="btn-close"
                  onClick={() => setEhrAppointment(null)}
                />
              </div>

              <div className="modal-body">
                <div className="small text-muted mb-3">
                  Consultație din <strong>{ehrAppointment.appointment_date}</strong>, interval{' '}
                  {String(ehrAppointment.start_time).slice(0, 5)} –{' '}
                  {String(ehrAppointment.end_time).slice(0, 5)}
                </div>

                <div className="mb-3">
                  <label className="form-label small fw-semibold">Simptome / Anamneză *</label>
                  <textarea
                    className="form-control"
                    rows={2}
                    required
                    value={ehrForm.symptoms}
                    onChange={(e) => setEhrForm({ ...ehrForm, symptoms: e.target.value })}
                  />
                </div>

                <div className="mb-3">
                  <label className="form-label small fw-semibold">Diagnostic Clinic *</label>
                  <input
                    type="text"
                    className="form-control"
                    required
                    value={ehrForm.diagnosis}
                    onChange={(e) => setEhrForm({ ...ehrForm, diagnosis: e.target.value })}
                  />
                </div>

                <div className="mb-4">
                  <label className="form-label small fw-semibold">Recomandări Medicale *</label>
                  <textarea
                    className="form-control"
                    rows={2}
                    required
                    value={ehrForm.recommendations}
                    onChange={(e) => setEhrForm({ ...ehrForm, recommendations: e.target.value })}
                  />
                </div>

                <div className="d-flex justify-content-between align-items-center mb-2">
                  <label className="form-label small fw-bold text-success mb-0">
                    <i className="bi bi-capsule me-1" />
                    Rețetă Electronică (Medicamente)
                  </label>
                  <button
                    type="button"
                    className="btn btn-sm btn-outline-success"
                    onClick={addMedicationRow}
                  >
                    <i className="bi bi-plus-lg me-1" />
                    Adaugă medicament
                  </button>
                </div>

                {ehrForm.prescriptions.map((med, idx) => (
                  <div key={idx} className="row g-2 mb-2 align-items-center border rounded p-2 bg-light">
                    <div className="col-md-4">
                      <input
                        type="text"
                        className="form-control form-control-sm"
                        placeholder="Denumire medicament"
                        value={med.medication_name}
                        onChange={(e) =>
                          updateMedicationRow(idx, 'medication_name', e.target.value)
                        }
                      />
                    </div>
                    <div className="col-md-3">
                      <input
                        type="text"
                        className="form-control form-control-sm"
                        placeholder="Dozaj (ex: 1 cp / 12h)"
                        value={med.dosage}
                        onChange={(e) => updateMedicationRow(idx, 'dosage', e.target.value)}
                      />
                    </div>
                    <div className="col-md-2">
                      <input
                        type="number"
                        min={1}
                        className="form-control form-control-sm"
                        placeholder="Zile"
                        value={med.duration_days}
                        onChange={(e) =>
                          updateMedicationRow(idx, 'duration_days', Number(e.target.value))
                        }
                      />
                    </div>
                    <div className="col-md-2">
                      <input
                        type="text"
                        className="form-control form-control-sm"
                        placeholder="Instrucțiuni"
                        value={med.instructions}
                        onChange={(e) => updateMedicationRow(idx, 'instructions', e.target.value)}
                      />
                    </div>
                    <div className="col-md-1 text-end">
                      <button
                        type="button"
                        className="btn btn-sm btn-outline-danger"
                        onClick={() => removeMedicationRow(idx)}
                      >
                        <i className="bi bi-trash" />
                      </button>
                    </div>
                  </div>
                ))}
              </div>

              <div className="modal-footer">
                <button
                  type="button"
                  className="btn btn-outline-secondary"
                  onClick={() => setEhrAppointment(null)}
                >
                  Anulează
                </button>
                <button type="submit" className="btn btn-cw-primary" disabled={savingEhr}>
                  {savingEhr ? 'Se salvează...' : 'Salvează Fișa & Rețeta'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Patient Medical History Modal */}
      {historyPatient && (
        <div className="modal d-block" style={{ backgroundColor: 'rgba(15, 29, 53, 0.55)' }}>
          <div className="modal-dialog modal-lg modal-dialog-scrollable">
            <div className="modal-content">
              <div className="modal-header">
                <h5 className="modal-title fw-bold">
                  Istoric Medical — {historyPatient.name}
                </h5>
                <button
                  type="button"
                  className="btn-close"
                  onClick={() => setHistoryPatient(null)}
                />
              </div>
              <div className="modal-body">
                {patientHistory.length === 0 ? (
                  <p className="text-muted text-center py-3">
                    Acest pacient nu are încă fișe medicale anterioare în sistem.
                  </p>
                ) : (
                  patientHistory.map((rec) => (
                    <div key={rec.id} className="border rounded p-3 mb-3">
                      <div className="d-flex justify-content-between align-items-center mb-1">
                        <strong>{rec.diagnosis}</strong>
                        <span className="badge text-bg-light border">{rec.appointment_date}</span>
                      </div>
                      <div className="small text-muted mb-2">
                        {rec.doctor_name} ({rec.specialization_name})
                      </div>
                      <div className="small">
                        <strong>Simptome:</strong> {rec.symptoms}
                      </div>
                      <div className="small mb-2">
                        <strong>Recomandări:</strong> {rec.recommendations}
                      </div>
                      <div className="d-flex flex-wrap gap-2">
                        <Link
                          to={`/fisa-medicala/${rec.id}`}
                          state={{ record: rec }}
                          className="btn btn-sm btn-cw-primary"
                        >
                          <i className="bi bi-eye me-1" />
                          View
                        </Link>
                        <button
                          type="button"
                          className="btn btn-sm btn-outline-primary"
                          onClick={() => setPrintRecord(rec)}
                        >
                          <i className="bi bi-printer me-1" />
                          Deschide pentru Tipărire / PDF
                        </button>
                      </div>
                    </div>
                  ))
                )}
              </div>
            </div>
          </div>
        </div>
      )}

      <PrintableRecordModal record={printRecord} onClose={() => setPrintRecord(null)} />
    </div>
  );
}
