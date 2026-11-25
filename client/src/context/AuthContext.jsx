import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';
import { apiRequest, clearStoredAuth, getStoredToken, setStoredAuth } from '../services/api';

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [user, setUser] = useState(() => {
    try {
      const saved = localStorage.getItem('clinicaweb_user');
      return saved ? JSON.parse(saved) : null;
    } catch {
      return null;
    }
  });
  const [loading, setLoading] = useState(Boolean(getStoredToken()));

  const refreshUser = useCallback(async () => {
    const token = getStoredToken();
    if (!token) {
      setUser(null);
      setLoading(false);
      return;
    }
    try {
      const data = await apiRequest('/auth/me');
      setUser(data.user);
      localStorage.setItem('clinicaweb_user', JSON.stringify(data.user));
    } catch {
      clearStoredAuth();
      setUser(null);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    refreshUser();
  }, [refreshUser]);

  const login = async (email, password) => {
    const data = await apiRequest('/auth/login', {
      method: 'POST',
      body: JSON.stringify({ email, password })
    });
    setStoredAuth(data.token, data.user);
    setUser(data.user);
    return data.user;
  };

  const register = async (payload) => {
    const data = await apiRequest('/auth/register', {
      method: 'POST',
      body: JSON.stringify(payload)
    });
    setStoredAuth(data.token, data.user);
    setUser(data.user);
    return data.user;
  };

  const logout = () => {
    clearStoredAuth();
    setUser(null);
  };

  return (
    <AuthContext.Provider value={{ user, loading, login, register, logout, refreshUser }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used inside AuthProvider');
  return ctx;
}
