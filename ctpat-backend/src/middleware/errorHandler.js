/**
 * Global error handling middleware
 * Must be registered LAST in the middleware stack
 */

class APIError extends Error {
  constructor(message, statusCode = 500) {
    super(message);
    this.statusCode = statusCode;
    this.name = 'APIError';
  }
}

/**
 * Express error handling middleware
 * Must have 4 parameters (err, req, res, next) to be recognized as error middleware
 */
const errorHandler = (err, req, res, next) => {
  // Log error to console in development
  if (process.env.NODE_ENV !== 'production') {
    console.error('🔴 Error:', {
      message: err.message,
      statusCode: err.statusCode || 500,
      stack: err.stack,
      path: req.path,
      method: req.method,
    });
  }

  const statusCode = err.statusCode || 500;
  const message = err.message || 'Internal Server Error';

  res.status(statusCode).json({
    success: false,
    error: {
      message,
      statusCode,
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

/**
 * Validate request body with a schema
 */
const validateRequest = (schema) => {
  return (req, res, next) => {
    const { error, value } = schema.validate(req.body, {
      abortEarly: false,
      stripUnknown: true,
    });

    if (error) {
      const messages = error.details.map((d) => d.message).join(', ');
      return res.status(400).json({
        success: false,
        error: {
          message: `Validation error: ${messages}`,
          statusCode: 400,
        },
      });
    }

    req.validatedBody = value;
    next();
  };
};

module.exports = {
  APIError,
  errorHandler,
  asyncHandler,
  validateRequest,
};
