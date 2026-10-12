/**
 * Authentication middleware.
 *
 * Verifies the access token Supabase Auth issued to the signed-in user and puts
 * the user's id (the token's `sub` claim) on req.user.
 *
 * Supabase signs tokens in one of two ways, and both are supported:
 *   - ES256 / RS256 (current projects): checked against the project's PUBLIC keys,
 *     downloaded from <SUPABASE_URL>/auth/v1/.well-known/jwks.json. No secret needed.
 *   - HS256 (older projects): checked against the shared secret SUPABASE_JWT_SECRET.
 *
 * Every token must also name this project as its issuer and be meant for signed-in
 * users (audience "authenticated"), so the public anon key can never act as a user.
 */

const { createRemoteJWKSet, jwtVerify, decodeProtectedHeader } = require('jose');
const { APIError } = require('./errorHandler');

const AUDIENCE = 'authenticated';
const ASYMMETRIC_ALGORITHMS = ['ES256', 'RS256'];

/**
 * Builds an async function that returns the verified token payload or throws.
 * `supabaseUrl` enables ES256/RS256 tokens; `jwtSecret` enables HS256 tokens.
 */
const createTokenVerifier = ({ supabaseUrl, jwtSecret }) => {
  const issuer = supabaseUrl ? `${supabaseUrl.replace(/\/+$/, '')}/auth/v1` : undefined;

  // jose downloads the keys once, caches them, and re-fetches when it sees an unknown
  // key id (key rotation). The cooldown stops a stream of bad tokens from hammering Supabase.
  const publicKeys = issuer
    ? createRemoteJWKSet(new URL(`${issuer}/.well-known/jwks.json`), {
        cacheMaxAge: 10 * 60 * 1000,
        cooldownDuration: 30 * 1000,
      })
    : null;
  const sharedSecret = jwtSecret ? new TextEncoder().encode(jwtSecret) : null;

  return async (token) => {
    const { alg } = decodeProtectedHeader(token);
    const checks = { audience: AUDIENCE, ...(issuer && { issuer }) };

    if (alg === 'HS256' && sharedSecret) {
      return (await jwtVerify(token, sharedSecret, { ...checks, algorithms: ['HS256'] })).payload;
    }
    if (ASYMMETRIC_ALGORITHMS.includes(alg) && publicKeys) {
      return (await jwtVerify(token, publicKeys, { ...checks, algorithms: ASYMMETRIC_ALGORITHMS })).payload;
    }
    // Includes "none", and any algorithm this server is not configured for.
    throw new Error(`Unsupported or unconfigured token algorithm: ${alg}`);
  };
};

/**
 * `getConfig` is called once, on the first request, so environment variables are
 * read after dotenv has loaded them and tests can supply their own values.
 */
const createAuthMiddleware = (getConfig) => {
  let verifier;
  const getVerifier = () => {
    if (verifier === undefined) {
      const config = getConfig();
      verifier = config.supabaseUrl || config.jwtSecret ? createTokenVerifier(config) : null;
      if (!verifier) {
        console.error('❌ Neither SUPABASE_URL nor SUPABASE_JWT_SECRET is set. All authenticated requests will be rejected.');
      }
    }
    return verifier;
  };

  return async (req, res, next) => {
    try {
      const authHeader = req.headers.authorization;
      if (!authHeader) {
        throw new APIError('Authorization header missing', 401);
      }

      const parts = authHeader.split(' ');
      if (parts.length !== 2 || parts[0] !== 'Bearer') {
        throw new APIError('Invalid authorization header format', 401);
      }

      const verify = getVerifier();
      if (!verify) {
        throw new APIError('Server authentication is not configured', 500);
      }

      let payload;
      try {
        payload = await verify(parts[1]);
      } catch (verifyError) {
        // The reason goes to the server log only; the caller learns nothing about it.
        if (process.env.NODE_ENV !== 'test') {
          console.warn(`Token rejected: ${verifyError.code || verifyError.message}`);
        }
        throw new APIError('Invalid or expired token', 401);
      }

      if (!payload.sub) {
        throw new APIError('Token is missing the subject (user id) claim', 401);
      }

      req.user = { id: payload.sub, email: payload.email, role: payload.role };
      next();
    } catch (error) {
      next(error instanceof APIError ? error : new APIError('Authentication failed', 401));
    }
  };
};

const authMiddleware = createAuthMiddleware(() => ({
  supabaseUrl: process.env.SUPABASE_URL,
  jwtSecret: process.env.SUPABASE_JWT_SECRET,
}));

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
  createAuthMiddleware,
  requireRole,
  verifyOwnership,
};
