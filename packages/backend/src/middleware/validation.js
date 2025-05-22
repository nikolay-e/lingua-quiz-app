/*
 * LinguaQuiz - Copyright © 2025 Nikolay Eremeev
 *
 * Dual-licensed:
 *  - Non-Commercial Source-Available v2  →  see LICENSE-NONCOMMERCIAL.md
 *  - Commercial License v2               →  see LICENSE-COMMERCIAL.md
 *
 * Contact: lingua-quiz@nikolay-eremeev.com
 * Repository: https://github.com/nikolay-e/lingua-quiz
 * File: packages/backend/src/middleware/validation.js
 */

import { validationResult } from 'express-validator';

import { logger } from '../config/index.js';
import { ValidationError } from '../utils/errors.js';

function validateRequest(req, res, next) {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    logger.warn('Request validation failed', {
      errors: errors.array(),
      method: req.method,
      path: req.path,
    });
    return next(new ValidationError('Validation failed', errors.array()));
  }
  return next();
}

export default validateRequest;
