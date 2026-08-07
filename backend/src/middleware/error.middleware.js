const ApiError = require('../utils/ApiError');
const logger = require('../utils/logger');

/**
 * Catches 404s for unknown API routes.
 */
function notFound(req, res, next) {
  next(ApiError.notFound(`Route not found: ${req.method} ${req.originalUrl}`));
}

/**
 * Central error handler. Converts every thrown value into a structured JSON
 * response and never leaks stack traces outside development.
 */
function errorHandler(err, req, res, next) {
  let status = err.statusCode || 500;
  let message = err.message || 'Internal server error';
  let details = err.details || null;

  if (err.name === 'ValidationError' && err.isJoi === undefined && !err.isOperational) {
    status = 400;
    message = 'Validation error';
    details = err.message;
  }

  if (err.name === 'CastError') {
    status = 400;
    message = 'Invalid resource identifier';
  }

  if (err.name === 'JsonWebTokenError' || err.name === 'TokenExpiredError') {
    status = 401;
    message = 'Invalid or expired token';
  }

  if (err.code === 11000) {
    status = 409;
    const field = Object.keys(err.keyValue || {})[0] || 'field';
    message = `A record with this ${field} already exists.`;
  }

  if (status >= 500) {
    logger.error('Unhandled error', { message, stack: err.stack });
  }

  res.status(status).json({
    success: false,
    message,
    data: null,
    errors: details,
  });
}

module.exports = { notFound, errorHandler };
