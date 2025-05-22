/*
 * LinguaQuiz - Copyright © 2025 Nikolay Eremeev
 *
 * Dual-licensed:
 *  - Non-Commercial Source-Available v2  →  see LICENSE-NONCOMMERCIAL.md
 *  - Commercial License v2               →  see LICENSE-COMMERCIAL.md
 *
 * Contact: lingua-quiz@nikolay-eremeev.com
 * Repository: https://github.com/nikolay-e/lingua-quiz
 * File: packages/backend/src/utils/errors/index.js
 */

import AuthenticationError from './AuthenticationError.js';
import AuthorizationError from './AuthorizationError.js';
import ConflictError from './ConflictError.js';
import DatabaseError from './DatabaseError.js';
import NotFoundError from './NotFoundError.js';
import ServiceUnavailableError from './ServiceUnavailableError.js';
import ValidationError from './ValidationError.js';

export { AuthenticationError, AuthorizationError, ConflictError, DatabaseError, NotFoundError, ServiceUnavailableError, ValidationError };
