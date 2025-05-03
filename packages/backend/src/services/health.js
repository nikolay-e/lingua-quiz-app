const db = require('../db');
const { ServiceUnavailableError } = require('../utils/errors');

/**
 * Performs health checks on system components
 * @returns {Promise<{ status: string, message: string, components: Object }>}
 */
async function checkHealth() {
  try {
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
  } catch (error) {
    throw error;
  }
}

module.exports = {
  checkHealth,
};
