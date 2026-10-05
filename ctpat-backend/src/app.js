/**
 * Express application. Built by a function (no side effects on require) so
 * tests can create it with fake dependencies.
 */

const express = require('express');
const helmet = require('helmet');
const corsMiddleware = require('./middleware/cors');
const { errorHandler } = require('./middleware/errorHandler');
const { authMiddleware } = require('./middleware/auth');
const { createRateLimiter } = require('./middleware/rateLimit');
const { createInspectionRouter } = require('./routes/inspections');

// Two signatures (<= 200 KB of base64 each) plus form answers fit comfortably.
const JSON_BODY_LIMIT = '1mb';

const createApp = ({ inspectionService }) => {
  const app = express();

  // Behind a reverse proxy (e.g. Render) req.ip would otherwise be the proxy's address.
  app.set('trust proxy', Number(process.env.TRUST_PROXY_HOPS ?? (process.env.NODE_ENV === 'production' ? 1 : 0)));

  app.use(helmet());
  app.use(corsMiddleware);
  app.use(express.json({ limit: JSON_BODY_LIMIT }));
  app.use(createRateLimiter({ windowMs: 15 * 60 * 1000, maxRequests: 300 }));

  app.get('/health', (req, res) => {
    res.json({ status: 'ok', timestamp: new Date().toISOString() });
  });

  // Everything under /api needs a valid Supabase-issued access token.
  app.use('/api', authMiddleware);
  app.use('/api/inspections', createInspectionRouter(inspectionService));

  app.use((req, res) => {
    res.status(404).json({
      success: false,
      error: { message: `Route not found: ${req.method} ${req.path}`, statusCode: 404 },
    });
  });

  app.use(errorHandler);
  return app;
};

module.exports = { createApp };
