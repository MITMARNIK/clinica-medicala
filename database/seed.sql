-- ============================================================================
-- ClinicaWeb - Synthetic GDPR-Compliant Demo Seed Data
-- All names, emails, phones, appointments, and medical records are 100% fictive.
-- Demo password for all accounts: Clinica2026!
-- Note: Running `npm run db:init` in /server refreshes the bcrypt hash via Node's
-- `bcrypt` library automatically.
-- ============================================================================

USE clinicaweb;

SET FOREIGN_KEY_CHECKS = 0;
TRUNCATE TABLE notifications;
TRUNCATE TABLE prescriptions;
TRUNCATE TABLE medical_records;
TRUNCATE TABLE appointments;
TRUNCATE TABLE doctor_schedules;
TRUNCATE TABLE doctors;
TRUNCATE TABLE specializations;
TRUNCATE TABLE users;
SET FOREIGN_KEY_CHECKS = 1;

-- Real verified bcrypt hash (10 rounds) for demo password: Clinica2026!
SET @demo_password_hash = '$2b$10$89k.u07c26.VZtDesUQvTeH3r4s88KCY1wVrYSl.BYv0URiBn5kNi';

-- ----------------------------------------------------------------------------
-- 1. Users: 1 Admin, 1 Receptionist, 4 Doctors, 5 Demo Patients
-- ----------------------------------------------------------------------------
INSERT INTO users (id, full_name, email, password_hash, phone, role, is_active) VALUES
  (1,  'Radu Marinescu',         'admin@clinicaweb.ro',           @demo_password_hash, '0721000001', 'ADMIN',        1),
  (2,  'Alina Ionescu',          'receptie@clinicaweb.ro',        @demo_password_hash, '0721000002', 'RECEPTIONIST', 1),
  (3,  'Dr. Elena Popescu',      'elena.popescu@clinicaweb.ro',   @demo_password_hash, '0721000101', 'DOCTOR',       1),
  (4,  'Dr. Mihai Georgescu',    'mihai.georgescu@clinicaweb.ro', @demo_password_hash, '0721000102', 'DOCTOR',       1),
  (5,  'Dr. Ioana Stan',         'ioana.stan@clinicaweb.ro',      @demo_password_hash, '0721000103', 'DOCTOR',       1),
  (6,  'Dr. Alexandru Moldovan', 'alexandru.moldovan@clinicaweb.ro', @demo_password_hash, '0721000104', 'DOCTOR',    1),
  (7,  'Andrei Dumitrescu',      'andrei.dumitrescu@demo.ro',     @demo_password_hash, '0740111001', 'PATIENT',      1),
  (8,  'Maria Vasilescu',        'maria.vasilescu@demo.ro',       @demo_password_hash, '0740111002', 'PATIENT',      1),
  (9,  'Cristian Stoica',        'cristian.stoica@demo.ro',       @demo_password_hash, '0740111003', 'PATIENT',      1),
  (10, 'Elena Rusu',             'elena.rusu@demo.ro',            @demo_password_hash, '0740111004', 'PATIENT',      1),
  (11, 'George Munteanu',        'george.munteanu@demo.ro',       @demo_password_hash, '0740111005', 'PATIENT',      1);

-- ----------------------------------------------------------------------------
-- 2. Medical Specializations (4 Core Specializations)
-- ----------------------------------------------------------------------------
INSERT INTO specializations (id, name, description) VALUES
  (1, 'Cardiologie',      'Diagnosticarea și tratamentul afecțiunilor cardiovasculare, EKG și ecografie cardiacă.'),
  (2, 'Dermatologie',     'Consultații dermatologice clinice, dermatoscopie și tratamente cutanate.'),
  (3, 'Pediatrie',        'Îngrijire medicală completă pentru nou-născuți, copii și adolescenți.'),
  (4, 'Medicină Internă', 'Evaluare clinică generală, diagnostic integrat și monitorizare afecțiuni cronice.');

-- ----------------------------------------------------------------------------
-- 3. Doctors Profiles
-- ----------------------------------------------------------------------------
INSERT INTO doctors (id, user_id, specialization_id, cabinet_number, consultation_price, bio) VALUES
  (1, 3, 1, 'C-101', 250.00, 'Medic primar Cardiologie cu peste 14 ani de experiență în ecocardiografie și hipertensiune arterială.'),
  (2, 4, 2, 'C-102', 220.00, 'Medic specialist Dermatovenerologie, competență în dermatoscopie digitală și alergologie cutanată.'),
  (3, 5, 3, 'C-103', 200.00, 'Medic primar Pediatrie, focus pe prevenție, nutriție pediatrică și monitorizare dezvoltare.'),
  (4, 6, 4, 'C-104', 210.00, 'Medic primar Medicină Internă, specializat în evaluări metabolice, hepatologie și ecografie abdominală.');

-- ----------------------------------------------------------------------------
-- 4. Doctor Weekly Schedules (Monday = 1 .. Friday = 5)
-- ----------------------------------------------------------------------------
INSERT INTO doctor_schedules (doctor_id, day_of_week, start_time, end_time, slot_duration_minutes) VALUES
  -- Dr. Elena Popescu (Cardiologie): Mon-Fri 08:30 - 15:30
  (1, 1, '08:30:00', '15:30:00', 30),
  (1, 2, '08:30:00', '15:30:00', 30),
  (1, 3, '08:30:00', '15:30:00', 30),
  (1, 4, '08:30:00', '15:30:00', 30),
  (1, 5, '08:30:00', '14:00:00', 30),

  -- Dr. Mihai Georgescu (Dermatologie): Mon-Fri 09:00 - 17:00
  (2, 1, '09:00:00', '17:00:00', 30),
  (2, 2, '09:00:00', '17:00:00', 30),
  (2, 3, '09:00:00', '17:00:00', 30),
  (2, 4, '09:00:00', '17:00:00', 30),
  (2, 5, '09:00:00', '15:00:00', 30),

  -- Dr. Ioana Stan (Pediatrie): Mon-Fri 08:00 - 16:00
  (3, 1, '08:00:00', '16:00:00', 30),
  (3, 2, '08:00:00', '16:00:00', 30),
  (3, 3, '08:00:00', '16:00:00', 30),
  (3, 4, '08:00:00', '16:00:00', 30),
  (3, 5, '08:00:00', '14:00:00', 30),

  -- Dr. Alexandru Moldovan (Medicină Internă): Mon-Fri 10:00 - 18:00
  (4, 1, '10:00:00', '18:00:00', 30),
  (4, 2, '10:00:00', '18:00:00', 30),
  (4, 3, '10:00:00', '18:00:00', 30),
  (4, 4, '10:00:00', '18:00:00', 30),
  (4, 5, '10:00:00', '16:00:00', 30);

-- ----------------------------------------------------------------------------
-- 5. Appointments (12 synthetic appointments across all statuses)
-- ----------------------------------------------------------------------------
INSERT INTO appointments (id, patient_id, doctor_id, appointment_date, start_time, end_time, status, payment_status, notes) VALUES
  (1,  7,  1, '2026-11-16', '09:00:00', '09:30:00', 'COMPLETED', 'PAID_AT_RECEPTION', 'Control tensiune arterială și EKG de rutină'),
  (2,  8,  2, '2026-11-16', '10:00:00', '10:30:00', 'COMPLETED', 'PAID_AT_RECEPTION', 'Evaluare dermatită sezonieră'),
  (3,  9,  3, '2026-11-17', '09:30:00', '10:00:00', 'COMPLETED', 'PAID_AT_RECEPTION', 'Control pediatric periodic și adeverință'),
  (4,  10, 4, '2026-11-18', '11:00:00', '11:30:00', 'COMPLETED', 'PAID_AT_RECEPTION', 'Interpretare analize biochimie și ecografie'),
  (5,  11, 1, '2026-11-23', '09:30:00', '10:00:00', 'CONFIRMED', 'PAID_AT_RECEPTION', 'Palpitații ocazionale la efort'),
  (6,  7,  4, '2026-11-23', '11:30:00', '12:00:00', 'CONFIRMED', 'UNPAID',            'Control medicină internă'),
  (7,  8,  1, '2026-11-24', '10:00:00', '10:30:00', 'CONFIRMED', 'UNPAID',            'Monitorizare tratament antihipertensiv'),
  (8,  9,  2, '2026-11-24', '11:00:00', '11:30:00', 'PENDING',   'UNPAID',            'Verificare alunițe (dermatoscopie)'),
  (9,  10, 3, '2026-11-25', '08:30:00', '09:00:00', 'PENDING',   'UNPAID',            'Consultație pediatrică de control'),
  (10, 11, 4, '2026-11-25', '14:00:00', '14:30:00', 'CONFIRMED', 'PAID_AT_RECEPTION', 'Disconfort abdominal postprandial'),
  (11, 7,  2, '2026-11-19', '13:00:00', '13:30:00', 'CANCELLED', 'UNPAID',            'Anulat de pacient din motive personale'),
  (12, 8,  3, '2026-11-20', '10:30:00', '11:00:00', 'CANCELLED', 'UNPAID',            'Reprogramare solicitată telefonic');

-- ----------------------------------------------------------------------------
-- 6. Electronic Health Records (4 completed consultations)
-- ----------------------------------------------------------------------------
INSERT INTO medical_records (id, appointment_id, patient_id, doctor_id, symptoms, diagnosis, recommendations) VALUES
  (1, 1, 7, 1,
   'Cefalee occipitală matinală, valori tensionale 150/95 mmHg măsurate la domiciliu.',
   'Hipertensiune arterială esențială grad I',
   'Regim hiposodat, monitorizare zilnică a tensiunii arteriale, activitate fizică moderată 30 min/zi. Reevaluare peste 30 de zile.'),
  (2, 2, 8, 2,
   'Prurit cutanat și eritem ușor la nivelul antebrațelor apărut de 5 zile.',
   'Dermatită de contact alergică',
   'Evitarea detergenților parfumați, aplicare cremă emolientă zilnic, evitarea expunerii directe la soare.'),
  (3, 3, 9, 3,
   'Tuse ușoară iritativă și rinoree apoasă de 3 zile, fără febră.',
   'Rinofaringită acută virală ușoară',
   'Hidratare corespunzătoare, lavaj nazal cu ser fiziologic, repaus la domiciliu 3 zile.'),
  (4, 4, 10, 4,
   'Senzație de arsură epigastrică după mese copioase, balonare ocazională.',
   'Gastrită cronică ușoară / Reflux gastroesofagian',
   'Mese fracționate, evitarea alimentelor acide, prăjelilor și cafelei pe stomacul gol. Control peste 4 săptămâni.');

-- ----------------------------------------------------------------------------
-- 7. Electronic Prescriptions
-- ----------------------------------------------------------------------------
INSERT INTO prescriptions (medical_record_id, medication_name, dosage, duration_days, instructions) VALUES
  (1, 'Perindopril 5 mg',          '1 comprimat dimineața',       30, 'Se administrează cu apă înainte de micul dejun.'),
  (1, 'Magneziu + Vitamina B6',    '1 comprimat de 2 ori/zi',     30, 'După mesele principale.'),
  (2, 'Desloratadină 5 mg',        '1 comprimat seara',           10, 'Oral, indiferent de orarul meselor.'),
  (2, 'Cremă emolientă dermatologică', 'Aplicare locală x 2/zi',  14, 'Pe pielea curată și uscată.'),
  (3, 'Ser fiziologic spray nazal','2 pufuri în fiecare nară x 3/zi', 7, 'Înainte de mese și culcare.'),
  (3, 'Vitamina C picături',       '10 picături / zi',            14, 'Dimineața, diluat în apă sau ceai.'),
  (4, 'Omeprazol 20 mg',           '1 capsulă dimineața',         28, 'Cu 30 de minute înainte de micul dejun.'),
  (4, 'Probiotic complex',         '1 capsulă / zi',              14, 'La 2 ore după masă.');

-- ----------------------------------------------------------------------------
-- 8. Sample In-App Notifications
-- ----------------------------------------------------------------------------
INSERT INTO notifications (user_id, title, message, type, is_read) VALUES
  (7, 'Fișă medicală disponibilă', 'Dr. Elena Popescu a emis fișa medicală și rețeta pentru consultația din 2026-11-16.', 'SUCCESS', 0),
  (7, 'Programare confirmată',     'Programarea la Dr. Alexandru Moldovan din 2026-11-23, ora 11:30, a fost confirmată.', 'INFO', 0),
  (8, 'Fișă medicală disponibilă', 'Dr. Mihai Georgescu a completat fișa medicală pentru consultația din 2026-11-16.', 'SUCCESS', 0),
  (3, 'Calendar actualizat',       'Aveți 2 programări confirmate în această săptămână.', 'INFO', 0);
