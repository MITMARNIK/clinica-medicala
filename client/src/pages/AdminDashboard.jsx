import React, { useEffect, useState, useCallback } from 'react';
import { apiRequest, downloadCsv } from '../services/api';
import { useToast } from '../context/ToastContext';
import {
  exportReportExcel,
  exportReportPdf,
  exportReportWord
} from '../utils/reportExport';

const DAYS = [
  { id: 1, label: 'Luni' },
  { id: 2, label: 'Marți' },
  { id: 3, label: 'Miercuri' },
  { id: 4, label: 'Joi' },
  { id: 5, label: 'Vineri' }
];

export default function AdminDashboard() {
  const { showToast } = useToast();

  const [activeTab, setActiveTab] = useState('reports');
  const [reports, setReports] = useState(null);
  const [users, setUsers] = useState([]);
  const [specializations, setSpecializations] = useState([]);
  const [loading, setLoading] = useState(true);

  // Report date range
  const [fromDate, setFromDate] = useState('');
  const [toDate, setToDate] = useState('');

  // Create User modal
  const [showUserModal, setShowUserModal] = useState(false);
  const [userForm, setUserForm] = useState({
    full_name: '',
    email: '',
    password: '',
    phone: '',
    role: 'DOCTOR',
    specialization_id: '',
    cabinet_number: '',
    consultation_price: 220,
    bio: ''
  });

  // Schedule editor modal
  const [scheduleDoctor, setScheduleDoctor] = useState(null);
  const [scheduleRows, setScheduleRows] = useState([]);

  // Specialization form
  const [specForm, setSpecForm] = useState({ id: null, name: '', description: '' });

  const loadAll = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      if (fromDate) params.set('from_date', fromDate);
      if (toDate) params.set('to_date', toDate);
      const q = params.toString() ? `?${params.toString()}` : '';

      const [repRes, usersRes, specRes] = await Promise.all([
        apiRequest(`/admin/reports${q}`),
        apiRequest('/admin/users'),
        apiRequest('/specializations')
      ]);

      setReports(repRes);
      setUsers(usersRes.users || []);
      setSpecializations(specRes.specializations || []);
    } catch (err) {
      showToast(err.message, 'danger');
    } finally {
      setLoading(false);
    }
  }, [fromDate, toDate, showToast]);

  useEffect(() => {
    loadAll();
  }, [loadAll]);

  const handleExportCsv = async () => {
    try {
      const params = new URLSearchParams();
      if (fromDate) params.set('from_date', fromDate);
      if (toDate) params.set('to_date', toDate);
      const q = params.toString() ? `?${params.toString()}` : '';
      await downloadCsv(`/admin/reports/export-csv${q}`, 'raport-clinicaweb.csv');
      showToast('Raportul CSV a fost descărcat.', 'success');
    } catch (err) {
      showToast(err.message, 'danger');
    }
  };

  const handleExportExcel = () => {
    if (!reports) return;
    try {
      exportReportExcel(reports, { fromDate, toDate });
      showToast('Raportul Excel (.xlsx) a fost descărcat.', 'success');
    } catch (err) {
      showToast(err.message || 'Eroare la generarea fișierului Excel.', 'danger');
    }
  };

  const handleExportWord = async () => {
    if (!reports) return;
    try {
      await exportReportWord(reports, { fromDate, toDate });
      showToast('Raportul Word (.docx) a fost descărcat.', 'success');
    } catch (err) {
      showToast(err.message || 'Eroare la generarea fișierului Word.', 'danger');
    }
  };

  const handleExportPdf = () => {
    if (!reports) return;
    try {
      exportReportPdf(reports, { fromDate, toDate });
      showToast('Raportul PDF a fost descărcat.', 'success');
    } catch (err) {
      showToast(err.message || 'Eroare la generarea fișierului PDF.', 'danger');
    }
  };

  const handleCreateUser = async (e) => {
    e.preventDefault();
    try {
      await apiRequest('/admin/users', {
        method: 'POST',
        body: JSON.stringify(userForm)
      });
      showToast('Utilizatorul a fost creat cu succes.', 'success');
      setShowUserModal(false);
      setUserForm({
        full_name: '',
        email: '',
        password: '',
        phone: '',
        role: 'DOCTOR',
        specialization_id: '',
        cabinet_number: '',
        consultation_price: 220,
        bio: ''
      });
      loadAll();
    } catch (err) {
      showToast(err.message, 'danger');
    }
  };

  const handleToggleUserActive = async (u) => {
    try {
      await apiRequest(`/admin/users/${u.id}`, {
        method: 'PATCH',
        body: JSON.stringify({ is_active: !u.is_active })
      });
      showToast(
        u.is_active ? 'Contul a fost dezactivat.' : 'Contul a fost reactivat.',
        'info'
      );
      loadAll();
    } catch (err) {
      showToast(err.message, 'danger');
    }
  };

  const openScheduleEditor = async (u) => {
    try {
      const data = await apiRequest(`/doctors/${u.doctor_id}`);
      const existing = data.doctor.schedules || [];
      const rows = DAYS.map((d) => {
        const found = existing.find((s) => s.day_of_week === d.id);
        return {
          day_of_week: d.id,
          label: d.label,
          enabled: Boolean(found),
          start_time: found ? String(found.start_time).slice(0, 5) : '09:00',
          end_time: found ? String(found.end_time).slice(0, 5) : '17:00',
          slot_duration_minutes: found ? found.slot_duration_minutes : 30
        };
      });
      setScheduleDoctor(u);
      setScheduleRows(rows);
    } catch (err) {
      showToast(err.message, 'danger');
    }
  };

  const handleSaveSchedules = async (e) => {
    e.preventDefault();
    try {
      const payload = scheduleRows
        .filter((r) => r.enabled)
        .map((r) => ({
          day_of_week: r.day_of_week,
          start_time: r.start_time,
          end_time: r.end_time,
          slot_duration_minutes: Number(r.slot_duration_minutes)
        }));
      await apiRequest(`/admin/doctors/${scheduleDoctor.doctor_id}/schedules`, {
        method: 'PUT',
        body: JSON.stringify({ schedules: payload })
      });
      showToast('Orarul medicului a fost salvat.', 'success');
      setScheduleDoctor(null);
      loadAll();
    } catch (err) {
      showToast(err.message, 'danger');
    }
  };

  const handleSaveSpecialization = async (e) => {
    e.preventDefault();
    try {
      if (specForm.id) {
        await apiRequest(`/admin/specializations/${specForm.id}`, {
          method: 'PUT',
          body: JSON.stringify({ name: specForm.name, description: specForm.description })
        });
        showToast('Specializarea a fost actualizată.', 'success');
      } else {
        await apiRequest('/admin/specializations', {
          method: 'POST',
          body: JSON.stringify({ name: specForm.name, description: specForm.description })
        });
        showToast('Specializarea a fost adăugată.', 'success');
      }
      setSpecForm({ id: null, name: '', description: '' });
      loadAll();
    } catch (err) {
      showToast(err.message, 'danger');
    }
  };

  const handleDeleteSpecialization = async (id) => {
    if (!window.confirm('Ștergeți această specializare?')) return;
    try {
      await apiRequest(`/admin/specializations/${id}`, { method: 'DELETE' });
      showToast('Specializarea a fost ștearsă.', 'info');
      loadAll();
    } catch (err) {
      showToast(err.message, 'danger');
    }
  };

  const summary = reports?.summary;

  return (
    <div className="container">
      <div className="d-flex flex-wrap justify-content-between align-items-center gap-3 mb-4">
        <div>
          <h3 className="cw-section-title mb-1">
            <i className="bi bi-bar-chart-line-fill text-primary me-2" />
            Panou Administrativ & Rapoarte
          </h3>
          <p className="text-muted small mb-0">
            Indicatori KPI în timp real, gestiune medici, recepționeri, specializări și orare
          </p>
        </div>
        <div className="d-flex flex-wrap gap-2">
          <button
            type="button"
            className="btn btn-cw-teal fw-semibold"
            onClick={handleExportCsv}
            disabled={!reports}
          >
            <i className="bi bi-filetype-csv me-1" />
            CSV
          </button>
          <button
            type="button"
            className="btn btn-success fw-semibold"
            onClick={handleExportExcel}
            disabled={!reports}
          >
            <i className="bi bi-file-earmark-excel me-1" />
            Excel
          </button>
          <button
            type="button"
            className="btn btn-primary fw-semibold"
            onClick={handleExportWord}
            disabled={!reports}
          >
            <i className="bi bi-file-earmark-word me-1" />
            Word
          </button>
          <button
            type="button"
            className="btn btn-danger fw-semibold"
            onClick={handleExportPdf}
            disabled={!reports}
          >
            <i className="bi bi-file-earmark-pdf me-1" />
            PDF
          </button>
        </div>
      </div>

      {/* KPI Cards */}
      {summary && (
        <div className="row g-3 mb-4">
          <div className="col-sm-6 col-lg-3">
            <div className="cw-card cw-kpi-card p-3">
              <div className="small text-muted">Total Programări</div>
              <div className="fs-3 fw-bold text-dark">{summary.total_appointments}</div>
              <div className="small text-muted">
                {summary.confirmed_count} confirmate • {summary.completed_count} finalizate
              </div>
            </div>
          </div>
          <div className="col-sm-6 col-lg-3">
            <div className="cw-card cw-kpi-card teal p-3">
              <div className="small text-muted">Rată Confirmare / Anulare</div>
              <div className="fs-3 fw-bold text-success">{summary.confirmation_rate}%</div>
              <div className="small text-danger">Rată anulare: {summary.cancellation_rate}%</div>
            </div>
          </div>
          <div className="col-sm-6 col-lg-3">
            <div className="cw-card cw-kpi-card navy p-3">
              <div className="small text-muted">Încasări la Recepție</div>
              <div className="fs-3 fw-bold text-primary">
                {summary.total_revenue_paid.toFixed(0)} RON
              </div>
              <div className="small text-muted">
                Neîncasat: {summary.total_revenue_unpaid.toFixed(0)} RON
              </div>
            </div>
          </div>
          <div className="col-sm-6 col-lg-3">
            <div className="cw-card cw-kpi-card warning p-3">
              <div className="small text-muted">Medici / Pacienți Activi</div>
              <div className="fs-3 fw-bold text-dark">
                {reports.users_by_role?.DOCTOR || 0} / {reports.users_by_role?.PATIENT || 0}
              </div>
              <div className="small text-muted">
                Recepție: {reports.users_by_role?.RECEPTIONIST || 0} conturi
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Tabs */}
      <ul className="nav nav-pills mb-3 gap-2">
        <li className="nav-item">
          <button
            type="button"
            className={`nav-link ${activeTab === 'reports' ? 'active' : 'bg-white border text-dark'}`}
            onClick={() => setActiveTab('reports')}
          >
            <i className="bi bi-graph-up me-1" /> Rapoarte & Ocupare
          </button>
        </li>
        <li className="nav-item">
          <button
            type="button"
            className={`nav-link ${activeTab === 'users' ? 'active' : 'bg-white border text-dark'}`}
            onClick={() => setActiveTab('users')}
          >
            <i className="bi bi-people me-1" /> Utilizatori & Orare ({users.length})
          </button>
        </li>
        <li className="nav-item">
          <button
            type="button"
            className={`nav-link ${activeTab === 'specializations' ? 'active' : 'bg-white border text-dark'}`}
            onClick={() => setActiveTab('specializations')}
          >
            <i className="bi bi-tags me-1" /> Specializări ({specializations.length})
          </button>
        </li>
      </ul>

      {loading ? (
        <div className="cw-card p-5 text-center">
          <div className="spinner-border text-primary" />
        </div>
      ) : activeTab === 'reports' ? (
        <div className="d-flex flex-column gap-4">
          <div className="cw-card p-3">
            <div className="row g-2 align-items-end">
              <div className="col-md-3">
                <label className="form-label small fw-semibold mb-1">De la data</label>
                <input
                  type="date"
                  className="form-control form-control-sm"
                  value={fromDate}
                  onChange={(e) => setFromDate(e.target.value)}
                />
              </div>
              <div className="col-md-3">
                <label className="form-label small fw-semibold mb-1">Până la data</label>
                <input
                  type="date"
                  className="form-control form-control-sm"
                  value={toDate}
                  onChange={(e) => setToDate(e.target.value)}
                />
              </div>
              <div className="col-md-2">
                <button
                  type="button"
                  className="btn btn-sm btn-outline-secondary w-100"
                  onClick={() => {
                    setFromDate('');
                    setToDate('');
                  }}
                >
                  Toată perioada
                </button>
              </div>
            </div>
          </div>

          <div className="cw-card p-4">
            <h5 className="fw-bold mb-3">Grad de Ocupare & Încasări per Medic</h5>
            <div className="table-responsive">
              <table className="table align-middle small mb-0">
                <thead className="table-light">
                  <tr>
                    <th>Medic</th>
                    <th>Specializare</th>
                    <th>Programări</th>
                    <th>Anulate</th>
                    <th style={{ width: 200 }}>Grad Ocupare</th>
                    <th className="text-end">Încasări Recepție</th>
                  </tr>
                </thead>
                <tbody>
                  {(reports?.by_doctor || []).map((doc) => (
                    <tr key={doc.doctor_id}>
                      <td className="fw-semibold">{doc.doctor_name}</td>
                      <td>{doc.specialization_name}</td>
                      <td>{doc.total_appointments}</td>
                      <td>{doc.cancelled_count}</td>
                      <td>
                        <div className="d-flex align-items-center gap-2">
                          <div className="progress flex-grow-1" style={{ height: 8 }}>
                            <div
                              className="progress-bar bg-success"
                              style={{ width: `${doc.occupancy_rate}%` }}
                            />
                          </div>
                          <span className="fw-semibold">{doc.occupancy_rate}%</span>
                        </div>
                      </td>
                      <td className="text-end fw-bold text-primary">
                        {doc.paid_revenue.toFixed(0)} RON
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          <div className="cw-card p-4">
            <h5 className="fw-bold mb-3">Situație per Specializare Medicală</h5>
            <div className="table-responsive">
              <table className="table align-middle small mb-0">
                <thead className="table-light">
                  <tr>
                    <th>Specializare</th>
                    <th>Nr. Medici</th>
                    <th>Total Programări</th>
                    <th>Active / Finalizate</th>
                    <th className="text-end">Încasări Recepție</th>
                  </tr>
                </thead>
                <tbody>
                  {(reports?.by_specialization || []).map((sp) => (
                    <tr key={sp.specialization_id}>
                      <td className="fw-semibold">{sp.specialization_name}</td>
                      <td>{sp.doctors_count}</td>
                      <td>{sp.total_appointments}</td>
                      <td>{sp.active_appointments}</td>
                      <td className="text-end fw-bold">{sp.paid_revenue.toFixed(0)} RON</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      ) : activeTab === 'users' ? (
        <div className="cw-card p-4">
          <div className="d-flex justify-content-between align-items-center mb-3">
            <h5 className="fw-bold mb-0">Gestiune Conturi Utilizatori & Medici</h5>
            <button
              type="button"
              className="btn btn-sm btn-cw-primary"
              onClick={() => setShowUserModal(true)}
            >
              <i className="bi bi-person-plus me-1" />
              Adaugă Utilizator / Medic
            </button>
          </div>
          <div className="table-responsive">
            <table className="table table-hover align-middle small mb-0">
              <thead className="table-light">
                <tr>
                  <th>Nume</th>
                  <th>Email / Telefon</th>
                  <th>Rol</th>
                  <th>Detalii Medic</th>
                  <th>Status</th>
                  <th className="text-end">Acțiuni</th>
                </tr>
              </thead>
              <tbody>
                {users.map((u) => (
                  <tr key={u.id}>
                    <td className="fw-semibold">{u.full_name}</td>
                    <td>
                      <div>{u.email}</div>
                      <div className="text-muted">{u.phone || '—'}</div>
                    </td>
                    <td>
                      <span className="badge text-bg-light border text-dark">{u.role}</span>
                    </td>
                    <td>
                      {u.doctor_id ? (
                        <div>
                          {u.specialization_name} • Cab. {u.cabinet_number} •{' '}
                          {Number(u.consultation_price).toFixed(0)} RON
                        </div>
                      ) : (
                        '—'
                      )}
                    </td>
                    <td>
                      <span className={`badge ${u.is_active ? 'text-bg-success' : 'text-bg-secondary'}`}>
                        {u.is_active ? 'Activ' : 'Dezactivat'}
                      </span>
                    </td>
                    <td className="text-end">
                      {u.doctor_id && (
                        <button
                          type="button"
                          className="btn btn-sm btn-outline-primary me-1"
                          onClick={() => openScheduleEditor(u)}
                        >
                          <i className="bi bi-clock me-1" />
                          Orar
                        </button>
                      )}
                      <button
                        type="button"
                        className={`btn btn-sm ${
                          u.is_active ? 'btn-outline-danger' : 'btn-outline-success'
                        }`}
                        onClick={() => handleToggleUserActive(u)}
                      >
                        {u.is_active ? 'Dezactivează' : 'Activează'}
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      ) : (
        <div className="row g-4">
          <div className="col-md-5">
            <div className="cw-card p-4">
              <h5 className="fw-bold mb-3">
                {specForm.id ? 'Editează Specializarea' : 'Adaugă Specializare Nouă'}
              </h5>
              <form onSubmit={handleSaveSpecialization}>
                <div className="mb-3">
                  <label className="form-label small fw-semibold">Denumire</label>
                  <input
                    type="text"
                    className="form-control"
                    value={specForm.name}
                    onChange={(e) => setSpecForm({ ...specForm, name: e.target.value })}
                    required
                  />
                </div>
                <div className="mb-3">
                  <label className="form-label small fw-semibold">Descriere</label>
                  <textarea
                    className="form-control"
                    rows={3}
                    value={specForm.description}
                    onChange={(e) => setSpecForm({ ...specForm, description: e.target.value })}
                  />
                </div>
                <div className="d-flex gap-2">
                  <button type="submit" className="btn btn-cw-primary">
                    {specForm.id ? 'Actualizează' : 'Adaugă'}
                  </button>
                  {specForm.id && (
                    <button
                      type="button"
                      className="btn btn-outline-secondary"
                      onClick={() => setSpecForm({ id: null, name: '', description: '' })}
                    >
                      Anulează
                    </button>
                  )}
                </div>
              </form>
            </div>
          </div>

          <div className="col-md-7">
            <div className="cw-card p-4">
              <h5 className="fw-bold mb-3">Specializări Existente</h5>
              <div className="list-group list-group-flush">
                {specializations.map((s) => (
                  <div
                    key={s.id}
                    className="list-group-item px-0 d-flex justify-content-between align-items-center"
                  >
                    <div>
                      <div className="fw-semibold">
                        {s.name}{' '}
                        <span className="badge text-bg-light border ms-1">
                          {s.doctors_count} medici
                        </span>
                      </div>
                      <div className="small text-muted">{s.description || '—'}</div>
                    </div>
                    <div className="btn-group btn-group-sm">
                      <button
                        type="button"
                        className="btn btn-outline-primary"
                        onClick={() =>
                          setSpecForm({
                            id: s.id,
                            name: s.name,
                            description: s.description || ''
                          })
                        }
                      >
                        <i className="bi bi-pencil" />
                      </button>
                      <button
                        type="button"
                        className="btn btn-outline-danger"
                        onClick={() => handleDeleteSpecialization(s.id)}
                      >
                        <i className="bi bi-trash" />
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Create User Modal */}
      {showUserModal && (
        <div className="modal d-block" style={{ backgroundColor: 'rgba(15, 29, 53, 0.55)' }}>
          <div className="modal-dialog modal-lg">
            <form className="modal-content" onSubmit={handleCreateUser}>
              <div className="modal-header">
                <h5 className="modal-title fw-bold">Creare Cont Utilizator</h5>
                <button
                  type="button"
                  className="btn-close"
                  onClick={() => setShowUserModal(false)}
                />
              </div>
              <div className="modal-body">
                <div className="row g-3">
                  <div className="col-md-6">
                    <label className="form-label small fw-semibold">Nume complet</label>
                    <input
                      type="text"
                      className="form-control"
                      required
                      value={userForm.full_name}
                      onChange={(e) => setUserForm({ ...userForm, full_name: e.target.value })}
                    />
                  </div>
                  <div className="col-md-6">
                    <label className="form-label small fw-semibold">Email</label>
                    <input
                      type="email"
                      className="form-control"
                      required
                      value={userForm.email}
                      onChange={(e) => setUserForm({ ...userForm, email: e.target.value })}
                    />
                  </div>
                  <div className="col-md-4">
                    <label className="form-label small fw-semibold">Parolă inițială</label>
                    <input
                      type="password"
                      className="form-control"
                      minLength={6}
                      required
                      value={userForm.password}
                      onChange={(e) => setUserForm({ ...userForm, password: e.target.value })}
                    />
                  </div>
                  <div className="col-md-4">
                    <label className="form-label small fw-semibold">Telefon</label>
                    <input
                      type="tel"
                      className="form-control"
                      value={userForm.phone}
                      onChange={(e) => setUserForm({ ...userForm, phone: e.target.value })}
                    />
                  </div>
                  <div className="col-md-4">
                    <label className="form-label small fw-semibold">Rol</label>
                    <select
                      className="form-select"
                      value={userForm.role}
                      onChange={(e) => setUserForm({ ...userForm, role: e.target.value })}
                    >
                      <option value="DOCTOR">Medic (DOCTOR)</option>
                      <option value="RECEPTIONIST">Recepționer (RECEPTIONIST)</option>
                      <option value="ADMIN">Administrator (ADMIN)</option>
                      <option value="PATIENT">Pacient (PATIENT)</option>
                    </select>
                  </div>

                  {userForm.role === 'DOCTOR' && (
                    <>
                      <div className="col-md-5">
                        <label className="form-label small fw-semibold">Specializare</label>
                        <select
                          className="form-select"
                          required
                          value={userForm.specialization_id}
                          onChange={(e) =>
                            setUserForm({ ...userForm, specialization_id: e.target.value })
                          }
                        >
                          <option value="">-- Selectați --</option>
                          {specializations.map((s) => (
                            <option key={s.id} value={s.id}>
                              {s.name}
                            </option>
                          ))}
                        </select>
                      </div>
                      <div className="col-md-3">
                        <label className="form-label small fw-semibold">Cabinet</label>
                        <input
                          type="text"
                          className="form-control"
                          placeholder="Ex: C-105"
                          required
                          value={userForm.cabinet_number}
                          onChange={(e) =>
                            setUserForm({ ...userForm, cabinet_number: e.target.value })
                          }
                        />
                      </div>
                      <div className="col-md-4">
                        <label className="form-label small fw-semibold">Tarif (RON)</label>
                        <input
                          type="number"
                          min={50}
                          className="form-control"
                          required
                          value={userForm.consultation_price}
                          onChange={(e) =>
                            setUserForm({
                              ...userForm,
                              consultation_price: Number(e.target.value)
                            })
                          }
                        />
                      </div>
                      <div className="col-12">
                        <label className="form-label small fw-semibold">Descriere / Bio</label>
                        <textarea
                          className="form-control"
                          rows={2}
                          value={userForm.bio}
                          onChange={(e) => setUserForm({ ...userForm, bio: e.target.value })}
                        />
                      </div>
                    </>
                  )}
                </div>
              </div>
              <div className="modal-footer">
                <button
                  type="button"
                  className="btn btn-outline-secondary"
                  onClick={() => setShowUserModal(false)}
                >
                  Anulează
                </button>
                <button type="submit" className="btn btn-cw-primary">
                  Creează Cont
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Doctor Schedule Editor Modal */}
      {scheduleDoctor && (
        <div className="modal d-block" style={{ backgroundColor: 'rgba(15, 29, 53, 0.55)' }}>
          <div className="modal-dialog modal-lg">
            <form className="modal-content" onSubmit={handleSaveSchedules}>
              <div className="modal-header">
                <h5 className="modal-title fw-bold">
                  Orar Săptămânal — {scheduleDoctor.full_name}
                </h5>
                <button
                  type="button"
                  className="btn-close"
                  onClick={() => setScheduleDoctor(null)}
                />
              </div>
              <div className="modal-body">
                {scheduleRows.map((row, idx) => (
                  <div key={row.day_of_week} className="row g-2 align-items-center mb-2">
                    <div className="col-md-3">
                      <div className="form-check">
                        <input
                          type="checkbox"
                          className="form-check-input"
                          id={`day-${row.day_of_week}`}
                          checked={row.enabled}
                          onChange={(e) => {
                            const next = [...scheduleRows];
                            next[idx] = { ...row, enabled: e.target.checked };
                            setScheduleRows(next);
                          }}
                        />
                        <label className="form-check-label fw-semibold" htmlFor={`day-${row.day_of_week}`}>
                          {row.label}
                        </label>
                      </div>
                    </div>
                    <div className="col-md-3">
                      <input
                        type="time"
                        className="form-control form-control-sm"
                        disabled={!row.enabled}
                        value={row.start_time}
                        onChange={(e) => {
                          const next = [...scheduleRows];
                          next[idx] = { ...row, start_time: e.target.value };
                          setScheduleRows(next);
                        }}
                      />
                    </div>
                    <div className="col-md-3">
                      <input
                        type="time"
                        className="form-control form-control-sm"
                        disabled={!row.enabled}
                        value={row.end_time}
                        onChange={(e) => {
                          const next = [...scheduleRows];
                          next[idx] = { ...row, end_time: e.target.value };
                          setScheduleRows(next);
                        }}
                      />
                    </div>
                    <div className="col-md-3">
                      <select
                        className="form-select form-select-sm"
                        disabled={!row.enabled}
                        value={row.slot_duration_minutes}
                        onChange={(e) => {
                          const next = [...scheduleRows];
                          next[idx] = {
                            ...row,
                            slot_duration_minutes: Number(e.target.value)
                          };
                          setScheduleRows(next);
                        }}
                      >
                        <option value={20}>Slot 20 min</option>
                        <option value={30}>Slot 30 min</option>
                        <option value={45}>Slot 45 min</option>
                        <option value={60}>Slot 60 min</option>
                      </select>
                    </div>
                  </div>
                ))}
              </div>
              <div className="modal-footer">
                <button
                  type="button"
                  className="btn btn-outline-secondary"
                  onClick={() => setScheduleDoctor(null)}
                >
                  Anulează
                </button>
                <button type="submit" className="btn btn-cw-primary">
                  Salvează Orarul
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
