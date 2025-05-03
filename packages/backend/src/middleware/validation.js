const { validationResult } = require('express-validator');

const { logger } = require('../config');
const { ValidationError } = require('../utils/errors');

/**
 * Middleware to validate request using express-validator
 * @param {Object} req - Express request object
 * @param {Object} res - Express response object
 * @param {Function} next - Express next function
 */
function validateRequest(req, res, next) {
  const errors = validationResult(req);

  if (!errors.isEmpty()) {
    logger.warn('Request validation failed', {
      errors: errors.array(),
      path: req.path,
      method: req.method,
    });

    return next(new ValidationError('Validation failed', errors.array()));
  }

  next();
}

module.exports = {
  validateRequest,
};
