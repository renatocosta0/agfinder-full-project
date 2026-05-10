/**
 * Custom error class for application errors
 * Extends the built-in Error class with status code and operational flag
 */
class AppError extends Error {
  /**
   * Create a new application error
   * @param {string} message - Error message
   * @param {number} statusCode - HTTP status code
   * @param {boolean} isOperational - Whether the error is operational (expected) or a programming error
   */
  constructor(message, statusCode = 500, isOperational = true) {
    super(message);
    this.name = this.constructor.name;
    this.statusCode = statusCode;
    this.status = `${statusCode}`.startsWith('4') ? 'fail' : 'error';
    this.isOperational = isOperational;
    
    // Capture stack trace (exclude constructor call from stack trace)
    Error.captureStackTrace(this, this.constructor);
  }
}

module.exports = AppError; 