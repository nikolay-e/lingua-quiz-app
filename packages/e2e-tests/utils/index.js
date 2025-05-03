/*
 * LinguaQuiz – Copyright © 2025 Nikolay Eremeev
 *
 * Dual-licensed:
 *  – Non-Commercial Source-Available v2  →  see LICENSE-NONCOMMERCIAL.md
 *  – Commercial License v2              →  see LICENSE-COMMERCIAL.md
 *
 * Contact: lingua-quiz@nikolay-eremeev.com
 * Repository: https://github.com/nikolay-e/lingua-quiz
 */

// packages/e2e-tests/utils/index.js
import { QUIZ_CONSTANTS, AUTH_CONSTANTS } from './constants';
import { log, logToBoth, createLogger } from './logging';

export default {
  // Logging utilities
  log,
  logToBoth,
  createLogger,

  // Constants
  QUIZ_CONSTANTS,
  AUTH_CONSTANTS,
};
