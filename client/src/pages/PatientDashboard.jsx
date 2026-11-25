import React, { useEffect, useState, useCallback } from 'react';
import { Link } from 'react-router-dom';
import { apiRequest } from '../services/api';
import { useAuth } from '../context/AuthContext';
import { useToast } from '../context/ToastContext';
import { AppointmentStatusBadge, PaymentStatusBadge } from '../components/StatusBadge';
import PrintableRecordModal from '../components/PrintableRecordModal';

export default function PatientDashboard() {
  const { user } = useAuth();
  const { showToast } = useToast();

  const [activeTab, setActiveTab] = useState('appointments');
  const [appointments, setAppointments] = useState([]);
  const [records, setRecords] = useState([]);
  const [loading, setLoading] = useState(true);
  const [selectedRecord, setSelectedRecord] = useState(null);

  const loadData = useCallback(async () => {
    setLoading(true);
    try {
      const [apptData, recData] = await Promise.all([
        apiRequest('/appointments'),
        apiRequest('/medical-records')
      ]);
      setAppointments(apptData.appointments || []);
      setRecords(recData.medical_records || []);
    } catch (err) {
      showToast(err.message, 'danger');
    } finally {
      setLoading(false);
    }
  }, [showToast]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  const handleCancelAppointment = async (apptId) => {
    if (!window.confirm('Sigur doriți să anulați această programare?')) return;
    try {
      await apiRequest(`/appointments/${apptId}`, {
        method: 'PATCH',
        body: JSON.stringify({ status: 'CANCELLED' })
      });
      showToast('Programarea a fost anulată.', 'warning');
      loadData();
    } catch (err) {
      showToast(err.message, 'danger');
    }
  };

  const activeCount = appointments.filter(
    (a) => a.status === 'PENDING' || a.status === 'CONFIRMED'
  ).length;

  return (
    <div className="container">
      <div className="d-flex flex-wrap justify-content-between align-items-center gap-3 mb-4">
        <div>
          <h3 className="cw-section-title mb-1">Bun venit, {user?.full_name}</h3>
          <p className="text-muted small mb-0">
            Gestionați programările dumneavoastră și consultați istoricul medical securizat
          </p>
        </div>
        <Link to="/programare-noua" className="btn btn-cw-primary fw-semibold">
          <i className="bi bi-calendar-plus me-2" />
          Programare Nouă
        </Link>
      </div>

      {/* Quick KPIs */}
      <div className="row g-3 mb-4">
        <div className="col-sm-4">
          <div className="cw-card cw-kpi-card p-3">
            <div className="small text-muted">Programări active</div>
            <div className="fs-3 fw-bold text-dark">{activeCount}</div>
          </div>
        </div>
        <div className="col-sm-4">
          <div className="cw-card cw-kpi-card teal p-3">
            <div className="small text-muted">Total programări</div>
            <div className="fs-3 fw-bold text-dark">{appointments.length}</div>
          </div>
        </div>
        <div className="col-sm-4">
          <div className="cw-card cw-kpi-card navy p-3">
            <div className="small text-muted">Fișe medicale & rețete</div>
            <div className="fs-3 fw-bold text-dark">{records.length}</div>
          </div>
        </div>
      </div>

      {/* Navigation Tabs */}
      <ul className="nav nav-pills mb-3 gap-2">
        <li className="nav-item">
          <button
            type="button"
            className={`nav-link ${activeTab === 'appointments' ? 'active' : 'bg-white border text-dark'}`}
            onClick={() => setActiveTab('appointments')}
          >
            <i className="bi bi-calendar-event me-2" />
            Programările Mele ({appointments.length})
          </button>
        </li>
        <li className="nav-item">
          <button
            type="button"
            className={`nav-link ${activeTab === 'records' ? 'active' : 'bg-white border text-dark'}`}
            onClick={() => setActiveTab('records')}
          >
            <i className="bi bi-file-earmark-medical me-2" />
            Istoric Medical & Rețete ({records.length})
          </button>
        </li>
      </ul>

      {loading ? (
        <div className="cw-card p-5 text-center">
          <div className="spinner-border text-primary" />
        </div>
      ) : activeTab === 'appointments' ? (
        <div className="cw-card p-3 p-md-4">
          {appointments.length === 0 ? (
            <div className="text-center py-4 text-muted">
              Nu aveți încă programări.{' '}
              <Link to="/programare-noua">Faceți prima programare online</Link>.
            </div>
          ) : (
            <div className="table-responsive">
              <table className="table align-middle mb-0">
                <thead className="table-light">
                  <tr>
                    <th>Data & Ora</th>
                    <th>Medic / Specializare</th>
                    <th>Cabinet</th>
                    <th>Status</th>
                    <th>Plată</th>
                    <th className="text-end">Acțiuni</th>
                  </tr>
                </thead>
                <tbody>
                  {appointments.map((a) => (
                    <tr key={a.id}>
                      <td>
                        <div className="fw-semibold">{a.appointment_date}</div>
                        <div className="small text-muted">
                          {String(a.start_time).slice(0, 5)} – {String(a.end_time).slice(0, 5)}
                        </div>
                      </td>
                      <td>
                        <div className="fw-semibold">{a.doctor_name}</div>
                        <div className="small text-muted">{a.specialization_name}</div>
                      </td>
                      <td>{a.cabinet_number}</td>
                      <td>
                        <AppointmentStatusBadge status={a.status} />
                      </td>
                      <td>
                        <PaymentStatusBadge status={a.payment_status} />
                        <div className="small text-muted mt-1">
                          {Number(a.consultation_price).toFixed(0)} RON
                        </div>
                      </td>
                      <td className="text-end">
                        {(a.status === 'PENDING' || a.status === 'CONFIRMED') && (
                          <button
                            type="button"
                            className="btn btn-sm btn-outline-danger"
                            onClick={() => handleCancelAppointment(a.id)}
                          >
                            <i className="bi bi-x-circle me-1" />
                            Anulează
                          </button>
                        )}
                        {a.medical_record_id && (
                          <button
                            type="button"
                            className="btn btn-sm btn-outline-primary ms-1"
                            onClick={() => {
                              const rec = records.find((r) => r.id === a.medical_record_id);
                              if (rec) setSelectedRecord(rec);
                            }}
                          >
                            <i className="bi bi-file-medical me-1" />
                            Vezi Fișa
                          </button>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      ) : (
        <div className="row g-3">
          {records.length === 0 ? (
            <div className="col-12">
              <div className="cw-card p-5 text-center text-muted">
                Nu există încă fișe medicale emise pe contul dumneavoastră.
              </div>
            </div>
          ) : (
            records.map((rec) => (
              <div key={rec.id} className="col-md-6">
                <div className="cw-card p-4 h-100 d-flex flex-column">
                  <div className="d-flex justify-content-between align-items-start mb-2">
                    <div>
                      <span className="badge text-bg-light border text-primary mb-1">
                        {rec.specialization_name}
                      </span>
                      <h5 className="fw-bold mb-0">{rec.diagnosis}</h5>
                    </div>
                    <span className="small text-muted">{rec.appointment_date}</span>
                  </div>
                  <div className="small text-muted mb-3">
                    Medic: <strong>{rec.doctor_name}</strong> • Cabinet {rec.cabinet_number}
                  </div>
                  <div className="small mb-2">
                    <strong>Simptome:</strong> {rec.symptoms}
                  </div>
                  <div className="small mb-3">
                    <strong>Recomandări:</strong> {rec.recommendations}
                  </div>
                  <div className="mt-auto d-flex justify-content-between align-items-center pt-3 border-top">
                    <span className="badge bg-success-subtle text-success border border-success-subtle">
                      <i className="bi bi-capsule me-1" />
                      {rec.prescriptions?.length || 0} medicamente pe rețetă
                    </span>
                    <button
                      type="button"
                      className="btn btn-sm btn-cw-primary"
                      onClick={() => setSelectedRecord(rec)}
                    >
                      <i className="bi bi-printer me-1" />
                      Vezi & Tipărește PDF
                    </button>
                  </div>
                </div>
              </div>
            ))
          )}
        </div>
      )}

      <PrintableRecordModal record={selectedRecord} onClose={() => setSelectedRecord(null)} />
    </div>
  );
}
