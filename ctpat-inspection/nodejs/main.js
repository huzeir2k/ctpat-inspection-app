/**
 * CTPAT Inspection Embedded Backend
 * Entry point for nodejs-mobile runtime
 * Runs Express.js server with SQLite database on device
 */

require('dotenv').config();
require('express-async-errors');

const express = require('express');
const helmet = require('helmet');
const cors = require('./src/middleware/cors');
const { initializeDatabase } = require('./src/config/database');
const { errorHandler } = require('./src/middleware/errorHandler');
const { authMiddleware } = require('./src/middleware/auth');
const { createRateLimiter } = require('./src/middleware/rateLimit');
const inspectionRoutes = require('./src/routes/inspections');
const credentialsRoutes = require('./src/routes/credentials');
const pdfRoutes = require('./src/routes/pdfs');
const emailRoutes = require('./src/routes/emails');

const app = express();
const PORT = 3000;

// ====================
// Configuration
// ====================

// Validate JWT secret is available
if (!process.env.JWT_SECRET) {
  console.warn('⚠️  JWT_SECRET not provided - using fallback. Set via environment variables for production use.');
  // Fallback JWT secret (should be set by SecureCredentialsService from frontend)
  process.env.JWT_SECRET = process.env.JWT_SECRET || 'fallback-dev-secret-' + Date.now();
}

// SMTP configuration from environment (set by frontend SecureCredentialsService)
const smtpConfig = {
  enabled: !!process.env.SMTP_HOST,
  host: process.env.SMTP_HOST,
  port: process.env.SMTP_PORT || '587',
  user: process.env.SMTP_USER,
  password: process.env.SMTP_PASSWORD,
  recipientEmail: process.env.SMTP_RECIPIENT_EMAIL,
};

console.log('📧 SMTP Configuration Status:', smtpConfig.enabled ? '✓ Configured' : '⚠ Not configured');

// Initialize SQLite database
console.log('📦 Initializing database...');
try {
  initializeDatabase();
  console.log('✓ Database initialized');
} catch (error) {
  console.error('❌ Database initialization failed:', error);
  process.exit(1);
}

// ====================
// Middleware
// ====================

// Security middleware
app.use(helmet());

// CORS middleware
app.use(cors);

// Body parsing with size limits
app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ limit: '50mb', extended: true }));

// Rate limiting
app.use(createRateLimiter());

// ====================
// Routes
// ====================

// Health check endpoint (no auth required)
app.get('/health', (req, res) => {
  res.json({
    success: true,
    status: 'healthy',
    timestamp: new Date().toISOString(),
    environment: 'embedded',
  });
});

// Credentials routes (no auth required, for internal config)
app.use('/api/credentials', credentialsRoutes);

// PDF routes (no auth required)
app.use('/api/pdfs', pdfRoutes);

// Email routes (no auth required for now, can add auth later)
app.use('/api/emails', emailRoutes);

// Auth middleware for protected routes
app.use(authMiddleware);

// Inspection routes
app.use('/api/inspections', inspectionRoutes);

// ====================
// Error Handling
// ====================

// 404 handler
app.use((req, res) => {
  res.status(404).json({
    success: false,
    error: {
      message: 'Endpoint not found',
      statusCode: 404,
    },
  });
});

// Global error handler
app.use(errorHandler);

// ====================
// Server Start
// ====================

app.listen(PORT, () => {
  console.log(`✓ Embedded backend running on port ${PORT}`);
  console.log(`✓ Database: SQLite (local)`);
  console.log(`✓ API ready for requests`);
});
