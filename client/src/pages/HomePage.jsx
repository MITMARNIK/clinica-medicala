import React, { useEffect, useState, useCallback } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { apiRequest } from '../services/api';
import { useAuth } from '../context/AuthContext';

const DAY_NAMES = {
  1: 'Lun',
  2: 'Mar',
  3: 'Mie',
  4: 'Joi',
  5: 'Vin'
};

export default function HomePage() {
  const { user } = useAuth();
  const navigate = useNavigate();

  const [specializations, setSpecializations] = useState([]);
  const [doctors, setDoctors] = useState([]);
  const [selectedSpec, setSelectedSpec] = useState('');
  const [search, setSearch] = useState('');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const loadSpecializations = useCallback(async () => {
    try {
      const data = await apiRequest('/specializations');
      setSpecializations(data.specializations || []);
    } catch (err) {
      setError(err.message);
    }
  }, []);

  const loadDoctors = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const params = new URLSearchParams();
      if (selectedSpec) params.set('specialization_id', selectedSpec);
      if (search.trim()) params.set('search', search.trim());
      const query = params.toString() ? `?${params.toString()}` : '';
      const data = await apiRequest(`/doctors${query}`);
      setDoctors(data.doctors || []);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }, [selectedSpec, search]);

  useEffect(() => {
    loadSpecializations();
  }, [loadSpecializations]);

  useEffect(() => {
    const timer = setTimeout(() => {
      loadDoctors();
    }, 200);
    return () => clearTimeout(timer);
  }, [loadDoctors]);

  const handleBookDoctor = (doctorId) => {
    if (!user) {
      navigate(`/login?redirect=/programare-noua?doctor=${doctorId}`);
      return;
    }
    if (user.role === 'PATIENT') {
      navigate(`/programare-noua?doctor=${doctorId}`);
    } else if (user.role === 'RECEPTIONIST' || user.role === 'ADMIN') {
      navigate('/receptie');
    } else {
      navigate('/medic');
    }
  };

  return (
    <div className="container">
      {/* Hero Section */}
      <div className="cw-hero mb-4">
        <div className="row align-items-center g-4">
          <div className="col-lg-8">
            <span className="badge bg-white text-dark mb-2 px-3 py-2 rounded-pill fw-semibold">
              <i className="bi bi-shield-check text-success me-1" />
              Programări Online Rapide • Fișă Medicală Electronică
            </span>
            <h1 className="display-6 fw-bold mb-2">
              Grijă medicală modernă, programări fără timp de așteptare
            </h1>
            <p className="mb-0 opacity-90">
              Căutați medicul potrivit după specializare, verificați programul de consultații în timp
              real și rezervați un slot disponibil în mai puțin de 2 minute.
            </p>
          </div>
          <div className="col-lg-4 text-lg-end">
            {!user ? (
              <div className="d-flex flex-wrap gap-2 justify-content-lg-end">
                <Link to="/inregistrare" className="btn btn-light fw-semibold px-4">
                  <i className="bi bi-person-plus me-2" />
                  Creează Cont Pacient
                </Link>
                <Link to="/login" className="btn btn-outline-light px-4">
                  Autentificare
                </Link>
              </div>
            ) : user.role === 'PATIENT' ? (
              <Link to="/programare-noua" className="btn btn-light btn-lg fw-semibold px-4">
                <i className="bi bi-calendar-check me-2 text-primary" />
                Programează o consultație
              </Link>
            ) : null}
          </div>
        </div>
      </div>

      {/* Filters */}
      <div className="cw-card p-3 p-md-4 mb-4">
        <div className="row g-3 align-items-center">
          <div className="col-md-6">
            <div className="input-group">
              <span className="input-group-text bg-white">
                <i className="bi bi-search text-muted" />
              </span>
              <input
                type="text"
                className="form-control"
                placeholder="Caută după numele medicului sau specializare..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
              />
              {search && (
                <button
                  type="button"
                  className="btn btn-outline-secondary"
                  onClick={() => setSearch('')}
                >
                  <i className="bi bi-x-lg" />
                </button>
              )}
            </div>
          </div>
          <div className="col-md-6">
            <div className="d-flex flex-wrap gap-2">
              <button
                type="button"
                className={`btn btn-sm rounded-pill ${
                  selectedSpec === '' ? 'btn-cw-primary' : 'btn-outline-secondary'
                }`}
                onClick={() => setSelectedSpec('')}
              >
                Toate specializările
              </button>
              {specializations.map((spec) => (
                <button
                  key={spec.id}
                  type="button"
                  className={`btn btn-sm rounded-pill ${
                    String(selectedSpec) === String(spec.id)
                      ? 'btn-cw-primary'
                      : 'btn-outline-secondary'
                  }`}
                  onClick={() => setSelectedSpec(String(spec.id))}
                >
                  {spec.name}
                </button>
              ))}
            </div>
          </div>
        </div>
      </div>

      {error && <div className="alert alert-danger">{error}</div>}

      {/* Doctors Grid */}
      {loading ? (
        <div className="text-center py-5">
          <div className="spinner-border text-primary" role="status" />
          <p className="text-muted mt-2">Se încarcă catalogul de medici...</p>
        </div>
      ) : doctors.length === 0 ? (
        <div className="cw-card p-5 text-center text-muted">
          <i className="bi bi-search fs-1 d-block mb-2" />
          Nu au fost găsiți medici care să corespundă criteriilor selectate.
        </div>
      ) : (
        <div className="row g-4">
          {doctors.map((doc) => (
            <div key={doc.id} className="col-md-6 col-lg-6">
              <div className="cw-card cw-card-hover p-4 h-100 d-flex flex-column">
                <div className="d-flex justify-content-between align-items-start gap-3 mb-2">
                  <div>
                    <span
                      className="badge rounded-pill mb-2"
                      style={{ backgroundColor: '#E6F7F5', color: '#0A685F' }}
                    >
                      <i className="bi bi-heart-pulse me-1" />
                      {doc.specialization_name}
                    </span>
                    <h5 className="fw-bold mb-1" style={{ color: '#0F1D35' }}>
                      {doc.full_name}
                    </h5>
                    <div className="small text-muted">
                      <i className="bi bi-door-open me-1" />
                      Cabinet {doc.cabinet_number}
                      {doc.phone && (
                        <>
                          <span className="mx-2">•</span>
                          <i className="bi bi-telephone me-1" />
                          {doc.phone}
                        </>
                      )}
                    </div>
                  </div>
                  <div className="text-end">
                    <div className="fs-5 fw-bold" style={{ color: '#1B4F8F' }}>
                      {Number(doc.consultation_price).toFixed(0)} RON
                    </div>
                    <div className="small text-muted">consultație</div>
                  </div>
                </div>

                {doc.bio && <p className="text-muted small mb-3">{doc.bio}</p>}

                <div className="mt-auto">
                  <div className="small fw-semibold text-dark mb-2">
                    <i className="bi bi-clock me-1 text-primary" />
                    Program de lucru (Luni – Vineri):
                  </div>
                  <div className="d-flex flex-wrap gap-1 mb-3">
                    {doc.schedules && doc.schedules.length > 0 ? (
                      doc.schedules.map((s) => (
                        <span key={s.id} className="badge text-bg-light border text-dark fw-normal">
                          <strong>{DAY_NAMES[s.day_of_week]}:</strong>{' '}
                          {String(s.start_time).slice(0, 5)}–{String(s.end_time).slice(0, 5)}
                        </span>
                      ))
                    ) : (
                      <span className="text-muted small">Orar neconfigurat</span>
                    )}
                  </div>

                  <button
                    type="button"
                    className="btn btn-cw-primary w-100 fw-semibold"
                    onClick={() => handleBookDoctor(doc.id)}
                  >
                    <i className="bi bi-calendar-plus me-2" />
                    {user?.role === 'RECEPTIONIST' || user?.role === 'ADMIN'
                      ? 'Gestionează în Agenda Clinicii'
                      : 'Programează consultație online'}
                  </button>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
