const jwt = require('jsonwebtoken');

const { env } = require('../config/env');
const ApiError = require('../utils/ApiError');
const asyncHandler = require('../utils/asyncHandler');
const User = require('../models/User');

/**
 * Extract a bearer token from the Authorization header or the JWT cookie.
 */
function extractToken(req) {
  const header = req.headers.authorization;
  if (header && header.startsWith('Bearer ')) {
    return header.slice(7).trim();
  }
  const cookie = req.cookies && req.cookies[env.jwtCookieName];
  return cookie || null;
}

/**
 * Verify JWT and attach the current user to req.user. Rejects when the token
 * is missing, invalid or the referenced account no longer exists.
 */
const protect = asyncHandler(async (req, res, next) => {
  const token = extractToken(req);
  if (!token) {
    throw ApiError.unauthorized('Not authenticated. Please log in.');
  }

  let payload;
  try {
    payload = jwt.verify(token, env.jwtSecret);
  } catch (err) {
    throw ApiError.unauthorized('Invalid or expired token. Please log in again.');
  }

  const user = await User.findById(payload.id);
  if (!user) {
    throw ApiError.unauthorized('Account no longer exists.');
  }

  req.user = user;
  req.token = token;
  next();
});

/**
 * Restrict a protected route to specific roles (e.g. ['admin']).
 */
const requireRole = (...roles) => (req, res, next) => {
  if (!req.user || !roles.includes(req.user.role)) {
    throw ApiError.forbidden('You do not have permission to access this resource.');
  }
  next();
};

module.exports = { protect, requireRole, extractToken };
