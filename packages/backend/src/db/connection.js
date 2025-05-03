const { Pool } = require('pg');

const { ENV, logger } = require('../config');

// Create a connection pool
const pool = new Pool({
  host: process.env.DB_HOST || ENV.DB_HOST,
  port: process.env.DB_PORT ? Number(process.env.DB_PORT) : ENV.DB_PORT,
  database: process.env.POSTGRES_DB || ENV.POSTGRES_DB,
  user: process.env.POSTGRES_USER || ENV.POSTGRES_USER,
  password: process.env.POSTGRES_PASSWORD || ENV.POSTGRES_PASSWORD,
  max: ENV.DB_POOL_MAX,
  idleTimeoutMillis: ENV.DB_POOL_IDLE_TIMEOUT,
  connectionTimeoutMillis: ENV.DB_POOL_CONN_TIMEOUT,
});

// Set up event handlers
pool.on('connect', (client) => {
  logger.info(`Connected to the database (Client PID: ${client.processID})`);
});

pool.on('error', (err, client) => {
  logger.error('Database pool error', {
    error: err.message,
    clientInfo: client ? `Client PID: ${client.processID}` : 'N/A',
  });
});

// Graceful shutdown function
async function closePool() {
  try {
    await pool.end();
    logger.info('Database pool closed.');
    return true;
  } catch (error) {
    logger.error('Error closing database pool:', error);
    return false;
  }
}

// Health check function
async function checkConnection() {
  try {
    await pool.query('SELECT 1');
    return true;
  } catch (error) {
    logger.error('Database health check failed', { error: error.message });
    return false;
  }
}

module.exports = {
  pool,
  closePool,
  checkConnection,
};
