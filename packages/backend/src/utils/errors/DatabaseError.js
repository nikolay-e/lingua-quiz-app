/*
 * LinguaQuiz - Copyright © 2025 Nikolay Eremeev
 *
 * Dual-licensed:
 *  - Non-Commercial Source-Available v2  →  see LICENSE-NONCOMMERCIAL.md
 *  - Commercial License v2               →  see LICENSE-COMMERCIAL.md
 *
 * Contact: lingua-quiz@nikolay-eremeev.com
 * Repository: https://github.com/nikolay-e/lingua-quiz
 * File: packages/backend/src/utils/errors/DatabaseError.js
 */

import BaseError from './BaseError.js';

class DatabaseError extends BaseError {
  constructor(message, originalError) {
    super(message, 'DatabaseError', 500);
    this.originalError = originalError;
  }
}

export default DatabaseError;
