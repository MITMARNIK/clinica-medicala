const path = require('path');
const dotenv = require('dotenv');

// Load from server/.env first, then fallback to project root .env
dotenv.config({ path: path.resolve(__dirname, '../../.env') });
dotenv.config({ path: path.resolve(__dirname, '../../../.env') });

const env = {
  port: parseInt(process.env.PORT || '5000', 10),
  nodeEnv: process.env.NODE_ENV || 'development',
  clientUrl: process.env.CLIENT_URL || 'http://localhost:5173',
  db: {
    host: process.env.DB_HOST || '127.0.0.1',
    port: parseInt(process.env.DB_PORT || '3306', 10),
    user: process.env.DB_USER || 'root',
    password: process.env.DB_PASSWORD !== undefined ? process.env.DB_PASSWORD : 'clinica_root_pass',
    database: process.env.DB_NAME || 'clinicaweb'
  },
  jwt: {
    secret: process.env.JWT_SECRET || 'clinicaweb_dev_secret_change_in_production_2026',
    expiresIn: process.env.JWT_EXPIRES_IN || '8h'
  }
};

module.exports = env;
