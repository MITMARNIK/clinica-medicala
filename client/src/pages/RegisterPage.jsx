import React, { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { useToast } from '../context/ToastContext';

export default function RegisterPage() {
  const { register } = useAuth();
  const { showToast } = useToast();
  const navigate = useNavigate();

  const [form, setForm] = useState({
    full_name: '',
    email: '',
    phone: '',
    password: '',
    confirmPassword: ''
  });
  const [error, setError] = useState('');
  const [submitting, setSubmitting] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');

    if (form.password !== form.confirmPassword) {
      setError('Parolele introduse nu coincid.');
      return;
    }

    setSubmitting(true);
    try {
      await register({
        full_name: form.full_name,
        email: form.email,
        phone: form.phone,
        password: form.password
      });
      showToast('Contul de pacient a fost creat cu succes!', 'success');
      navigate('/pacient');
    } catch (err) {
      setError(err.message);
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="container">
      <div className="row justify-content-center">
        <div className="col-md-7 col-lg-5">
          <div className="cw-card p-4 p-md-5">
            <h3 className="cw-section-title text-center mb-1">Înregistrare Pacient</h3>
            <p className="text-muted small text-center mb-4">
              Creați un cont pentru a face programări online și a accesa fișele medicale
            </p>

            {error && (
              <div className="alert alert-danger py-2 small" role="alert">
                {error}
              </div>
            )}

            <form onSubmit={handleSubmit}>
              <div className="mb-3">
                <label className="form-label fw-semibold small">Nume și prenume</label>
                <input
                  type="text"
                  className="form-control"
                  placeholder="Ex: Maria Popescu"
                  value={form.full_name}
                  onChange={(e) => setForm({ ...form, full_name: e.target.value })}
                  required
                />
              </div>

              <div className="mb-3">
                <label className="form-label fw-semibold small">Adresă de email</label>
                <input
                  type="email"
                  className="form-control"
                  placeholder="maria.popescu@exemplu.ro"
                  value={form.email}
                  onChange={(e) => setForm({ ...form, email: e.target.value })}
                  required
                />
              </div>

              <div className="mb-3">
                <label className="form-label fw-semibold small">Telefon</label>
                <input
                  type="tel"
                  className="form-control"
                  placeholder="07xx xxx xxx"
                  value={form.phone}
                  onChange={(e) => setForm({ ...form, phone: e.target.value })}
                />
              </div>

              <div className="mb-3">
                <label className="form-label fw-semibold small">Parolă (minim 6 caractere)</label>
                <input
                  type="password"
                  className="form-control"
                  value={form.password}
                  onChange={(e) => setForm({ ...form, password: e.target.value })}
                  minLength={6}
                  required
                />
              </div>

              <div className="mb-4">
                <label className="form-label fw-semibold small">Confirmare parolă</label>
                <input
                  type="password"
                  className="form-control"
                  value={form.confirmPassword}
                  onChange={(e) => setForm({ ...form, confirmPassword: e.target.value })}
                  minLength={6}
                  required
                />
              </div>

              <button
                type="submit"
                className="btn btn-cw-teal w-100 py-2 fw-semibold"
                disabled={submitting}
              >
                {submitting ? 'Se creează contul...' : 'Creează cont'}
              </button>
            </form>

            <div className="text-center mt-3 small">
              Aveți deja un cont?{' '}
              <Link to="/login" className="fw-semibold text-decoration-none">
                Autentificați-vă aici
              </Link>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
