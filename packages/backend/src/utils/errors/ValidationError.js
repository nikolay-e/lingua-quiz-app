/*
 * LinguaQuiz - Copyright © 2025 Nikolay Eremeev
 *
 * Dual-licensed:
 *  - Non-Commercial Source-Available v2  →  see LICENSE-NONCOMMERCIAL.md
 *  - Commercial License v2               →  see LICENSE-COMMERCIAL.md
 *
 * Contact: lingua-quiz@nikolay-eremeev.com
 * Repository: https://github.com/nikolay-e/lingua-quiz
 * File: packages/backend/src/utils/errors/ValidationError.js
 */

import BaseError from './BaseError.js';

class ValidationError extends BaseError {
  constructor(message, errors) {
    super(message, 'ValidationError', 400);
    this.errors = errors;
  }
}

export default ValidationError;
