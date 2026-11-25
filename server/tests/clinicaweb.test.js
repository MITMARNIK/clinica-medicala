const fs = require('fs');
const path = require('path');
const bcrypt = require('bcrypt');
const request = require('supertest');
const mysql = require('mysql2/promise');
const app = require('../src/app');
const env = require('../src/config/env');
const { pool } = require('../src/config/db');

/**
 * Automated Integration Test Suite — ClinicaWeb (TC-01 ... TC-05)
 * Requires a running MySQL instance configured via .env (DB_HOST, DB_USER, DB_PASSWORD, DB_NAME).
 */

async function resetAndSeedDatabase() {
  const schemaSql = fs.readFileSync(
    path.resolve(__dirname, '../../database/schema.sql'),
    'utf8'
  );
  let seedSql = fs.readFileSync(
    path.resolve(__dirname, '../../database/seed.sql'),
    'utf8'
  );

  const demoHash = await bcrypt.hash('Clinica2026!', 10);
  seedSql = seedSql.replace(
    /SET @demo_password_hash = '[^']+';/,
    `SET @demo_password_hash = '${demoHash}';`
  );

  const conn = await mysql.createConnection({
    host: env.db.host,
    port: env.db.port,
    user: env.db.user,
    password: env.db.password,
    multipleStatements: true
  });

  try {
    await conn.query(schemaSql);
    await conn.query(seedSql);
  } finally {
    await conn.end();
  }
}

async function loginAs(email, password = 'Clinica2026!') {
  const res = await request(app).post('/api/auth/login').send({ email, password });
  expect(res.status).toBe(200);
  expect(res.body.token).toBeTruthy();
  return res.body;
}

describe('ClinicaWeb End-to-End API Acceptance Tests (TC-01 ... TC-05)', () => {
  let patientToken;
  let patientUser;
  let doctorToken;
  let receptionistToken;
  let adminToken;

  beforeAll(async () => {
    await resetAndSeedDatabase();

    const docAuth = await loginAs('elena.popescu@clinicaweb.ro');
    doctorToken = docAuth.token;

    const recAuth = await loginAs('receptie@clinicaweb.ro');
    receptionistToken = recAuth.token;

    const admAuth = await loginAs('admin@clinicaweb.ro');
    adminToken = admAuth.token;
  }, 30000);

  afterAll(async () => {
    await pool.end();
  });

  // =========================================================================
  // TC-01: Autentificare & RBAC (Register, Login JWT, 403 Forbidden)
  // =========================================================================
  describe('TC-01: Autentificare & Control Acces RBAC', () => {
    test('înregistrează un pacient nou, autentifică cu JWT valid și respinge accesul neautorizat (403)', async () => {
      const uniqueEmail = `pacient.test.${Date.now()}@demo.ro`;

      // 1. Register new patient
      const regRes = await request(app).post('/api/auth/register').send({
        full_name: 'Ioana Testare',
        email: uniqueEmail,
        password: 'Password123!',
        phone: '0722111222'
      });

      expect(regRes.status).toBe(201);
      expect(regRes.body.token).toBeTruthy();
      expect(regRes.body.user.role).toBe('PATIENT');

      // 2. Login with newly registered credentials
      const loginRes = await request(app).post('/api/auth/login').send({
        email: uniqueEmail,
        password: 'Password123!'
      });

      expect(loginRes.status).toBe(200);
      expect(loginRes.body.token).toBeTruthy();
      patientToken = loginRes.body.token;
      patientUser = loginRes.body.user;

      // 3. Patient tries to access ADMIN endpoint -> 403 Forbidden
      const adminDeniedRes = await request(app)
        .get('/api/admin/reports')
        .set('Authorization', `Bearer ${patientToken}`);
      expect(adminDeniedRes.status).toBe(403);

      // 4. Patient tries to access another patient's medical record (#1) -> 403 Forbidden
      const gdprDeniedRes = await request(app)
        .get('/api/medical-records/1')
        .set('Authorization', `Bearer ${patientToken}`);
      expect(gdprDeniedRes.status).toBe(403);
    });
  });

  // =========================================================================
  // TC-02: Catalog Medici & Sloturi Disponibile
  // =========================================================================
  describe('TC-02: Catalog Medici & Sloturi Disponibile', () => {
    test('listează medicii filtrați pe specializare și returnează corect sloturile disponibile', async () => {
      // 1. Fetch specializations
      const specRes = await request(app).get('/api/specializations');
      expect(specRes.status).toBe(200);
      expect(specRes.body.specializations.length).toBeGreaterThanOrEqual(4);

      const cardiology = specRes.body.specializations.find((s) =>
        s.name.toLowerCase().includes('cardiologie')
      );
      expect(cardiology).toBeDefined();

      // 2. Filter doctors by Cardiologie
      const docsRes = await request(app).get(
        `/api/doctors?specialization_id=${cardiology.id}`
      );
      expect(docsRes.status).toBe(200);
      expect(docsRes.body.doctors.length).toBeGreaterThanOrEqual(1);
      expect(
        docsRes.body.doctors.every((d) => d.specialization_id === cardiology.id)
      ).toBe(true);

      // 3. Fetch available slots for a future weekday (Monday 2026-12-07)
      const doctorId = docsRes.body.doctors[0].id;
      const slotsRes = await request(app).get(
        `/api/doctors/${doctorId}/available-slots?date=2026-12-07`
      );
      expect(slotsRes.status).toBe(200);
      expect(slotsRes.body.is_working_day).toBe(true);
      expect(Array.isArray(slotsRes.body.slots)).toBe(true);
      expect(slotsRes.body.slots.length).toBeGreaterThan(0);
      expect(slotsRes.body.slots[0]).toHaveProperty('start_time');
      expect(slotsRes.body.slots[0]).toHaveProperty('is_available');
    });
  });

  // =========================================================================
  // TC-03: Programare Validă & Prevenire Suprapunere (Concurență Atomică)
  // =========================================================================
  describe('TC-03: Programare & Prevenire Suprapunere la Concurență', () => {
    let createdAppointmentId;

    test('creează o programare validă (201) și respinge a doua cerere simultană cu 409 Conflict', async () => {
      // 1. Single valid booking (Monday 2026-12-07 at 09:00)
      const singleRes = await request(app)
        .post('/api/appointments')
        .set('Authorization', `Bearer ${patientToken}`)
        .send({
          doctor_id: 1,
          appointment_date: '2026-12-07',
          start_time: '09:00',
          notes: 'Control cardiologic de rutină'
        });

      expect(singleRes.status).toBe(201);
      expect(singleRes.body.appointment.status).toBe('PENDING');
      createdAppointmentId = singleRes.body.appointment.id;

      // 2. Concurrency test: two simultaneous bookings for the exact same doctor, date & time
      const concurrentPayload = {
        doctor_id: 1,
        appointment_date: '2026-12-07',
        start_time: '10:00',
        notes: 'Test concurență atomică'
      };

      const [resA, resB] = await Promise.all([
        request(app)
          .post('/api/appointments')
          .set('Authorization', `Bearer ${patientToken}`)
          .send(concurrentPayload),
        request(app)
          .post('/api/appointments')
          .set('Authorization', `Bearer ${patientToken}`)
          .send(concurrentPayload)
      ]);

      const statuses = [resA.status, resB.status].sort((a, b) => a - b);
      expect(statuses).toEqual([201, 409]);

      // Verify slot 10:00 is now marked unavailable
      const slotsAfter = await request(app).get(
        '/api/doctors/1/available-slots?date=2026-12-07'
      );
      const slot10 = slotsAfter.body.slots.find((s) => s.start_time === '10:00:00');
      expect(slot10.is_available).toBe(false);
    });

    // =========================================================================
    // TC-04: Fișe Medicale Electronice & Rețete (EHR)
    // =========================================================================
    test('TC-04: medicul creează fișa medicală cu rețetă și pacientul titular o vizualizează securizat', async () => {
      expect(createdAppointmentId).toBeDefined();

      // Doctor creates EHR + prescription for the booked appointment
      const createEhrRes = await request(app)
        .post('/api/medical-records')
        .set('Authorization', `Bearer ${doctorToken}`)
        .send({
          appointment_id: createdAppointmentId,
          symptoms: 'Palpitații ușoare la efort, oboseală',
          diagnosis: 'Tahicardie sinusală ușoară',
          recommendations: 'Reducerea consumului de cafeină, hidratare, control peste 30 zile.',
          prescriptions: [
            {
              medication_name: 'Magneziu + Vitamina B6',
              dosage: '1 comprimat x 2/zi',
              duration_days: 30,
              instructions: 'După masă'
            }
          ]
        });

      expect(createEhrRes.status).toBe(201);
      const recordId = createEhrRes.body.medical_record.id;
      expect(createEhrRes.body.medical_record.prescriptions).toHaveLength(1);

      // Patient owner retrieves their medical record
      const patientReadRes = await request(app)
        .get(`/api/medical-records/${recordId}`)
        .set('Authorization', `Bearer ${patientToken}`);

      expect(patientReadRes.status).toBe(200);
      expect(patientReadRes.body.medical_record.patient_id).toBe(patientUser.id);
      expect(patientReadRes.body.medical_record.diagnosis).toBe('Tahicardie sinusală ușoară');
      expect(patientReadRes.body.medical_record.prescriptions[0].medication_name).toBe(
        'Magneziu + Vitamina B6'
      );
    });

    // =========================================================================
    // TC-05: Flux Recepție & Rapoarte Admin
    // =========================================================================
    test('TC-05: recepția confirmă programarea, marchează plata și adminul extrage raportul agregat', async () => {
      // Receptionist creates a walk-in appointment and marks it confirmed + paid at reception
      const walkInRes = await request(app)
        .post('/api/appointments')
        .set('Authorization', `Bearer ${receptionistToken}`)
        .send({
          patient_id: patientUser.id,
          doctor_id: 2,
          appointment_date: '2026-12-08',
          start_time: '09:30',
          status: 'PENDING',
          notes: 'Programare telefonică recepție'
        });

      expect(walkInRes.status).toBe(201);
      const apptId = walkInRes.body.appointment.id;

      // Receptionist confirms appointment & marks payment as PAID_AT_RECEPTION
      const updateRes = await request(app)
        .patch(`/api/appointments/${apptId}`)
        .set('Authorization', `Bearer ${receptionistToken}`)
        .send({
          status: 'CONFIRMED',
          payment_status: 'PAID_AT_RECEPTION'
        });

      expect(updateRes.status).toBe(200);
      expect(updateRes.body.appointment.status).toBe('CONFIRMED');
      expect(updateRes.body.appointment.payment_status).toBe('PAID_AT_RECEPTION');

      // Admin fetches aggregated KPI reports
      const reportRes = await request(app)
        .get('/api/admin/reports')
        .set('Authorization', `Bearer ${adminToken}`);

      expect(reportRes.status).toBe(200);
      expect(reportRes.body.summary.total_appointments).toBeGreaterThanOrEqual(10);
      expect(reportRes.body.summary.total_revenue_paid).toBeGreaterThan(0);
      expect(Array.isArray(reportRes.body.by_doctor)).toBe(true);
      expect(Array.isArray(reportRes.body.by_specialization)).toBe(true);

      // Admin exports CSV report
      const csvRes = await request(app)
        .get('/api/admin/reports/export-csv')
        .set('Authorization', `Bearer ${adminToken}`);
      expect(csvRes.status).toBe(200);
      expect(csvRes.headers['content-type']).toContain('text/csv');
    });
  });
});
