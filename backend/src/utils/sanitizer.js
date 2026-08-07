/**
 * Basic server-side sanitizer for string inputs.
 * - trim: remove surrounding whitespace
 * - escape: neutralise HTML entities (XSS hardening)
 */
function sanitizeString(value, { escape = true } = {}) {
  if (typeof value !== 'string') return value;
  let out = value.trim();
  if (escape) {
    out = out
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#x27;');
  }
  return out;
}

/**
 * Recursively sanitize the raw request body. Leaves numbers, booleans and
 * nested plain objects intact; only strings are cleaned.
 */
function sanitizeObject(input) {
  if (Array.isArray(input)) return input.map(sanitizeObject);
  if (input && typeof input === 'object') {
    const out = {};
    for (const [key, value] of Object.entries(input)) {
      out[key] = sanitizeObject(value);
    }
    return out;
  }
  if (typeof input === 'string') return sanitizeString(input);
  return input;
}

module.exports = { sanitizeString, sanitizeObject };
