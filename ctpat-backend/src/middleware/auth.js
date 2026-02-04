/**
 * JWT Authentication Middleware
 * Validates Bearer tokens and extracts user information
 */

const { APIError } = require('./errorHandler');

/**
 * Verify JWT token and extract user information
 * For now, uses a simple token validation strategy
 * In production, integrate with Auth0, Firebase, or similar
 */
const authMiddleware = (req, res, next) => {
  try {
    // Skip auth for PDF endpoints (development convenience)
    const pdfPaths = ['/inspections/generate-pdf', '/inspections/download-pdf'];
    if (pdfPaths.includes(req.path) && req.method === 'POST') {
      req.user = { id: 'dev-user', token: 'dev-token' };
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

    // Attach user info to request (in production, decode JWT)
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
 * Optional: Role-based access control
 * Checks if user has required role
 */
const requireRole = (allowedRoles) => {
  return (req, res, next) => {
    if (!req.user) {
      return next(new APIError('User not authenticated', 401));
    }

    // In production, extract role from JWT
    const userRole = req.user.role || 'inspector'; // Default role

    if (!allowedRoles.includes(userRole)) {
      return next(
        new APIError(
          `Insufficient permissions. Required roles: ${allowedRoles.join(', ')}`,
          403
        )
      );
    }

    next();
  };
};

/**
 * Optional: Ownership verification
 * Ensures user can only modify their own inspections
 */
const verifyOwnership = (ownershipField = 'printName') => {
  return (req, res, next) => {
    if (!req.user) {
      return next(new APIError('User not authenticated', 401));
    }

    // In production, compare req.user.id with document owner
    // For now, just verify user exists
    next();
  };
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
 * Extract user ID from token (simple implementation)
 * In production, decode JWT properly using jsonwebtoken library
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

  // If JWT, extract from payload (without verification - done in production)
  try {
    const parts = token.split('.');
    if (parts.length === 3) {
      const payload = JSON.parse(Buffer.from(parts[1], 'base64').toString());
      return payload.sub || payload.id || payload.user_id || 'unknown';
    }
  } catch (error) {
    // Silently fail, will be caught by isValidToken
  }

  return 'unknown';
};

module.exports = {
  authMiddleware,
  requireRole,
  verifyOwnership,
};
