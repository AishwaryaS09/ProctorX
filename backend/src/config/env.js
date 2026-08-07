const path = require('path');
const dotenv = require('dotenv');

dotenv.config({ path: path.join(__dirname, '..', '..', '.env') });
console.log("Loaded MONGO_URI:", process.env.MONGO_URI);
console.log("Resolved .env path:", path.join(__dirname, '..', '..', '.env'));
const parseBool = (value, fallback) => {
  if (value === undefined || value === null || value === '') return fallback;
  return ['true', '1', 'yes'].includes(String(value).toLowerCase());
};

const env = {
  nodeEnv: process.env.NODE_ENV || 'development',
  port: parseInt(process.env.PORT, 10) || 5000,
  host: process.env.HOST || '0.0.0.0',
  mongoUri: process.env.MONGO_URI || 'mongodb://127.0.0.1:27017/proctorx',
  jwtSecret: process.env.JWT_SECRET || 'insecure_dev_secret_change_me',
  jwtExpiresIn: process.env.JWT_EXPIRES_IN || '8h',
  jwtCookieName: process.env.JWT_COOKIE_NAME || 'proctorx_token',
  aiServiceUrl: process.env.AI_SERVICE_URL || 'http://127.0.0.1:8000',
  aiServiceTimeoutMs: parseInt(process.env.AI_SERVICE_TIMEOUT_MS, 10) || 5000,
  adminUsername: process.env.ADMIN_USERNAME || 'admin',
  adminPassword: process.env.ADMIN_PASSWORD || 'Admin@12345',
  adminEmail: process.env.ADMIN_EMAIL || 'admin@proctorx.dev',
  adminFullName: process.env.ADMIN_FULL_NAME || 'Platform Administrator',
  clientUrl: process.env.CLIENT_URL || 'http://127.0.0.1:5173',
  screenshotEnabled: parseBool(process.env.SCREENSHOT_ENABLED, true),
  evidenceDir: process.env.EVIDENCE_DIR || path.join(__dirname, '..', '..', 'uploads', 'evidence'),
  warningLevels: (process.env.WARNING_LEVELS || '1,2,3').split(',').map((v) => parseInt(v.trim(), 10)).filter((v) => !Number.isNaN(v)),
  autoEndThreshold: parseInt(process.env.AUTO_END_THRESHOLD, 10) || 5,
  screenshotSeverityBelow: process.env.SCREENSHOT_SEVERITY_BELOW || 'MEDIUM',
};

module.exports = { env };
