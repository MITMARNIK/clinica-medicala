const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const env = require('./config/env');
const { notFoundHandler, errorHandler } = require('./middlewares/error.middleware');

const authRoutes = require('./routes/auth.routes');
const doctorRoutes = require('./routes/doctor.routes');
const appointmentRoutes = require('./routes/appointment.routes');
const medicalRecordRoutes = require('./routes/medicalRecord.routes');
const adminRoutes = require('./routes/admin.routes');
const notificationRoutes = require('./routes/notification.routes');

const app = express();

app.use(helmet());
app.use(
  cors({
    origin: env.clientUrl === '*' ? true : [env.clientUrl, 'http://localhost:5173', 'http://127.0.0.1:5173'],
    credentials: true
  })
);
app.use(express.json({ limit: '1mb' }));
app.use(express.urlencoded({ extended: true }));

app.get('/api/health', (_req, res) => {
  res.status(200).json({
    status: 'ok',
    service: 'ClinicaWeb API',
    timestamp: new Date().toISOString()
  });
});

app.use('/api/auth', authRoutes);
app.use('/api/doctors', doctorRoutes);
app.use('/api/specializations', doctorRoutes.specializationsRouter);
app.use('/api/appointments', appointmentRoutes);
app.use('/api/medical-records', medicalRecordRoutes);
app.use('/api/admin', adminRoutes);
app.use('/api/notifications', notificationRoutes);

app.use(notFoundHandler);
app.use(errorHandler);

module.exports = app;
