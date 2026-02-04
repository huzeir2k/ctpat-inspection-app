const cors = require('cors');

/**
 * Configure CORS for embedded backend
 */
const corsOptions = {
  origin: (origin, callback) => {
    callback(null, true); // Allow all origins for embedded app
  },
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization', 'X-Requested-With', 'Idempotency-Key'],
  maxAge: 3600,
};

module.exports = cors(corsOptions);
