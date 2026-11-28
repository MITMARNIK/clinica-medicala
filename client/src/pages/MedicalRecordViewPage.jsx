import React, { useEffect, useState } from 'react';
import { useLocation, useNavigate, useParams } from 'react-router-dom';
import { apiRequest } from '../services/api';
import { useAuth } from '../context/AuthContext';
import MedicalRecordSheet from '../components/MedicalRecordSheet';

export default function MedicalRecordViewPage() {
  const { id } = useParams();
  const location = useLocation();
  const navigate = useNavigate();
  const { user } = useAuth();

  const [record, setRecord] = useState(location.state?.record || null);
  const [loading, setLoading] = useState(!location.state?.record);
  const [error, setError] = useState('');

  useEffect(() => {
    let active = true;
    const fetchRecord = async () => {
      try {
        const data = await apiRequest(`/medical-records/${id}`);
        if (active) {
          setRecord(data.medical_record);
          setError('');
        }
      } catch (err) {
        if (active && !record) {
          setError(err.message || 'Nu s-a putut încărca fișa medicală.');
        }
      } finally {
        if (active) setLoading(false);
      }
    };

    fetchRecord();
    return () => {
      active = false;
    };
  }, [id]);

  const handleBack = () => {
    if (window.history.length > 1) {
      navigate(-1);
    } else {
      navigate(user?.role === 'DOCTOR' ? '/medic' : '/pacient');
    }
  };

  return (
    <div className="container">
      <div className="d-flex flex-wrap justify-content-between align-items-center gap-2 mb-4 no-print">
        <div className="d-flex align-items-center gap-2">
          <button type="button" className="btn btn-outline-secondary" onClick={handleBack}>
            <i className="bi bi-arrow-left me-1" />
            Înapoi
          </button>
          <h4 className="mb-0 fw-bold">
            <i className="bi bi-file-earmark-medical text-primary me-2" />
            Vizualizare Detaliată Fișă Medicală & Rețetă
          </h4>
        </div>

        {record && (
          <button
            type="button"
            className="btn btn-cw-primary"
            onClick={() => window.print()}
          >
            <i className="bi bi-printer-fill me-2" />
            Tipărește / Salvează PDF
          </button>
        )}
      </div>

      {loading ? (
        <div className="cw-card p-5 text-center">
          <div className="spinner-border text-primary" />
        </div>
      ) : error ? (
        <div className="alert alert-danger">{error}</div>
      ) : (
        <div className="cw-card p-4 bg-white">
          <MedicalRecordSheet record={record} />
        </div>
      )}
    </div>
  );
}

