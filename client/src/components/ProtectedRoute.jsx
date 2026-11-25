import React from 'react';
import { Navigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { getDashboardPathForRole } from './Navbar';

export default function ProtectedRoute({ allowedRoles, children }) {
  const { user, loading } = useAuth();

  if (loading) {
    return (
      <div className="container py-5 text-center">
        <div className="spinner-border text-primary" role="status" />
        <p className="text-muted mt-2">Se verifică sesiunea...</p>
      </div>
    );
  }

  if (!user) {
    return <Navigate to="/login" replace />;
  }

  if (allowedRoles && !allowedRoles.includes(user.role)) {
    return <Navigate to={getDashboardPathForRole(user.role)} replace />;
  }

  return children;
}
