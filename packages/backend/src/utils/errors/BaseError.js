/*
 * LinguaQuiz - Copyright © 2025 Nikolay Eremeev
 *
 * Dual-licensed:
 *  - Non-Commercial Source-Available v2  →  see LICENSE-NONCOMMERCIAL.md
 *  - Commercial License v2               →  see LICENSE-COMMERCIAL.md
 *
 * Contact: lingua-quiz@nikolay-eremeev.com
 * Repository: https://github.com/nikolay-e/lingua-quiz
 * File: packages/backend/src/utils/errors/BaseError.js
 */

class BaseError extends Error {
  constructor(message, name, statusCode) {
    super(message);
    this.name = name;
    this.statusCode = statusCode;
  }
}

export default BaseError;
