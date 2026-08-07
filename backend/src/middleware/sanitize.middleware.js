const { sanitizeObject } = require('../utils/sanitizer');

/**
 * Sanitizes req.body (and optional req.query/req.params) before validators run.
 * Order matters: sanitize -> validate -> controller.
 */
function sanitize(options = {}) {
  return (req, res, next) => {
    if (req.body && typeof req.body === 'object') {
      req.body = sanitizeObject(req.body);
    }
    if (options.query && req.query && typeof req.query === 'object') {
      req.query = sanitizeObject(req.query);
    }
    next();
  };
}

module.exports = { sanitize };
