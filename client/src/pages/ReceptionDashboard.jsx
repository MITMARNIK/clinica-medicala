import React, { useEffect, useState, useCallback } from 'react';
import { apiRequest } from '../services/api';
import { useToast } from '../context/ToastContext';
import { AppointmentStatusBadge, PaymentStatusBadge } from '../components/StatusBadge';

export default function ReceptionDashboard() {
  const { showToast } = useToast();

  const [appointments, setAppointments] = useState([]);
  const [doctors, setDoctors] = useState([]);
  const [patients, setPatients] = useState([]);
  const [loading, setLoading] = useState(true);

  // Filters
  const [filterDate, setFilterDate] = useState('');
  const [filterDoctor, setFilterDoctor] = useState('');
  const [filterStatus, setFilterStatus] = useState('');
  const [filterSearch, setFilterSearch] = useState('');

  // New walk-in / phone booking modal
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [newBooking, setNewBooking] = useState({
    patient_id: '',
    doctor_id: '',
    appointment_date: new Date().toISOString().slice(0, 10),
    start_time: '',
    notes: '',
    status: 'CONFIRMED'
  });
  const [createSlots, setCreateSlots] = useState([]);

  // Reschedule modal
  const [rescheduleTarget, setRescheduleTarget] = useState(null);
  const [rescheduleDate, setRescheduleDate] = useState('');
  const [rescheduleTime, setRescheduleTime] = useState('');
  const [rescheduleSlots, setRescheduleSlots] = useState([]);

  const loadMetadata = useCallback(async () => {
    try {
      const [docRes, patRes] = await Promise.all([
        apiRequest('/doctors'),
        apiRequest('/appointments/patients')
      ]);
      setDoctors(docRes.doctors || []);
      setPatients(patRes.patients || []);
    } catch (err) {
      showToast(err.message, 'danger');
    }
  }, [showToast]);

  const loadAppointments = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      if (filterDate) params.set('date', filterDate);
      if (filterDoctor) params.set('doctor_id', filterDoctor);
      if (filterStatus) params.set('status', filterStatus);
      if (filterSearch.trim()) params.set('search', filterSearch.trim());
      const q = params.toString() ? `?${params.toString()}` : '';
      const data = await apiRequest(`/appointments${q}`);
      setAppointments(data.appointments || []);
    } catch (err) {
      showToast(err.message, 'danger');
    } finally {
      setLoading(false);
    }
  }, [filterDate, filterDoctor, filterStatus, filterSearch, showToast]);

  useEffect(() => {
    loadMetadata();
  }, [loadMetadata]);

  useEffect(() => {
    loadAppointments();
  }, [loadAppointments]);

  // Load slots for new booking modal
  useEffect(() => {
    if (!showCreateModal || !newBooking.doctor_id || !newBooking.appointment_date) {
      setCreateSlots([]);
      return;
    }
    apiRequest(
      `/doctors/${newBooking.doctor_id}/available-slots?date=${encodeURIComponent(newBooking.appointment_date)}`
    )
      .then((res) => setCreateSlots(res.slots || []))
      .catch(() => setCreateSlots([]));
  }, [showCreateModal, newBooking.doctor_id, newBooking.appointment_date]);

  // Load slots for reschedule modal
  useEffect(() => {
    if (!rescheduleTarget || !rescheduleDate) {
      setRescheduleSlots([]);
      return;
    }
    apiRequest(
      `/doctors/${rescheduleTarget.doctor_id}/available-slots?date=${encodeURIComponent(rescheduleDate)}`
    )
      .then((res) => setRescheduleSlots(res.slots || []))
      .catch(() => setRescheduleSlots([]));
  }, [rescheduleTarget, rescheduleDate]);

  const handleQuickUpdate = async (id, payload, successMsg) => {
    try {
      await apiRequest(`/appointments/${id}`, {
        method: 'PATCH',
        body: JSON.stringify(payload)
      });
      showToast(successMsg, 'success');
      loadAppointments();
    } catch (err) {
      showToast(err.message, 'danger');
    }
  };

  const handleCreateSubmit = async (e) => {
    e.preventDefault();
    try {
      await apiRequest('/appointments', {
        method: 'POST',
        body: JSON.stringify({
          patient_id: Number(newBooking.patient_id),
          doctor_id: Number(newBooking.doctor_id),
          appointment_date: newBooking.appointment_date,
          start_time: newBooking.start_time,
          notes: newBooking.notes,
          status: newBooking.status
        })
      });
      showToast('Programarea la recepție a fost creată cu succes!', 'success');
      setShowCreateModal(false);
      setNewBooking((prev) => ({ ...prev, start_time: '', notes: '' }));
      loadAppointments();
    } catch (err) {
      showToast(err.message, 'danger');
    }
  };

  const handleRescheduleSubmit = async (e) => {
    e.preventDefault();
    if (!rescheduleTarget || !rescheduleDate || !rescheduleTime) return;
    try {
      await apiRequest(`/appointments/${rescheduleTarget.id}`, {
        method: 'PATCH',
        body: JSON.stringify({
          appointment_date: rescheduleDate,
          start_time: rescheduleTime,
          status: 'CONFIRMED'
        })
      });
      showToast('Programarea a fost reprogramată cu succes.', 'success');
      setRescheduleTarget(null);
      loadAppointments();
    } catch (err) {
      showToast(err.message, 'danger');
    }
  };

  return (
    <div className="container">
      <div className="d-flex flex-wrap justify-content-between align-items-center gap-3 mb-4">
        <div>
          <h3 className="cw-section-title mb-1">
            <i className="bi bi-calendar2-week text-primary me-2" />
            Agenda Clinicii — Recepție
          </h3>
          <p className="text-muted small mb-0">
            Validare, confirmare, reprogramare, anulare și marcarea încasărilor la recepție
          </p>
        </div>
        <button
          type="button"
          className="btn btn-cw-teal fw-semibold"
          onClick={() => setShowCreateModal(true)}
        >
          <i className="bi bi-plus-circle me-2" />
          Programare Nouă (Recepție / Telefon)
        </button>
      </div>

      {/* Filters */}
      <div className="cw-card p-3 mb-4">
        <div className="row g-2 align-items-end">
          <div className="col-md-3">
            <label className="form-label small fw-semibold mb-1">Caută pacient / medic</label>
            <input
              type="text"
              className="form-control form-control-sm"
              placeholder="Nume..."
              value={filterSearch}
              onChange={(e) => setFilterSearch(e.target.value)}
            />
          </div>
          <div className="col-md-2">
            <label className="form-label small fw-semibold mb-1">Data</label>
            <input
              type="date"
              className="form-control form-control-sm"
              value={filterDate}
              onChange={(e) => setFilterDate(e.target.value)}
            />
          </div>
          <div className="col-md-3">
            <label className="form-label small fw-semibold mb-1">Medic</label>
            <select
              className="form-select form-select-sm"
              value={filterDoctor}
              onChange={(e) => setFilterDoctor(e.target.value)}
            >
              <option value="">Toți medicii</option>
              {doctors.map((d) => (
                <option key={d.id} value={d.id}>
                  {d.full_name} ({d.specialization_name})
                </option>
              ))}
            </select>
          </div>
          <div className="col-md-2">
            <label className="form-label small fw-semibold mb-1">Status</label>
            <select
              className="form-select form-select-sm"
              value={filterStatus}
              onChange={(e) => setFilterStatus(e.target.value)}
            >
              <option value="">Toate</option>
              <option value="PENDING">În așteptare</option>
              <option value="CONFIRMED">Confirmate</option>
              <option value="COMPLETED">Finalizate</option>
              <option value="CANCELLED">Anulate</option>
            </select>
          </div>
          <div className="col-md-2">
            <button
              type="button"
              className="btn btn-sm btn-outline-secondary w-100"
              onClick={() => {
                setFilterDate('');
                setFilterDoctor('');
                setFilterStatus('');
                setFilterSearch('');
              }}
            >
              Resetează filtre
            </button>
          </div>
        </div>
      </div>

      {/* Appointments Table */}
      <div className="cw-card p-3">
        {loading ? (
          <div className="text-center py-5">
            <div className="spinner-border text-primary" />
          </div>
        ) : appointments.length === 0 ? (
          <div className="text-center py-5 text-muted">
            Nu există programări care să corespundă filtrelor selectate.
          </div>
        ) : (
          <div className="table-responsive">
            <table className="table table-hover align-middle mb-0 small">
              <thead className="table-light">
                <tr>
                  <th>Data & Ora</th>
                  <th>Pacient</th>
                  <th>Medic</th>
                  <th>Status</th>
                  <th>Plată Recepție</th>
                  <th className="text-end">Acțiuni</th>
                </tr>
              </thead>
              <tbody>
                {appointments.map((a) => (
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
                    <td>
                      <div className="fw-semibold">{a.doctor_name}</div>
                      <div className="text-muted">
                        {a.specialization_name} • Cab. {a.cabinet_number}
                      </div>
                    </td>
                    <td>
                      <AppointmentStatusBadge status={a.status} />
                    </td>
                    <td>
                      <PaymentStatusBadge status={a.payment_status} />
                      <div className="text-muted mt-1">{Number(a.consultation_price).toFixed(0)} RON</div>
                    </td>
                    <td className="text-end">
                      <div className="btn-group btn-group-sm flex-wrap">
                        {a.status === 'PENDING' && (
                          <button
                            type="button"
                            className="btn btn-outline-primary"
                            title="Confirmă programarea"
                            onClick={() =>
                              handleQuickUpdate(
                                a.id,
                                { status: 'CONFIRMED' },
                                'Programare confirmată.'
                              )
                            }
                          >
                            <i className="bi bi-check-lg" /> Confirmă
                          </button>
                        )}

                        {a.status !== 'CANCELLED' && a.status !== 'COMPLETED' && (
                          <button
                            type="button"
                            className="btn btn-outline-secondary"
                            title="Reprogramează"
                            onClick={() => {
                              setRescheduleTarget(a);
                              setRescheduleDate(a.appointment_date);
                              setRescheduleTime('');
                            }}
                          >
                            <i className="bi bi-calendar-range" />
                          </button>
                        )}

                        {a.status !== 'CANCELLED' && (
                          <button
                            type="button"
                            className={`btn ${
                              a.payment_status === 'PAID_AT_RECEPTION'
                                ? 'btn-outline-warning'
                                : 'btn-outline-success'
                            }`}
                            title="Comută status plată la recepție"
                            onClick={() =>
                              handleQuickUpdate(
                                a.id,
                                {
                                  payment_status:
                                    a.payment_status === 'PAID_AT_RECEPTION'
                                      ? 'UNPAID'
                                      : 'PAID_AT_RECEPTION'
                                },
                                a.payment_status === 'PAID_AT_RECEPTION'
                                  ? 'Plata a fost marcată ca NEPLĂTIT.'
                                  : 'Plata a fost marcată ca PLĂTIT LA RECEPȚIE.'
                              )
                            }
                          >
                            <i className="bi bi-cash-coin me-1" />
                            {a.payment_status === 'PAID_AT_RECEPTION' ? 'Neplătit' : 'Plătit'}
                          </button>
                        )}

                        {a.status !== 'CANCELLED' && a.status !== 'COMPLETED' && (
                          <button
                            type="button"
                            className="btn btn-outline-danger"
                            title="Anulează"
                            onClick={() => {
                              if (window.confirm('Anulați această programare?')) {
                                handleQuickUpdate(
                                  a.id,
                                  { status: 'CANCELLED' },
                                  'Programare anulată.'
                                );
                              }
                            }}
                          >
                            <i className="bi bi-x-lg" />
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Modal: New Walk-in / Phone Booking */}
      {showCreateModal && (
        <div className="modal d-block" style={{ backgroundColor: 'rgba(15, 29, 53, 0.55)' }}>
          <div className="modal-dialog modal-lg">
            <form className="modal-content" onSubmit={handleCreateSubmit}>
              <div className="modal-header">
                <h5 className="modal-title fw-bold">Programare Nouă (Recepție / Telefon)</h5>
                <button
                  type="button"
                  className="btn-close"
                  onClick={() => setShowCreateModal(false)}
                />
              </div>
              <div className="modal-body">
                <div className="row g-3">
                  <div className="col-md-6">
                    <label className="form-label small fw-semibold">Pacient</label>
                    <select
                      className="form-select"
                      value={newBooking.patient_id}
                      onChange={(e) =>
                        setNewBooking({ ...newBooking, patient_id: e.target.value })
                      }
                      required
                    >
                      <option value="">-- Selectați pacientul --</option>
                      {patients.map((p) => (
                        <option key={p.id} value={p.id}>
                          {p.full_name} ({p.phone || p.email})
                        </option>
                      ))}
                    </select>
                  </div>
                  <div className="col-md-6">
                    <label className="form-label small fw-semibold">Medic</label>
                    <select
                      className="form-select"
                      value={newBooking.doctor_id}
                      onChange={(e) =>
                        setNewBooking({ ...newBooking, doctor_id: e.target.value, start_time: '' })
                      }
                      required
                    >
                      <option value="">-- Selectați medicul --</option>
                      {doctors.map((d) => (
                        <option key={d.id} value={d.id}>
                          {d.full_name} — {d.specialization_name}
                        </option>
                      ))}
                    </select>
                  </div>
                  <div className="col-md-6">
                    <label className="form-label small fw-semibold">Data</label>
                    <input
                      type="date"
                      className="form-control"
                      value={newBooking.appointment_date}
                      onChange={(e) =>
                        setNewBooking({
                          ...newBooking,
                          appointment_date: e.target.value,
                          start_time: ''
                        })
                      }
                      required
                    />
                  </div>
                  <div className="col-md-6">
                    <label className="form-label small fw-semibold">Slot Orar Liber</label>
                    <select
                      className="form-select"
                      value={newBooking.start_time}
                      onChange={(e) =>
                        setNewBooking({ ...newBooking, start_time: e.target.value })
                      }
                      required
                    >
                      <option value="">-- Alegeți ora --</option>
                      {createSlots
                        .filter((s) => s.is_available)
                        .map((s) => (
                          <option key={s.start_time} value={s.start_time}>
                            {s.label}
                          </option>
                        ))}
                    </select>
                  </div>
                  <div className="col-12">
                    <label className="form-label small fw-semibold">Observații</label>
                    <input
                      type="text"
                      className="form-control"
                      placeholder="Programare telefonică / prezentare recepție..."
                      value={newBooking.notes}
                      onChange={(e) => setNewBooking({ ...newBooking, notes: e.target.value })}
                    />
                  </div>
                </div>
              </div>
              <div className="modal-footer">
                <button
                  type="button"
                  className="btn btn-outline-secondary"
                  onClick={() => setShowCreateModal(false)}
                >
                  Anulează
                </button>
                <button type="submit" className="btn btn-cw-primary">
                  Salvează Programarea
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Modal: Reschedule */}
      {rescheduleTarget && (
        <div className="modal d-block" style={{ backgroundColor: 'rgba(15, 29, 53, 0.55)' }}>
          <div className="modal-dialog">
            <form className="modal-content" onSubmit={handleRescheduleSubmit}>
              <div className="modal-header">
                <h5 className="modal-title fw-bold">
                  Reprogramare — {rescheduleTarget.patient_name}
                </h5>
                <button
                  type="button"
                  className="btn-close"
                  onClick={() => setRescheduleTarget(null)}
                />
              </div>
              <div className="modal-body">
                <div className="small text-muted mb-3">
                  Medic: <strong>{rescheduleTarget.doctor_name}</strong>
                </div>
                <div className="mb-3">
                  <label className="form-label small fw-semibold">Noua dată</label>
                  <input
                    type="date"
                    className="form-control"
                    value={rescheduleDate}
                    onChange={(e) => {
                      setRescheduleDate(e.target.value);
                      setRescheduleTime('');
                    }}
                    required
                  />
                </div>
                <div className="mb-3">
                  <label className="form-label small fw-semibold">Noul interval orar</label>
                  <select
                    className="form-select"
                    value={rescheduleTime}
                    onChange={(e) => setRescheduleTime(e.target.value)}
                    required
                  >
                    <option value="">-- Selectați slot disponibil --</option>
                    {rescheduleSlots
                      .filter((s) => s.is_available)
                      .map((s) => (
                        <option key={s.start_time} value={s.start_time}>
                          {s.label}
                        </option>
                      ))}
                  </select>
                </div>
              </div>
              <div className="modal-footer">
                <button
                  type="button"
                  className="btn btn-outline-secondary"
                  onClick={() => setRescheduleTarget(null)}
                >
                  Închide
                </button>
                <button type="submit" className="btn btn-cw-primary">
                  Confirmă Reprogramarea
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
