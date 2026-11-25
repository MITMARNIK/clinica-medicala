import React from 'react';
import { Routes, Route, Navigate } from 'react-router-dom';
import Navbar from './components/Navbar';
import ProtectedRoute from './components/ProtectedRoute';

import HomePage from './pages/HomePage';
import LoginPage from './pages/LoginPage';
import RegisterPage from './pages/RegisterPage';
import BookAppointmentPage from './pages/BookAppointmentPage';
import PatientDashboard from './pages/PatientDashboard';
import ReceptionDashboard from './pages/ReceptionDashboard';
import DoctorDashboard from './pages/DoctorDashboard';
import AdminDashboard from './pages/AdminDashboard';
import ProfilePage from './pages/ProfilePage';

export default function App() {
  return (
    <div className="d-flex flex-column min-vh-100">
      <Navbar />

      <main className="flex-grow-1 py-4">
        <Routes>
          <Route path="/" element={<HomePage />} />
          <Route path="/login" element={<LoginPage />} />
          <Route path="/inregistrare" element={<RegisterPage />} />

          <Route
            path="/programare-noua"
            element={
              <ProtectedRoute allowedRoles={['PATIENT']}>
                <BookAppointmentPage />
              </ProtectedRoute>
            }
          />

          <Route
            path="/pacient"
            element={
              <ProtectedRoute allowedRoles={['PATIENT']}>
                <PatientDashboard />
              </ProtectedRoute>
            }
          />

          <Route
            path="/receptie"
            element={
              <ProtectedRoute allowedRoles={['RECEPTIONIST', 'ADMIN']}>
                <ReceptionDashboard />
              </ProtectedRoute>
            }
          />

          <Route
            path="/medic"
            element={
              <ProtectedRoute allowedRoles={['DOCTOR']}>
                <DoctorDashboard />
              </ProtectedRoute>
            }
          />

          <Route
            path="/admin"
            element={
              <ProtectedRoute allowedRoles={['ADMIN']}>
                <AdminDashboard />
              </ProtectedRoute>
            }
          />

          <Route
            path="/profil"
            element={
              <ProtectedRoute allowedRoles={['PATIENT', 'RECEPTIONIST', 'DOCTOR', 'ADMIN']}>
                <ProfilePage />
              </ProtectedRoute>
            }
          />

          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </main>

      <footer className="bg-white border-top py-3 mt-auto no-print">
        <div className="container d-flex flex-column flex-sm-row justify-content-between align-items-center small text-muted">
          <span>
            <strong>ClinicaWeb</strong> — Sistem Integrat de Gestiune a Clinicii Medicale
          </span>
          <span>Conformitate GDPR • Program Luni–Vineri • Date demonstrative sintetice</span>
        </div>
      </footer>
    </div>
  );
}
