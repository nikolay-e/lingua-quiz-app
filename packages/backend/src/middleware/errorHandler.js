/*
 * LinguaQuiz - Copyright © 2025 Nikolay Eremeev
 *
 * Dual-licensed:
 *  - Non-Commercial Source-Available v2  →  see LICENSE-NONCOMMERCIAL.md
 *  - Commercial License v2               →  see LICENSE-COMMERCIAL.md
 *
 * Contact: lingua-quiz@nikolay-eremeev.com
 * Repository: https://github.com/nikolay-e/lingua-quiz
 * File: packages/backend/src/middleware/errorHandler.js
 */

import { ENV, logger } from '../config/index.js';
import {
  AuthenticationError,
  AuthorizationError,
  ConflictError,
  DatabaseError,
  NotFoundError,
  ServiceUnavailableError,
  ValidationError,
} from '../utils/errors.js';

function errorHandler(err, req, res, _next) {
  // Log error details but be careful with sensitive information
  logger.error('Error occurred:', {
    errorCode: err.code,
    ip: req.ip,
    message: err.message,
    method: req.method,
    name: err.name,
    statusCode: err.statusCode,
    url: req.originalUrl || req.url,
    // Don't log the full stack trace or original error in production
    ...(ENV.NODE_ENV !== 'production' && {
      originalError: err.originalError ? err.originalError.message : undefined,
      stack: err.stack,
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
  const responseBody = {
    message: userMessage,
  };
  // Include detailed error information in non-production environments
  // or for non-server errors that are safe to expose
  if (ENV.NODE_ENV !== 'production' || statusCode < 500) {
    responseBody.error = {
      code: err.code,
      message: err.message,
      ...(err.errors && { errors: err.errors }),
    };
  }
  res.status(statusCode).json(responseBody);
}
export default errorHandler;
