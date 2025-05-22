/*
 * LinguaQuiz - Copyright © 2025 Nikolay Eremeev
 *
 * Dual-licensed:
 *  - Non-Commercial Source-Available v2  →  see LICENSE-NONCOMMERCIAL.md
 *  - Commercial License v2               →  see LICENSE-COMMERCIAL.md
 *
 * Contact: lingua-quiz@nikolay-eremeev.com
 * Repository: https://github.com/nikolay-e/lingua-quiz
 * File: packages/backend/src/utils/serviceErrorHandler.js
 */

import { logger } from '../config/index.js';

import {
  AuthenticationError,
  AuthorizationError,
  ConflictError,
  DatabaseError,
  NotFoundError,
  ServiceUnavailableError,
  ValidationError,
} from './errors.js';

/**
 * Wraps a service method with standardized error handling
 *
 * @param {Function} serviceMethod - The service method to wrap
 * @param {string} serviceName - The name of the service (for logging)
 * @param {string} methodName - The name of the method (for logging)
 * @returns {Function} The wrapped service method
 */
function withErrorHandling(serviceMethod, serviceName, methodName) {
  return async function errorHandlingWrapper(...args) {
    try {
      return await serviceMethod(...args);
    } catch (error) {
      // Already an application error, just pass it through
      if (
        error instanceof AuthenticationError ||
        error instanceof AuthorizationError ||
        error instanceof NotFoundError ||
        error instanceof ConflictError ||
        error instanceof ValidationError ||
        error instanceof ServiceUnavailableError ||
        error instanceof DatabaseError
      ) {
        logger.debug(`${serviceName}.${methodName} handled error:`, {
          errorType: error.name,
          message: error.message,
        });
        throw error;
      }

      // Map unexpected errors to appropriate application errors
      if (error.code === '23505') {
        // PostgreSQL unique violation
        logger.debug(`${serviceName}.${methodName} mapped database constraint error`, {
          originalError: error.message,
        });
        throw new ConflictError('Resource already exists', error);
      }

      if (error.code && error.code.startsWith('23')) {
        // Other PostgreSQL constraint errors
        logger.debug(`${serviceName}.${methodName} mapped database constraint error`, {
          originalError: error.message,
        });
        throw new ValidationError('Invalid data', error);
      }

      if (error.code === '42P01') {
        // PostgreSQL undefined table
        logger.error(`${serviceName}.${methodName} database schema error`, {
          originalError: error.message,
        });
        throw new DatabaseError('Database schema error', error);
      }

      // Fallback for all other errors
      logger.error(`${serviceName}.${methodName} unexpected error:`, {
        errorType: error.name || 'UnknownError',
        message: error.message,
        stack: error.stack,
      });
      throw new DatabaseError(`Unexpected error in ${serviceName}.${methodName}`, error);
    }
  };
}

export default withErrorHandling;
