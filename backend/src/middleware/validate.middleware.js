const { validationResult } = require('express-validator');

const ApiError = require('../utils/ApiError');

/**
 * Runs express-validator chain results and returns a 400 with field errors.
 * Usage: router.post('/', validators.login, validate, handler)
 */
function validate(req, res, next) {
  const errors = validationResult(req);
  if (errors.isEmpty()) {
    return next();
  }
  const details = errors.array().map((e) => ({ field: e.path || e.param, message: e.msg }));
  return next(ApiError.badRequest('Validation failed', details));
}

module.exports = { validate };
