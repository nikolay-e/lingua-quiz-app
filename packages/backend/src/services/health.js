/*
 * LinguaQuiz - Copyright © 2025 Nikolay Eremeev
 *
 * Dual-licensed:
 *  - Non-Commercial Source-Available v2  →  see LICENSE-NONCOMMERCIAL.md
 *  - Commercial License v2               →  see LICENSE-COMMERCIAL.md
 *
 * Contact: lingua-quiz@nikolay-eremeev.com
 * Repository: https://github.com/nikolay-e/lingua-quiz
 * File: packages/backend/src/services/health.js
 */

import { checkConnection } from '../db/index.js';
import { ServiceUnavailableError } from '../utils/errors.js';

async function checkHealth() {
  try {
    // Check database connection
    const dbHealth = await checkConnection();

    if (!dbHealth) {
      throw new ServiceUnavailableError('Service Unavailable: Cannot reach database');
    }

    return {
      components: {
        api: {
          message: 'API server running',
          status: 'ok',
        },
        database: {
          message: 'Database connection successful',
          status: 'ok',
        },
      },
      message: 'All systems operational',
      status: 'ok',
      timestamp: new Date().toISOString(),
      uptime: `${Math.round(process.uptime())}s`,
      version: process.env.npm_package_version || 'unknown',
    };
  } catch (error) {
    if (error instanceof ServiceUnavailableError) {
      throw error;
    }
    throw new ServiceUnavailableError('Service health check failed', error);
  }
}
export default checkHealth;
