/**
 * CTPAT Inspection Backend - server entry point.
 * Reads configuration, connects to MongoDB, wires the services together and starts listening.
 */

require('dotenv').config();

const { createApp } = require('./app');
const { connectDB } = require('./config/database');
const Inspection = require('./models/Inspection');
const { getForm } = require('./forms');
const PdfFillerService = require('./services/PdfFillerService');
const EmailService = require('./services/EmailService');
const { createStorage } = require('./services/StorageService');
const { createInspectionService } = require('./services/InspectionService');

const REQUIRED_IN_PRODUCTION = [
  'MONGODB_URI',
  'SUPABASE_URL',
  'SUPABASE_SERVICE_ROLE_KEY',
  'SUPABASE_STORAGE_BUCKET',
  'CORS_ORIGIN',
];

const assertProductionConfig = () => {
  if (process.env.NODE_ENV !== 'production') return;

  const missing = REQUIRED_IN_PRODUCTION.filter((name) => !process.env[name]);
  if (missing.length > 0) {
    console.error('❌ Missing required environment variables:', missing.join(', '));
    process.exit(1);
  }
  if (process.env.CORS_ORIGIN === '*') {
    console.error('❌ CORS_ORIGIN must list specific origins in production, not "*"');
    process.exit(1);
  }
};

const parseList = (value) =>
  (value || '')
    .split(',')
    .map((item) => item.trim().toLowerCase())
    .filter(Boolean);

const startServer = async () => {
  assertProductionConfig();

  const dbConnection = await connectDB();

  const inspectionService = createInspectionService({
    Inspection,
    storage: createStorage(),
    pdfFiller: PdfFillerService,
    emailer: EmailService,
    getForm,
    allowedEmailDomains: parseList(process.env.EMAIL_ALLOWED_DOMAINS),
  });

  const port = process.env.PORT || 3000;
  const server = require('http').createServer(createApp({ inspectionService }));
  server.listen(port, () => {
    console.log(`🚀 CTPAT backend listening on port ${port} (${process.env.NODE_ENV || 'development'})`);
    console.log(`📦 Database: ${dbConnection ? 'MongoDB connected' : 'MongoDB offline'}`);
  });

  const shutdown = (signal) => {
    console.log(`${signal} received: closing HTTP server`);
    server.close(() => process.exit(0));
  };
  process.on('SIGTERM', () => shutdown('SIGTERM'));
  process.on('SIGINT', () => shutdown('SIGINT'));
};

startServer().catch((error) => {
  console.error('Failed to start server:', error);
  process.exit(1);
});
