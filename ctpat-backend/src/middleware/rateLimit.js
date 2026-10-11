/**
 * Rate limiting, built on express-rate-limit.
 * Limits are per client IP unless a keyGenerator is supplied (e.g. per user).
 */

const rateLimit = require('express-rate-limit');
const { APIError } = require('./errorHandler');

const createRateLimiter = ({
  windowMs = 15 * 60 * 1000,
  maxRequests = 100,
  message = 'Too many requests, please try again later',
  keyGenerator,
} = {}) =>
  rateLimit({
    windowMs,
    limit: maxRequests,
    standardHeaders: true,
    legacyHeaders: false,
    ...(keyGenerator && { keyGenerator }),
    handler: (req, res, next) => next(new APIError(message, 429)),
  });

module.exports = { createRateLimiter };
