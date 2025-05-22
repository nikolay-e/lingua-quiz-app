/*
 * LinguaQuiz - Copyright © 2025 Nikolay Eremeev
 *
 * Dual-licensed:
 *  - Non-Commercial Source-Available v2  →  see LICENSE-NONCOMMERCIAL.md
 *  - Commercial License v2               →  see LICENSE-COMMERCIAL.md
 *
 * Contact: lingua-quiz@nikolay-eremeev.com
 * Repository: https://github.com/nikolay-e/lingua-quiz
 * File: packages/backend/src/utils/errors/AuthenticationError.js
 */

import BaseError from './BaseError.js';

class AuthenticationError extends BaseError {
  constructor(message) {
    super(message, 'AuthenticationError', 401);
  }
}

export default AuthenticationError;
