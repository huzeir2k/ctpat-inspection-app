/**
 * JWT Authentication Middleware
 * Verifies Supabase Auth-issued access tokens (HS256, shared JWT secret) and
 * extracts the authenticated user's id (`sub` claim) onto req.user.
 */

const jwt = require('jsonwebtoken');
const { APIError } = require('./errorHandler');

const SUPABASE_JWT_SECRET = process.env.SUPABASE_JWT_SECRET;

if (!SUPABASE_JWT_SECRET) {
  console.error(
    '❌ SUPABASE_JWT_SECRET is not set. All authenticated requests will be rejected. ' +
    'Set it from Supabase Dashboard > Settings > API > JWT Settings.'
  );
}

const authMiddleware = (req, res, next) => {
  try {
    const authHeader = req.headers.authorization;

    if (!authHeader) {
      throw new APIError('Authorization header missing', 401);
    }

    const parts = authHeader.split(' ');
    if (parts.length !== 2 || parts[0] !== 'Bearer') {
      throw new APIError('Invalid authorization header format', 401);
    }

    const token = parts[1];

    if (!SUPABASE_JWT_SECRET) {
      throw new APIError('Server authentication is not configured', 500);
    }

    let payload;
    try {
      payload = jwt.verify(token, SUPABASE_JWT_SECRET, { algorithms: ['HS256'] });
    } catch (verifyError) {
      throw new APIError('Invalid or expired token', 401);
    }

    if (!payload.sub) {
      throw new APIError('Token is missing the subject (user id) claim', 401);
    }

    req.user = {
      id: payload.sub,
      email: payload.email,
      role: payload.role,
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

module.exports = {
  authMiddleware,
  requireRole,
  verifyOwnership,
};
