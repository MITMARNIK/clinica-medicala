import React from 'react';

const APPOINTMENT_STATUS_META = {
  PENDING: { label: 'În așteptare', cls: 'text-bg-warning' },
  CONFIRMED: { label: 'Confirmată', cls: 'text-bg-primary' },
  COMPLETED: { label: 'Finalizată', cls: 'text-bg-success' },
  CANCELLED: { label: 'Anulată', cls: 'text-bg-secondary' }
};

const PAYMENT_STATUS_META = {
  UNPAID: { label: 'Neplătit', cls: 'bg-danger-subtle text-danger border border-danger-subtle' },
  PAID_AT_RECEPTION: {
    label: 'Plătit la recepție',
    cls: 'bg-success-subtle text-success border border-success-subtle'
  }
};

export function AppointmentStatusBadge({ status }) {
  const meta = APPOINTMENT_STATUS_META[status] || { label: status, cls: 'text-bg-light' };
  return <span className={`badge ${meta.cls}`}>{meta.label}</span>;
}

export function PaymentStatusBadge({ status }) {
  const meta = PAYMENT_STATUS_META[status] || { label: status, cls: 'text-bg-light' };
  return <span className={`badge ${meta.cls}`}>{meta.label}</span>;
}
