/**
 * Global error handling middleware
 * Must be registered LAST in the middleware stack
 */

class APIError extends Error {
  constructor(message, statusCode = 500, details = undefined) {
    super(message);
    this.statusCode = statusCode;
    this.details = details;
    this.name = 'APIError';
  }
}

/**
 * Express error handling middleware
 * Must have 4 parameters (err, req, res, next) to be recognized as error middleware
 */
const errorHandler = (err, req, res, next) => {
  if (process.env.NODE_ENV === 'production') {
    if (!(err instanceof APIError)) console.error('Unhandled error:', err.message);
  } else if (process.env.NODE_ENV !== 'test') {
    console.error('🔴 Error:', {
      message: err.message,
      statusCode: err.statusCode || 500,
      stack: err.stack,
      path: req.path,
      method: req.method,
    });
  }

  const statusCode = err.statusCode || 500;
  const isExpected = err instanceof APIError || err.expose === true; // APIError or body-parser error
  // Never leak internals (database, storage, library messages) for unexpected failures.
  const message =
    isExpected || process.env.NODE_ENV !== 'production' ? err.message || 'Internal Server Error' : 'Internal Server Error';

  res.status(statusCode).json({
    success: false,
    error: {
      message,
      statusCode,
      ...(err.details && { details: err.details }),
      ...(process.env.NODE_ENV !== 'production' && { stack: err.stack }),
    },
  });
};

/**
 * Async error wrapper
 * Wraps async route handlers to catch errors
 */
const asyncHandler = (fn) => (req, res, next) => {
  Promise.resolve(fn(req, res, next)).catch(next);
};

module.exports = {
  APIError,
  errorHandler,
  asyncHandler,
};
