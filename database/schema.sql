-- ============================================================================
-- ClinicaWeb - Relational MySQL Database Schema (MySQL 8.0+)
-- ============================================================================

CREATE DATABASE IF NOT EXISTS clinicaweb
  CHARACTER SET utf8mb4
  COLLATE utf8mb4_unicode_ci;

USE clinicaweb;

SET FOREIGN_KEY_CHECKS = 0;

DROP TABLE IF EXISTS notifications;
DROP TABLE IF EXISTS prescriptions;
DROP TABLE IF EXISTS medical_records;
DROP TABLE IF EXISTS appointments;
DROP TABLE IF EXISTS doctor_schedules;
DROP TABLE IF EXISTS doctors;
DROP TABLE IF EXISTS specializations;
DROP TABLE IF EXISTS users;

SET FOREIGN_KEY_CHECKS = 1;

-- ----------------------------------------------------------------------------
-- 1. Users (RBAC: PATIENT, RECEPTIONIST, DOCTOR, ADMIN)
-- ----------------------------------------------------------------------------
CREATE TABLE users (
  id INT UNSIGNED NOT NULL AUTO_INCREMENT,
  full_name VARCHAR(120) NOT NULL,
  email VARCHAR(160) NOT NULL,
  password_hash VARCHAR(255) NOT NULL,
  phone VARCHAR(30) DEFAULT NULL,
  role ENUM('PATIENT', 'RECEPTIONIST', 'DOCTOR', 'ADMIN') NOT NULL DEFAULT 'PATIENT',
  is_active TINYINT(1) NOT NULL DEFAULT 1,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  UNIQUE KEY uq_users_email (email),
  KEY idx_users_role (role),
  KEY idx_users_active (is_active)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ----------------------------------------------------------------------------
-- 2. Medical Specializations
-- ----------------------------------------------------------------------------
CREATE TABLE specializations (
  id INT UNSIGNED NOT NULL AUTO_INCREMENT,
  name VARCHAR(100) NOT NULL,
  description TEXT DEFAULT NULL,
  PRIMARY KEY (id),
  UNIQUE KEY uq_specializations_name (name)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ----------------------------------------------------------------------------
-- 3. Doctors Profile
-- ----------------------------------------------------------------------------
CREATE TABLE doctors (
  id INT UNSIGNED NOT NULL AUTO_INCREMENT,
  user_id INT UNSIGNED NOT NULL,
  specialization_id INT UNSIGNED NOT NULL,
  cabinet_number VARCHAR(20) NOT NULL,
  consultation_price DECIMAL(10, 2) NOT NULL DEFAULT 200.00,
  bio TEXT DEFAULT NULL,
  PRIMARY KEY (id),
  UNIQUE KEY uq_doctors_user_id (user_id),
  KEY idx_doctors_specialization_id (specialization_id),
  CONSTRAINT fk_doctors_user
    FOREIGN KEY (user_id) REFERENCES users (id)
    ON DELETE RESTRICT ON UPDATE CASCADE,
  CONSTRAINT fk_doctors_specialization
    FOREIGN KEY (specialization_id) REFERENCES specializations (id)
    ON DELETE RESTRICT ON UPDATE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ----------------------------------------------------------------------------
-- 4. Doctor Weekly Schedules (Monday = 1 .. Friday = 5)
-- ----------------------------------------------------------------------------
CREATE TABLE doctor_schedules (
  id INT UNSIGNED NOT NULL AUTO_INCREMENT,
  doctor_id INT UNSIGNED NOT NULL,
  day_of_week TINYINT UNSIGNED NOT NULL,
  start_time TIME NOT NULL,
  end_time TIME NOT NULL,
  slot_duration_minutes SMALLINT UNSIGNED NOT NULL DEFAULT 30,
  PRIMARY KEY (id),
  UNIQUE KEY uq_doctor_schedule_day (doctor_id, day_of_week),
  KEY idx_doctor_schedules_doctor (doctor_id),
  CONSTRAINT chk_day_of_week CHECK (day_of_week BETWEEN 1 AND 5),
  CONSTRAINT chk_schedule_times CHECK (end_time > start_time),
  CONSTRAINT chk_slot_duration CHECK (slot_duration_minutes BETWEEN 10 AND 120),
  CONSTRAINT fk_doctor_schedules_doctor
    FOREIGN KEY (doctor_id) REFERENCES doctors (id)
    ON DELETE CASCADE ON UPDATE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ----------------------------------------------------------------------------
-- 5. Appointments
-- Atomic concurrency protection:
-- `is_slot_active` is 1 for PENDING/CONFIRMED/COMPLETED and NULL for CANCELLED.
-- Combined with UNIQUE (doctor_id, appointment_date, start_time, is_slot_active),
-- MySQL strictly prevents overlapping active bookings while allowing re-booking
-- of cancelled slots.
-- ----------------------------------------------------------------------------
CREATE TABLE appointments (
  id INT UNSIGNED NOT NULL AUTO_INCREMENT,
  patient_id INT UNSIGNED NOT NULL,
  doctor_id INT UNSIGNED NOT NULL,
  appointment_date DATE NOT NULL,
  start_time TIME NOT NULL,
  end_time TIME NOT NULL,
  status ENUM('PENDING', 'CONFIRMED', 'COMPLETED', 'CANCELLED') NOT NULL DEFAULT 'PENDING',
  payment_status ENUM('UNPAID', 'PAID_AT_RECEPTION') NOT NULL DEFAULT 'UNPAID',
  notes TEXT DEFAULT NULL,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  is_slot_active TINYINT(1) GENERATED ALWAYS AS (IF(status = 'CANCELLED', NULL, 1)) STORED,
  PRIMARY KEY (id),
  UNIQUE KEY uq_appointments_active_slot (doctor_id, appointment_date, start_time, is_slot_active),
  KEY idx_appointments_patient (patient_id),
  KEY idx_appointments_doctor_date (doctor_id, appointment_date),
  KEY idx_appointments_status (status),
  KEY idx_appointments_date (appointment_date),
  CONSTRAINT chk_appointment_times CHECK (end_time > start_time),
  CONSTRAINT fk_appointments_patient
    FOREIGN KEY (patient_id) REFERENCES users (id)
    ON DELETE RESTRICT ON UPDATE CASCADE,
  CONSTRAINT fk_appointments_doctor
    FOREIGN KEY (doctor_id) REFERENCES doctors (id)
    ON DELETE RESTRICT ON UPDATE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ----------------------------------------------------------------------------
-- 6. Electronic Health Records (EHR) - Medical Records
-- ----------------------------------------------------------------------------
CREATE TABLE medical_records (
  id INT UNSIGNED NOT NULL AUTO_INCREMENT,
  appointment_id INT UNSIGNED NOT NULL,
  patient_id INT UNSIGNED NOT NULL,
  doctor_id INT UNSIGNED NOT NULL,
  symptoms TEXT NOT NULL,
  diagnosis TEXT NOT NULL,
  recommendations TEXT NOT NULL,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  UNIQUE KEY uq_medical_records_appointment (appointment_id),
  KEY idx_medical_records_patient (patient_id),
  KEY idx_medical_records_doctor (doctor_id),
  CONSTRAINT fk_medical_records_appointment
    FOREIGN KEY (appointment_id) REFERENCES appointments (id)
    ON DELETE RESTRICT ON UPDATE CASCADE,
  CONSTRAINT fk_medical_records_patient
    FOREIGN KEY (patient_id) REFERENCES users (id)
    ON DELETE RESTRICT ON UPDATE CASCADE,
  CONSTRAINT fk_medical_records_doctor
    FOREIGN KEY (doctor_id) REFERENCES doctors (id)
    ON DELETE RESTRICT ON UPDATE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ----------------------------------------------------------------------------
-- 7. Electronic Prescriptions
-- ----------------------------------------------------------------------------
CREATE TABLE prescriptions (
  id INT UNSIGNED NOT NULL AUTO_INCREMENT,
  medical_record_id INT UNSIGNED NOT NULL,
  medication_name VARCHAR(160) NOT NULL,
  dosage VARCHAR(120) NOT NULL,
  duration_days SMALLINT UNSIGNED NOT NULL,
  instructions TEXT DEFAULT NULL,
  PRIMARY KEY (id),
  KEY idx_prescriptions_medical_record (medical_record_id),
  CONSTRAINT chk_prescription_duration CHECK (duration_days > 0),
  CONSTRAINT fk_prescriptions_medical_record
    FOREIGN KEY (medical_record_id) REFERENCES medical_records (id)
    ON DELETE CASCADE ON UPDATE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ----------------------------------------------------------------------------
-- 8. In-App Notifications (No external SMTP required)
-- ----------------------------------------------------------------------------
CREATE TABLE notifications (
  id INT UNSIGNED NOT NULL AUTO_INCREMENT,
  user_id INT UNSIGNED NOT NULL,
  title VARCHAR(160) NOT NULL,
  message TEXT NOT NULL,
  type ENUM('INFO', 'SUCCESS', 'WARNING', 'DANGER') NOT NULL DEFAULT 'INFO',
  is_read TINYINT(1) NOT NULL DEFAULT 0,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  KEY idx_notifications_user_read (user_id, is_read),
  CONSTRAINT fk_notifications_user
    FOREIGN KEY (user_id) REFERENCES users (id)
    ON DELETE CASCADE ON UPDATE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
