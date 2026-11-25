import React, { useEffect, useState, useCallback } from 'react';
import { Link, NavLink, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { apiRequest } from '../services/api';

const ROLE_LABELS = {
  PATIENT: 'Pacient',
  RECEPTIONIST: 'Recepționer',
  DOCTOR: 'Medic',
  ADMIN: 'Administrator'
};

export function getDashboardPathForRole(role) {
  switch (role) {
    case 'ADMIN':
      return '/admin';
    case 'RECEPTIONIST':
      return '/receptie';
    case 'DOCTOR':
      return '/medic';
    case 'PATIENT':
      return '/pacient';
    default:
      return '/';
  }
}

export default function Navbar() {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const [notifications, setNotifications] = useState([]);
  const [showNotif, setShowNotif] = useState(false);

  const loadNotifications = useCallback(async () => {
    if (!user) {
      setNotifications([]);
      return;
    }
    try {
      const data = await apiRequest('/notifications');
      setNotifications(data.notifications || []);
    } catch {
      // Non-blocking
    }
  }, [user]);

  useEffect(() => {
    loadNotifications();
  }, [loadNotifications]);

  const unreadCount = notifications.filter((n) => !n.is_read).length;

  const handleMarkAllRead = async () => {
    try {
      await apiRequest('/notifications/read-all', { method: 'PATCH' });
      setNotifications((prev) => prev.map((n) => ({ ...n, is_read: 1 })));
    } catch {
      // Ignore
    }
  };

  const handleLogout = () => {
    logout();
    navigate('/login');
  };

  return (
    <nav className="navbar navbar-expand-lg navbar-dark cw-navbar sticky-top no-print">
      <div className="container">
        <Link className="navbar-brand d-flex align-items-center gap-2 fw-bold" to="/">
          <span className="cw-brand-icon">
            <i className="bi bi-heart-pulse-fill" />
          </span>
          <span>ClinicaWeb</span>
        </Link>

        <button
          className="navbar-toggler"
          type="button"
          data-bs-toggle="collapse"
          data-bs-target="#cwMainNav"
          aria-controls="cwMainNav"
          aria-expanded="false"
          aria-label="Deschide meniul"
        >
          <span className="navbar-toggler-icon" />
        </button>

        <div className="collapse navbar-collapse" id="cwMainNav">
          <ul className="navbar-nav me-auto mb-2 mb-lg-0 ms-lg-3">
            <li className="nav-item">
              <NavLink className="nav-link" to="/" end>
                <i className="bi bi-hospital me-1" />
                Catalog Medici
              </NavLink>
            </li>

            {user && (
              <li className="nav-item">
                <NavLink className="nav-link" to={getDashboardPathForRole(user.role)}>
                  <i className="bi bi-speedometer2 me-1" />
                  Panou {ROLE_LABELS[user.role]}
                </NavLink>
              </li>
            )}

            {user?.role === 'PATIENT' && (
              <li className="nav-item">
                <NavLink className="nav-link" to="/programare-noua">
                  <i className="bi bi-calendar-plus me-1" />
                  Programare Nouă
                </NavLink>
              </li>
            )}
          </ul>

          <div className="d-flex align-items-center gap-2">
            {user ? (
              <>
                <div className="position-relative">
                  <button
                    type="button"
                    className="btn btn-outline-light btn-sm position-relative"
                    onClick={() => {
                      const next = !showNotif;
                      setShowNotif(next);
                      if (next) loadNotifications();
                    }}
                    title="Notificări interne"
                  >
                    <i className="bi bi-bell-fill" />
                    {unreadCount > 0 && (
                      <span className="position-absolute top-0 start-100 translate-middle badge rounded-pill bg-danger">
                        {unreadCount}
                      </span>
                    )}
                  </button>

                  {showNotif && (
                    <div
                      className="card shadow-lg position-absolute end-0 mt-2"
                      style={{ width: 340, maxHeight: 380, zIndex: 1050 }}
                    >
                      <div className="card-header d-flex justify-content-between align-items-center bg-light">
                        <strong className="small text-dark">Notificări</strong>
                        {unreadCount > 0 && (
                          <button
                            type="button"
                            className="btn btn-link btn-sm p-0 text-decoration-none"
                            onClick={handleMarkAllRead}
                          >
                            Marchează toate citite
                          </button>
                        )}
                      </div>
                      <div className="list-group list-group-flush overflow-auto" style={{ maxHeight: 310 }}>
                        {notifications.length === 0 ? (
                          <div className="p-3 text-center text-muted small">
                            Nu aveți notificări noi.
                          </div>
                        ) : (
                          notifications.map((n) => (
                            <div
                              key={n.id}
                              className={`list-group-item small ${n.is_read ? '' : 'bg-light'}`}
                            >
                              <div className="d-flex justify-content-between">
                                <strong className="text-dark">{n.title}</strong>
                                {!n.is_read && <span className="badge bg-primary">Nou</span>}
                              </div>
                              <div className="text-muted mt-1">{n.message}</div>
                            </div>
                          ))
                        )}
                      </div>
                    </div>
                  )}
                </div>

                <Link
                  to="/profil"
                  className="btn btn-sm btn-outline-light d-flex align-items-center gap-2"
                >
                  <i className="bi bi-person-circle" />
                  <span className="d-none d-md-inline">{user.full_name}</span>
                  <span className="badge text-bg-info">{ROLE_LABELS[user.role]}</span>
                </Link>

                <button
                  type="button"
                  className="btn btn-sm btn-danger"
                  onClick={handleLogout}
                  title="Deconectare"
                >
                  <i className="bi bi-box-arrow-right me-1" />
                  <span className="d-none d-sm-inline">Ieșire</span>
                </button>
              </>
            ) : (
              <>
                <Link to="/login" className="btn btn-outline-light btn-sm">
                  <i className="bi bi-box-arrow-in-right me-1" />
                  Autentificare
                </Link>
                <Link to="/inregistrare" className="btn btn-cw-teal btn-sm">
                  <i className="bi bi-person-plus me-1" />
                  Cont Pacient
                </Link>
              </>
            )}
          </div>
        </div>
      </div>
    </nav>
  );
}
