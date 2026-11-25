import React, { useState } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { useToast } from '../context/ToastContext';
import { getDashboardPathForRole } from '../components/Navbar';

const DEMO_ACCOUNTS = [
  { label: 'Administrator', email: 'admin@clinicaweb.ro', icon: 'bi-shield-lock-fill', color: 'btn-outline-dark' },
  { label: 'Recepționer', email: 'receptie@clinicaweb.ro', icon: 'bi-headset', color: 'btn-outline-primary' },
  { label: 'Medic (Cardiologie)', email: 'elena.popescu@clinicaweb.ro', icon: 'bi-heart-pulse-fill', color: 'btn-outline-success' },
  { label: 'Pacient Demo', email: 'andrei.dumitrescu@demo.ro', icon: 'bi-person-fill', color: 'btn-outline-secondary' }
];

export default function LoginPage() {
  const { login } = useAuth();
  const { showToast } = useToast();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [submitting, setSubmitting] = useState(false);

  const performLogin = async (targetEmail, targetPassword) => {
    setError('');
    setSubmitting(true);
    try {
      const loggedUser = await login(targetEmail, targetPassword);
      showToast(`Bine ați revenit, ${loggedUser.full_name}!`, 'success');
      const redirect = searchParams.get('redirect');
      if (redirect && loggedUser.role === 'PATIENT') {
        navigate(redirect);
      } else {
        navigate(getDashboardPathForRole(loggedUser.role));
      }
    } catch (err) {
      setError(err.message);
    } finally {
      setSubmitting(false);
    }
  };

  const handleSubmit = (e) => {
    e.preventDefault();
    performLogin(email, password);
  };

  const handleDemoLogin = (demoEmail) => {
    setEmail(demoEmail);
    setPassword('Clinica2026!');
    performLogin(demoEmail, 'Clinica2026!');
  };

  return (
    <div className="container">
      <div className="row justify-content-center">
        <div className="col-md-7 col-lg-5">
          <div className="cw-card p-4 p-md-5">
            <div className="text-center mb-4">
              <div className="cw-brand-icon mx-auto mb-3" style={{ width: 52, height: 52, fontSize: '1.5rem' }}>
                <i className="bi bi-heart-pulse-fill" />
              </div>
              <h3 className="cw-section-title mb-1">Autentificare ClinicaWeb</h3>
              <p className="text-muted small mb-0">
                Accesați portalul dedicat rolului dumneavoastră
              </p>
            </div>

            {error && (
              <div className="alert alert-danger py-2 small" role="alert">
                <i className="bi bi-exclamation-triangle-fill me-2" />
                {error}
              </div>
            )}

            <form onSubmit={handleSubmit}>
              <div className="mb-3">
                <label className="form-label fw-semibold small">Adresă de email</label>
                <input
                  type="email"
                  className="form-control"
                  placeholder="nume@exemplu.ro"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  required
                />
              </div>

              <div className="mb-4">
                <label className="form-label fw-semibold small">Parolă</label>
                <input
                  type="password"
                  className="form-control"
                  placeholder="Introduceți parola"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  required
                />
              </div>

              <button
                type="submit"
                className="btn btn-cw-primary w-100 py-2 fw-semibold"
                disabled={submitting}
              >
                {submitting ? 'Se autentifică...' : 'Intră în cont'}
              </button>
            </form>

            <div className="text-center mt-3 small">
              Nu aveți cont de pacient?{' '}
              <Link to="/inregistrare" className="fw-semibold text-decoration-none">
                Înregistrați-vă gratuit
              </Link>
            </div>

            {/* Discreet Demo Login quick buttons */}
            <hr className="my-4" />
            <div>
              <div className="d-flex justify-content-between align-items-center mb-2">
                <span className="small fw-semibold text-muted">
                  <i className="bi bi-lightning-charge-fill text-warning me-1" />
                  Demo Login Rapid
                </span>
                <span className="badge text-bg-light border text-muted">
                  Parolă: Clinica2026!
                </span>
              </div>
              <div className="row g-2">
                {DEMO_ACCOUNTS.map((acc) => (
                  <div key={acc.email} className="col-6">
                    <button
                      type="button"
                      className={`btn btn-sm w-100 ${acc.color}`}
                      disabled={submitting}
                      onClick={() => handleDemoLogin(acc.email)}
                    >
                      <i className={`bi ${acc.icon} me-1`} />
                      {acc.label}
                    </button>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
