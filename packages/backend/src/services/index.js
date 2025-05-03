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
const authService = require('./auth');
const healthService = require('./health');
const wordSetsService = require('./wordSets');

module.exports = {
  authService,
  healthService,
  wordSetsService,
};
