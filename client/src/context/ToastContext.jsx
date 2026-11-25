import React, { createContext, useContext, useState, useCallback } from 'react';

const ToastContext = createContext(null);

export function ToastProvider({ children }) {
  const [toasts, setToasts] = useState([]);

  const showToast = useCallback((message, type = 'success') => {
    const id = Date.now() + Math.random();
    setToasts((prev) => [...prev, { id, message, type }]);
    setTimeout(() => {
      setToasts((prev) => prev.filter((t) => t.id !== id));
    }, 4500);
  }, []);

  const removeToast = (id) => {
    setToasts((prev) => prev.filter((t) => t.id !== id));
  };

  const bgClass = (type) => {
    if (type === 'danger' || type === 'error') return 'text-bg-danger';
    if (type === 'warning') return 'text-bg-warning';
    if (type === 'info') return 'text-bg-primary';
    return 'text-bg-success';
  };

  return (
    <ToastContext.Provider value={{ showToast }}>
      {children}
      <div className="cw-toast-container no-print">
        {toasts.map((t) => (
          <div
            key={t.id}
            className={`toast show align-items-center border-0 shadow ${bgClass(t.type)}`}
            role="alert"
          >
            <div className="d-flex">
              <div className="toast-body fw-medium">{t.message}</div>
              <button
                type="button"
                className="btn-close btn-close-white me-2 m-auto"
                aria-label="Închide"
                onClick={() => removeToast(t.id)}
              />
            </div>
          </div>
        ))}
      </div>
    </ToastContext.Provider>
  );
}

export function useToast() {
  const ctx = useContext(ToastContext);
  if (!ctx) throw new Error('useToast must be used inside ToastProvider');
  return ctx;
}
