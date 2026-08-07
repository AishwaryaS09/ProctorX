/**
 * Uniform API envelope: { success, message, data, errors }
 */
class ApiResponse {
  constructor(success, message, data, errors) {
    this.success = success;
    this.message = message || '';
    this.data = data !== undefined ? data : null;
    this.errors = errors || null;
  }

  static ok(data, message) {
    return new ApiResponse(true, message || 'OK', data);
  }

  static created(data, message) {
    return new ApiResponse(true, message || 'Created', data);
  }

  static fail(message, errors) {
    return new ApiResponse(false, message || 'Failed', null, errors);
  }
}

module.exports = ApiResponse;
