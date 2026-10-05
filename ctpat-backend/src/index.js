/**
 * CTPAT Inspection Backend
 * Express.js API server with MongoDB and Supabase Storage
 * Production-ready with security, authentication, and rate limiting
 */

require('dotenv').config();
require('express-async-errors');

const express = require('express');
const helmet = require('helmet');
const corsMiddleware = require('./middleware/cors');
const { connectDB } = require('./config/database');
const { errorHandler } = require('./middleware/errorHandler');
const { authMiddleware } = require('./middleware/auth');
const { createRateLimiter } = require('./middleware/rateLimit');
const inspectionRoutes = require('./routes/inspections');

const app = express();

// ====================
// Security Validation
// ====================

// Validate production configuration
if (process.env.NODE_ENV === 'production') {
  const requiredEnvVars = ['MONGODB_URI', 'SUPABASE_URL', 'SUPABASE_ANON_KEY', 'SUPABASE_JWT_SECRET'];
  const missing = requiredEnvVars.filter(v => !process.env[v]);
  
  if (missing.length > 0) {
    console.error('❌ Missing required environment variables:', missing.join(', '));
    process.exit(1);
  }

  // Warn if CORS is too permissive
  if (process.env.CORS_ORIGIN === '*' || !process.env.CORS_ORIGIN) {
    console.warn('⚠️  WARNING: CORS_ORIGIN not restricted in production!');
    console.warn('   Set CORS_ORIGIN to specific domain(s) to prevent unauthorized access');
  }

  // Warn if HTTPS is not being used
  if (!process.env.HTTPS_ENABLED && !process.env.FORCE_HTTPS) {
    console.warn('⚠️  WARNING: HTTPS not explicitly enabled in production!');
  }
}

// ====================
// Middleware
// ====================

// Security middleware
app.use(helmet());

// CORS middleware
app.use(corsMiddleware);

// Body parsing with size limits
app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ limit: '50mb', extended: true }));

// Rate limiting
const generalLimiter = createRateLimiter({
  windowMs: 15 * 60 * 1000, // 15 minutes
  maxRequests: 100,
  message: 'Too many requests from this IP, please try again later',
});

const authLimiter = createRateLimiter({
  windowMs: 15 * 60 * 1000, // 15 minutes
  maxRequests: 20,
  message: 'Too many authentication attempts, please try again later',
});

app.use(generalLimiter);

// Request logging
app.use((req, res, next) => {
  const isDev = process.env.NODE_ENV !== 'production';
  if (isDev) {
    console.log(`${req.method} ${req.path}`);
  }
  next();
});

// ====================
// Public Routes (no auth required)
// ====================

// Health check endpoint
app.get('/health', (req, res) => {
  res.json({
    status: 'ok',
    timestamp: new Date().toISOString(),
    environment: process.env.NODE_ENV,
  });
});

// ====================
// Protected Routes (auth required)
// ====================

// All /api routes require a valid Supabase-issued Bearer token.
app.use('/api', authMiddleware);

// Apply stricter rate limit to inspection creation
app.post('/api/inspections', authLimiter);

// API routes
app.use('/api/inspections', inspectionRoutes);

// ====================
// Error Handlers
// ====================

// 404 handler
app.use((req, res) => {
  res.status(404).json({
    success: false,
    error: {
      message: `Route not found: ${req.method} ${req.path}`,
      statusCode: 404,
    },
  });
});

// Global error handler (MUST be last)
app.use(errorHandler);

// ====================
// Server Startup
// ====================

const PORT = process.env.PORT || 3000;

const startServer = async () => {
  try {
    console.log('Starting server...');
    console.log('Connecting to database...');
    // Connect to MongoDB
    const dbConn = await connectDB();
    console.log('Database connection attempt complete');

    // Start Express server
    const server = app.listen(PORT, () => {
      console.log('╔════════════════════════════════════════════════════════╗');
      console.log('║   🚀 CTPAT Inspection Backend Server Started          ║');
      console.log(`║   📍 Server: http://localhost:${PORT}`);
      console.log(`║   🌍 Environment: ${process.env.NODE_ENV || 'development'}`);
      console.log(`║   📦 Database: ${dbConn ? 'MongoDB Connected' : 'MongoDB Offline'}`);
      console.log('║   ☁️  Storage: Supabase Ready                           ║');
      console.log('║   🔒 Authentication: Required (Bearer Token)           ║');
      console.log('║   ⚡ Rate Limiting: Enabled                            ║');
      console.log('╚════════════════════════════════════════════════════════╝');
    });

    // Graceful shutdown
    process.on('SIGTERM', () => {
      console.log('SIGTERM signal received: closing HTTP server');
      server.close(() => {
        console.log('HTTP server closed');
        process.exit(0);
      });
    });

    process.on('SIGINT', () => {
      console.log('SIGINT signal received: closing HTTP server');
      server.close(() => {
        console.log('HTTP server closed');
        process.exit(0);
      });
    });
  } catch (error) {
    console.error('Failed to start server:', error);
    process.exit(1);
  }
};

startServer();

module.exports = app;
