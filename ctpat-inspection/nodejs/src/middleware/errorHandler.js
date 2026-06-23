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
 */
const errorHandler = (err, req, res, next) => {
  if (process.env.NODE_ENV !== 'production') {
    console.error('🔴 Error:', {
      message: err.message,
      statusCode: err.statusCode || 500,
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
 */
const asyncHandler = (fn) => (req, res, next) => {
  Promise.resolve(fn(req, res, next)).catch(next);
};

const validateRequest = (schema) => {
  return (req, res, next) => {
    const { error, value } = schema.validate(req.body);
    if (error) {
      return next(new APIError(`Validation error: ${error.message}`, 400));
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
