const rateLimit = require('express-rate-limit');

const ApiError = require('../utils/ApiError');

/**
 * Generic rate limiter.
 */
const createLimiter = ({ windowMs = 60 * 1000, max = 100, message = 'Too many requests. Please slow down.' } = {}) =>
  rateLimit({
    windowMs,
    max,
    standardHeaders: true,
    legacyHeaders: false,
    handler: (req, res, next) => next(ApiError.tooManyRequests(message)),
  });

/**
 * Stricter limiter for authentication endpoints to slow brute-force attempts.
 */
const authLimiter = createLimiter({ windowMs: 15 * 60 * 1000, max: 20, message: 'Too many login attempts. Try again later.' });

/**
 * Global API limiter applied to every /api request.
 */
const apiLimiter = createLimiter({ windowMs: 60 * 1000, max: 300 });

module.exports = { createLimiter, authLimiter, apiLimiter };
