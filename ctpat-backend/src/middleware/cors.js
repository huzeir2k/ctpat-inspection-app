const cors = require('cors');

/**
 * Configure CORS to allow requests from React Native app
 * In production, CORS_ORIGIN must be set to specific domain(s)
 */
const corsOptions = {
  origin: (origin, callback) => {
    const allowedOrigins = process.env.CORS_ORIGIN
      ? process.env.CORS_ORIGIN.split(',').map(o => o.trim())
      : ['http://localhost:3000', 'http://localhost:8081', 'http://127.0.0.1:8081'];

    // Allow requests with no origin (like mobile apps or curl requests)
    if (!origin || allowedOrigins.indexOf(origin) !== -1) {
      callback(null, true);
    } else if (process.env.NODE_ENV !== 'production') {
      // In development, be more permissive
      callback(null, true);
    } else {
      callback(new Error('Not allowed by CORS'));
    }
  },
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization', 'X-Requested-With', 'Idempotency-Key'],
  maxAge: 3600, // 1 hour
};

module.exports = cors(corsOptions);
