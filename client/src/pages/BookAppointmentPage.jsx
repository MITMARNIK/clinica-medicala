import React, { useEffect, useState, useCallback } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { apiRequest } from '../services/api';
import { useToast } from '../context/ToastContext';

function getNextWeekday() {
  const d = new Date();
  d.setDate(d.getDate() + 1);
  while (d.getDay() === 0 || d.getDay() === 6) {
    d.setDate(d.getDate() + 1);
  }
  return d.toISOString().slice(0, 10);
}

export default function BookAppointmentPage() {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const { showToast } = useToast();

  const [doctors, setDoctors] = useState([]);
  const [selectedDoctorId, setSelectedDoctorId] = useState(searchParams.get('doctor') || '');
  const [date, setDate] = useState(getNextWeekday());
  const [slotInfo, setSlotInfo] = useState(null);
  const [selectedStartTime, setSelectedStartTime] = useState('');
  const [notes, setNotes] = useState('');
  const [loadingSlots, setLoadingSlots] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    apiRequest('/doctors')
      .then((data) => {
        const list = data.doctors || [];
        setDoctors(list);
        if (!selectedDoctorId && list.length > 0) {
          setSelectedDoctorId(String(list[0].id));
        }
      })
      .catch((err) => setError(err.message));
  }, []);

  const loadSlots = useCallback(async () => {
    if (!selectedDoctorId || !date) return;
    setLoadingSlots(true);
    setSelectedStartTime('');
    setError('');
    try {
      const data = await apiRequest(
        `/doctors/${selectedDoctorId}/available-slots?date=${encodeURIComponent(date)}`
      );
      setSlotInfo(data);
    } catch (err) {
      setSlotInfo(null);
      setError(err.message);
    } finally {
      setLoadingSlots(false);
    }
  }, [selectedDoctorId, date]);

  useEffect(() => {
    loadSlots();
  }, [loadSlots]);

  const selectedDoctor = doctors.find((d) => String(d.id) === String(selectedDoctorId));

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!selectedStartTime) {
      setError('Selectați un interval orar disponibil.');
      return;
    }

    setSubmitting(true);
    setError('');
    try {
      await apiRequest('/appointments', {
        method: 'POST',
        body: JSON.stringify({
          doctor_id: Number(selectedDoctorId),
          appointment_date: date,
          start_time: selectedStartTime,
          notes
        })
      });
      showToast('Programarea dumneavoastră a fost înregistrată cu succes!', 'success');
      navigate('/pacient');
    } catch (err) {
      setError(err.message);
      if (err.status === 409) {
        loadSlots();
      }
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="container">
      <div className="row justify-content-center">
        <div className="col-lg-9">
          <div className="cw-card p-4 p-md-5">
            <div className="d-flex justify-content-between align-items-center mb-4">
              <div>
                <h3 className="cw-section-title mb-1">
                  <i className="bi bi-calendar-plus text-primary me-2" />
                  Programare Online Consultație
                </h3>
                <p className="text-muted small mb-0">
                  Alegeți medicul, data (Luni–Vineri) și un interval orar liber. Confirmare instantă.
                </p>
              </div>
            </div>

            {error && (
              <div className="alert alert-danger py-2 small" role="alert">
                <i className="bi bi-exclamation-circle me-2" />
                {error}
              </div>
            )}

            <form onSubmit={handleSubmit}>
              <div className="row g-3 mb-4">
                <div className="col-md-7">
                  <label className="form-label fw-semibold small">1. Alegeți Medicul</label>
                  <select
                    className="form-select"
                    value={selectedDoctorId}
                    onChange={(e) => setSelectedDoctorId(e.target.value)}
                    required
                  >
                    <option value="">-- Selectați un medic --</option>
                    {doctors.map((d) => (
                      <option key={d.id} value={d.id}>
                        {d.full_name} — {d.specialization_name} ({Number(d.consultation_price).toFixed(0)} RON)
                      </option>
                    ))}
                  </select>
                </div>

                <div className="col-md-5">
                  <label className="form-label fw-semibold small">2. Alegeți Data</label>
                  <input
                    type="date"
                    className="form-control"
                    value={date}
                    onChange={(e) => setDate(e.target.value)}
                    required
                  />
                </div>
              </div>

              {selectedDoctor && (
                <div className="alert alert-light border d-flex flex-wrap justify-content-between align-items-center small mb-4">
                  <div>
                    <strong>{selectedDoctor.full_name}</strong> ({selectedDoctor.specialization_name})
                    <span className="mx-2">•</span>
                    Cabinet {selectedDoctor.cabinet_number}
                  </div>
                  <div className="fw-bold text-primary">
                    Tarif consultație: {Number(selectedDoctor.consultation_price).toFixed(0)} RON
                    <span className="text-muted fw-normal"> (plată la recepție)</span>
                  </div>
                </div>
              )}

              <div className="mb-4">
                <label className="form-label fw-semibold small d-flex justify-content-between">
                  <span>3. Selectați Intervalul Orar Disponibil</span>
                  <span className="text-muted fw-normal">
                    <span className="badge me-1" style={{ backgroundColor: '#E6F7F5', color: '#0A685F', border: '1px solid #0E9488' }}>
                      Liber
                    </span>
                    <span className="badge text-bg-light border text-muted">Ocupat</span>
                  </span>
                </label>

                {loadingSlots ? (
                  <div className="py-4 text-center text-muted">
                    <div className="spinner-border spinner-border-sm text-primary me-2" />
                    Se verifică disponibilitatea...
                  </div>
                ) : !slotInfo ? (
                  <div className="p-3 bg-light rounded text-muted small">
                    Selectați medicul și data pentru a vedea sloturile orare.
                  </div>
                ) : !slotInfo.is_working_day ? (
                  <div className="alert alert-warning small mb-0">
                    <i className="bi bi-calendar-x me-2" />
                    Medicul nu are program de consultații în data selectată (clinica funcționează
                    Luni–Vineri). Alegeți o altă zi lucrătoare.
                  </div>
                ) : (
                  <div className="d-flex flex-wrap gap-2">
                    {slotInfo.slots.map((slot) => {
                      const isSelected = selectedStartTime === slot.start_time;
                      return (
                        <button
                          key={slot.start_time}
                          type="button"
                          disabled={!slot.is_available}
                          onClick={() => setSelectedStartTime(slot.start_time)}
                          className={`btn btn-sm cw-slot-btn ${
                            !slot.is_available
                              ? 'cw-slot-booked'
                              : isSelected
                                ? 'cw-slot-selected'
                                : 'cw-slot-available'
                          }`}
                        >
                          {slot.label}
                        </button>
                      );
                    })}
                  </div>
                )}
              </div>

              <div className="mb-4">
                <label className="form-label fw-semibold small">
                  4. Motivul consultației / Observații (opțional)
                </label>
                <textarea
                  className="form-control"
                  rows={2}
                  placeholder="Ex: Control periodic, dureri de cap, verificare analize..."
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                />
              </div>

              <div className="d-flex justify-content-end gap-2">
                <button
                  type="button"
                  className="btn btn-outline-secondary"
                  onClick={() => navigate('/pacient')}
                >
                  Anulează
                </button>
                <button
                  type="submit"
                  className="btn btn-cw-primary px-4 fw-semibold"
                  disabled={submitting || !selectedStartTime}
                >
                  {submitting ? 'Se înregistrează...' : 'Confirmă Programarea'}
                </button>
              </div>
            </form>
          </div>
        </div>
      </div>
    </div>
  );
}
