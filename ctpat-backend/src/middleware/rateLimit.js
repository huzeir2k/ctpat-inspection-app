/**
 * Rate Limiting Middleware
 * Prevents abuse and DoS attacks
 */

const { APIError } = require('./errorHandler');

/**
 * Simple in-memory rate limiter
 * For production, use redis-based rate limiting
 */
class RateLimiter {
  constructor(options = {}) {
    this.windowMs = options.windowMs || 15 * 60 * 1000; // 15 minutes
    this.maxRequests = options.maxRequests || 100; // requests per window
    this.message = options.message || 'Too many requests, please try again later';
    this.keyGenerator = options.keyGenerator || ((req) => req.ip);
    this.skip = options.skip || (() => false);

    this.requests = new Map();
  }

  middleware() {
    return (req, res, next) => {
      if (this.skip(req)) {
        return next();
      }

      const key = this.keyGenerator(req);
      const now = Date.now();

      // Initialize or get request list for this key
      if (!this.requests.has(key)) {
        this.requests.set(key, []);
      }

      const requestTimes = this.requests.get(key);

      // Remove old requests outside the window
      const validRequests = requestTimes.filter((time) => now - time < this.windowMs);
      this.requests.set(key, validRequests);

      // Check if limit exceeded
      if (validRequests.length >= this.maxRequests) {
        return next(new APIError(this.message, 429));
      }

      // Add current request
      validRequests.push(now);

      // Add rate limit headers
      res.setHeader('RateLimit-Limit', this.maxRequests);
      res.setHeader('RateLimit-Remaining', this.maxRequests - validRequests.length);
      res.setHeader(
        'RateLimit-Reset',
        new Date(now + this.windowMs).toISOString()
      );

      next();
    };
  }

  /**
   * Reset rate limit for a key (admin/whitelist purposes)
   */
  reset(key) {
    this.requests.delete(key);
  }

  /**
   * Clear all rate limits
   */
  clear() {
    this.requests.clear();
  }
}

/**
 * Factory function to create rate limiters with different configurations
 */
const createRateLimiter = (options = {}) => {
  return new RateLimiter(options).middleware();
};

module.exports = {
  RateLimiter,
  createRateLimiter,
};
