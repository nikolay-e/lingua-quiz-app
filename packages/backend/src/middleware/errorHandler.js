const { ENV, logger } = require('../config');
const {
  DatabaseError,
  AuthenticationError,
  AuthorizationError,
  ValidationError,
  NotFoundError,
  ConflictError,
  ServiceUnavailableError,
} = require('../utils/errors');

/**
 * Global error handling middleware
 * @param {Error} err - The error object
 * @param {Object} req - Express request object
 * @param {Object} res - Express response object
 * @param {Function} next - Express next function
 */
function errorHandler(err, req, res, _next) {
  // Log error details but be careful with sensitive information
  logger.error('Error occurred:', {
    message: err.message,
    name: err.name,
    statusCode: err.statusCode,
    errorCode: err.code,
    url: req.originalUrl || req.url,
    method: req.method,
    ip: req.ip,
    // Don't log the full stack trace or original error in production
    ...(ENV.NODE_ENV !== 'production' && {
      stack: err.stack,
      originalError: err.originalError ? err.originalError.message : undefined,
    }),
  });

  // Set default status code and message
  const statusCode = err.statusCode || 500;
  let userMessage = 'An unexpected error occurred. Please try again later.';

  // Customize messages based on error type
  if (err instanceof ValidationError) {
    userMessage = 'Invalid request data.';
  } else if (err instanceof AuthenticationError) {
    userMessage = 'Authentication failed.';
  } else if (err instanceof AuthorizationError) {
    userMessage = 'You do not have permission to access this resource.';
  } else if (err instanceof NotFoundError) {
    userMessage = 'The requested resource was not found.';
  } else if (err instanceof ConflictError) {
    userMessage = 'Conflict: The resource already exists or cannot be created.';
  } else if (err instanceof ServiceUnavailableError) {
    userMessage = 'Service currently unavailable. Please try again later.';
  } else if (err instanceof DatabaseError) {
    userMessage = 'A database error occurred. Please try again later.';
  } else if (statusCode >= 500) {
    userMessage = 'An internal server error occurred.';
  }

  // Prepare response
  const responseBody = { message: userMessage };

  // Include detailed error information in non-production environments
  // or for non-server errors that are safe to expose
  if (ENV.NODE_ENV !== 'production' || statusCode < 500) {
    responseBody.error = {
      message: err.message,
      code: err.code,
      ...(err.errors && { errors: err.errors }),
    };
  }

  res.status(statusCode).json(responseBody);
}

module.exports = errorHandler;
