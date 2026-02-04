/**
 * Rate Limiting Middleware for embedded backend
 */

const { APIError } = require('./errorHandler');

class RateLimiter {
  constructor(options = {}) {
    this.windowMs = options.windowMs || 15 * 60 * 1000;
    this.maxRequests = options.maxRequests || 1000;
    this.requests = new Map();
  }

  middleware() {
    return (req, res, next) => {
      const key = req.ip || 'local';
      const now = Date.now();

      if (!this.requests.has(key)) {
        this.requests.set(key, []);
      }

      const requestTimes = this.requests.get(key);
      const validRequests = requestTimes.filter((time) => now - time < this.windowMs);
      this.requests.set(key, validRequests);

      if (validRequests.length >= this.maxRequests) {
        return next(new APIError('Too many requests', 429));
      }

      validRequests.push(now);
      next();
    };
  }

  clear() {
    this.requests.clear();
  }
}

const createRateLimiter = (options = {}) => {
  return new RateLimiter(options).middleware();
};

module.exports = {
  RateLimiter,
  createRateLimiter,
};
