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
const db = require('../db');
const { ServiceUnavailableError } = require('../utils/errors');

/**
 * Performs health checks on system components
 * @returns {Promise<{ status: string, message: string, components: Object }>}
 */
async function checkHealth() {
  // Check database connection
  const dbHealth = await db.checkConnection();

  if (!dbHealth) {
    throw new ServiceUnavailableError('Service Unavailable: Cannot reach database');
  }

  return {
    status: 'ok',
    message: 'All systems operational',
    components: {
      database: {
        status: dbHealth ? 'ok' : 'error',
        message: dbHealth ? 'Database connection successful' : 'Cannot reach database',
      },
    },
  };
}

module.exports = {
  checkHealth,
};
