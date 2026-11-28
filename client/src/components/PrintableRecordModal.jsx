import React from 'react';
import MedicalRecordSheet from './MedicalRecordSheet';

export default function PrintableRecordModal({ record, onClose }) {
  if (!record) return null;

  const handlePrint = () => {
    window.print();
  };

  return (
    <div
      className="modal d-block"
      tabIndex="-1"
      style={{ backgroundColor: 'rgba(15, 29, 53, 0.55)' }}
      role="dialog"
    >
      <div className="modal-dialog modal-lg modal-dialog-scrollable">
        <div className="modal-content border-0 shadow-lg">
          <div className="modal-header bg-light no-print">
            <h5 className="modal-title fw-bold">
              <i className="bi bi-file-earmark-medical text-primary me-2" />
              Fișă Medicală Electronică & Rețetă #{record.id}
            </h5>
            <button type="button" className="btn-close" onClick={onClose} aria-label="Închide" />
          </div>

          <div className="modal-body">
            <MedicalRecordSheet record={record} />
          </div>

          <div className="modal-footer no-print">
            <button type="button" className="btn btn-outline-secondary" onClick={onClose}>
              Închide
            </button>
            <button type="button" className="btn btn-cw-primary" onClick={handlePrint}>
              <i className="bi bi-printer-fill me-2" />
              Tipărește / Salvează PDF
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
