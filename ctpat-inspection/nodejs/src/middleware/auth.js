/**
 * JWT Authentication Middleware
 * Validates Bearer tokens and extracts user information
 */

const { APIError } = require('./errorHandler');

/**
 * Verify JWT token and extract user information
 * For embedded backend: uses simple token validation
 */
const authMiddleware = (req, res, next) => {
  try {
    // Skip auth for health check and PDF endpoints
    const skipAuthPaths = [
      '/health',
      '/inspections/generate-pdf',
      '/inspections/download-pdf',
      '/inspections/clear-all/all',
    ];
    if (skipAuthPaths.includes(req.path)) {
      req.user = { id: 'local-user', token: 'local-token' };
      return next();
    }

    const authHeader = req.headers.authorization;

    if (!authHeader) {
      throw new APIError('Authorization header missing', 401);
    }

    const parts = authHeader.split(' ');
    if (parts.length !== 2 || parts[0] !== 'Bearer') {
      throw new APIError('Invalid authorization header format', 401);
    }

    const token = parts[1];

    // Validate token format (UUID or JWT-like)
    if (!isValidToken(token)) {
      throw new APIError('Invalid token format', 401);
    }

    // Attach user info to request
    req.user = {
      id: extractUserIdFromToken(token),
      token: token,
    };

    next();
  } catch (error) {
    if (error instanceof APIError) {
      return next(error);
    }
    next(new APIError('Authentication failed', 401));
  }
};

/**
 * Simple token validation
 * Accepts UUID v4 format or JWT-like strings
 */
const isValidToken = (token) => {
  // UUID v4 pattern
  const uuidPattern =
    /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

  // JWT pattern (3 parts separated by dots)
  const jwtPattern = /^[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+\.[A-Za-z0-9_-]*$/;

  return uuidPattern.test(token) || jwtPattern.test(token);
};

/**
 * Extract user ID from token
 */
const extractUserIdFromToken = (token) => {
  // If UUID, use as ID
  if (
    /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(
      token
    )
  ) {
    return token;
  }

  // If JWT, extract from payload
  try {
    const parts = token.split('.');
    if (parts.length === 3) {
      const payload = JSON.parse(Buffer.from(parts[1], 'base64').toString());
      return payload.sub || payload.id || payload.user_id || 'local-user';
    }
  } catch (error) {
    // Silently fail
  }

  return 'local-user';
};

module.exports = {
  authMiddleware,
};
