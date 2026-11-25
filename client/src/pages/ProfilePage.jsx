import React, { useState } from 'react';
import { useAuth } from '../context/AuthContext';
import { useToast } from '../context/ToastContext';
import { apiRequest } from '../services/api';

export default function ProfilePage() {
  const { user, refreshUser } = useAuth();
  const { showToast } = useToast();

  const [fullName, setFullName] = useState(user?.full_name || '');
  const [phone, setPhone] = useState(user?.phone || '');
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [saving, setSaving] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setSaving(true);
    try {
      await apiRequest('/auth/me', {
        method: 'PATCH',
        body: JSON.stringify({
          full_name: fullName,
          phone,
          ...(newPassword ? { current_password: currentPassword, new_password: newPassword } : {})
        })
      });
      await refreshUser();
      setCurrentPassword('');
      setNewPassword('');
      showToast('Profilul a fost actualizat cu succes.', 'success');
    } catch (err) {
      showToast(err.message, 'danger');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="container">
      <div className="row justify-content-center">
        <div className="col-lg-6">
          <div className="cw-card p-4">
            <h4 className="cw-section-title mb-3">
              <i className="bi bi-person-badge me-2 text-primary" />
              Profilul Meu
            </h4>

            <form onSubmit={handleSubmit}>
              <div className="mb-3">
                <label className="form-label small fw-semibold">Adresă de email</label>
                <input type="email" className="form-control" value={user?.email || ''} disabled />
              </div>

              <div className="mb-3">
                <label className="form-label small fw-semibold">Nume complet</label>
                <input
                  type="text"
                  className="form-control"
                  value={fullName}
                  onChange={(e) => setFullName(e.target.value)}
                  required
                />
              </div>

              <div className="mb-3">
                <label className="form-label small fw-semibold">Telefon</label>
                <input
                  type="tel"
                  className="form-control"
                  value={phone}
                  onChange={(e) => setPhone(e.target.value)}
                />
              </div>

              <hr className="my-4" />
              <h6 className="fw-bold mb-3">Schimbare parolă (opțional)</h6>

              <div className="mb-3">
                <label className="form-label small fw-semibold">Parola actuală</label>
                <input
                  type="password"
                  className="form-control"
                  value={currentPassword}
                  onChange={(e) => setCurrentPassword(e.target.value)}
                />
              </div>

              <div className="mb-4">
                <label className="form-label small fw-semibold">Parola nouă</label>
                <input
                  type="password"
                  className="form-control"
                  value={newPassword}
                  onChange={(e) => setNewPassword(e.target.value)}
                  minLength={6}
                />
              </div>

              <button type="submit" className="btn btn-cw-primary" disabled={saving}>
                {saving ? 'Se salvează...' : 'Salvează modificările'}
              </button>
            </form>
          </div>
        </div>
      </div>
    </div>
  );
}
