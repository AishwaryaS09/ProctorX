class ApiError extends Error {
  constructor(statusCode, message, details) {
    super(message);
    this.statusCode = statusCode;
    this.details = details;
    this.isOperational = true;
    Error.captureStackTrace(this, this.constructor);
  }

  static badRequest(msg, details) {
    return new ApiError(400, msg || 'Bad request', details);
  }

  static unauthorized(msg) {
    return new ApiError(401, msg || 'Unauthorized');
  }

  static forbidden(msg) {
    return new ApiError(403, msg || 'Forbidden');
  }

  static notFound(msg) {
    return new ApiError(404, msg || 'Not found');
  }

  static conflict(msg) {
    return new ApiError(409, msg || 'Conflict');
  }

  static tooManyRequests(msg) {
    return new ApiError(429, msg || 'Too many requests');
  }
}

module.exports = ApiError;
