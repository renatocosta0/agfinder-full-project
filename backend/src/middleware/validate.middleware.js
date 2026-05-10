/**
 * Validation middleware for API requests
 */

const AppError = require('../utils/AppError');
const logger = require('../utils/logger');

/**
 * Creates a validation middleware using a Joi schema
 * @param {Object} schema - Joi validation schema
 * @returns {Function} Express middleware function
 */
const validate = (schema) => (req, res, next) => {
  const validationOptions = {
    abortEarly: false, // Return all errors
    allowUnknown: true, // Allow unknown fields which will be stripped
    stripUnknown: true // Strip unknown fields
  };

  // Fields to validate from schema
  const validationFields = ['params', 'query', 'body', 'headers'];
  let validationErrors = [];

  // Validate each field in the schema
  validationFields.forEach(field => {
    if (schema[field]) {
      const { error, value } = schema[field].validate(
        req[field],
        validationOptions
      );

      // Store validated values
      req[field] = value;

      // Collect errors
      if (error) {
        validationErrors = validationErrors.concat(
          error.details.map(detail => ({
            field,
            path: detail.path.join('.'),
            message: detail.message
          }))
        );
      }
    }
  });

  // If there are validation errors, return a formatted error response
  if (validationErrors.length > 0) {
    logger.debug('Validation errors:', { errors: validationErrors });

    // Format a user-friendly error message
    const firstError = validationErrors[0];
    const errorMessage = firstError.message;

    return next(new AppError(errorMessage, 400));
  }

  return next();
};

module.exports = validate; 