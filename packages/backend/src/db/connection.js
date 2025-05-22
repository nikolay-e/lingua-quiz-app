/*
 * LinguaQuiz - Copyright © 2025 Nikolay Eremeev
 *
 * Dual-licensed:
 *  - Non-Commercial Source-Available v2  →  see LICENSE-NONCOMMERCIAL.md
 *  - Commercial License v2               →  see LICENSE-COMMERCIAL.md
 *
 * Contact: lingua-quiz@nikolay-eremeev.com
 * Repository: https://github.com/nikolay-e/lingua-quiz
 * File: packages/backend/src/db/connection.js
 */

import pg from 'pg';

import { ENV, logger } from '../config/index.js';
import { ServiceUnavailableError } from '../utils/errors.js';

const { Pool } = pg;

// Create a connection pool with retry logic
let pool;

async function createPoolWithRetry(retries = 10, initialDelay = 5000) {
  try {
    // Log connection params for debug purposes (but mask password)
    const dbHost = process.env.DB_HOST || ENV.DB_HOST;
    const dbPort = process.env.DB_PORT ? Number(process.env.DB_PORT) : ENV.DB_PORT;
    const dbName = process.env.POSTGRES_DB || ENV.POSTGRES_DB;
    const dbUser = process.env.POSTGRES_USER || ENV.POSTGRES_USER;

    logger.info(`Attempting to connect to database at ${dbHost}:${dbPort}/${dbName} as ${dbUser}`);

    const connectionConfig = {
      connectionTimeoutMillis: ENV.DB_POOL_CONN_TIMEOUT,
      database: dbName,
      host: dbHost,
      idleTimeoutMillis: ENV.DB_POOL_IDLE_TIMEOUT,
      max: ENV.DB_POOL_MAX,
      password: process.env.POSTGRES_PASSWORD || ENV.POSTGRES_PASSWORD,
      port: dbPort,
      user: dbUser,
    };

    const newPool = new Pool(connectionConfig);

    // Test the connection
    logger.info('Testing database connection...');
    await newPool.query('SELECT 1');
    logger.info('Successfully connected to database');

    return newPool;
  } catch (error) {
    if (retries > 0) {
      const delay = initialDelay;
      logger.warn(`Database connection failed. Retrying in ${delay}ms...`, {
        error: error.message,
        retriesLeft: retries - 1,
      });

      // If DEBUG env is set, log more detailed error info
      if (process.env.DEBUG === 'true') {
        logger.debug('Database connection error details:', {
          dbHost: process.env.DB_HOST || ENV.DB_HOST,
          dbPort: process.env.DB_PORT || ENV.DB_PORT,
          errorCode: error.code,
          errorStack: error.stack,
        });
      }

      await new Promise((resolve) => {
        setTimeout(resolve, delay);
      });
      return createPoolWithRetry(retries - 1, Math.min(delay * 1.5, 30_000)); // Cap max delay at 30 seconds
    }

    logger.error('Failed to connect to database after multiple retries', {
      dbHost: process.env.DB_HOST || ENV.DB_HOST,
      dbPort: process.env.DB_PORT || ENV.DB_PORT,
      error: error.message,
      errorCode: error.code,
    });
    throw new ServiceUnavailableError('Database connection failed after multiple retries', error);
  }
}

// Initialize the pool
async function initPool() {
  pool = await createPoolWithRetry();

  // Set up event handlers
  pool.on('connect', (client) => {
    logger.info(`Connected to the database (Client PID: ${client.processID})`);
  });

  pool.on('error', (err, client) => {
    logger.error('Database pool error', {
      clientInfo: client ? `Client PID: ${client.processID}` : 'N/A',
      error: err.message,
    });
  });

  return pool;
}

// Graceful shutdown function
async function closePool() {
  try {
    if (pool) {
      await pool.end();
      logger.info('Database pool closed.');

      return true;
    }
    return true;
  } catch (error) {
    logger.error('Error closing database pool:', error);
    return false;
  }
}

// Health check function
async function checkConnection() {
  try {
    if (!pool) {
      return false;
    }
    await pool.query('SELECT 1');

    return true;
  } catch (error) {
    logger.error('Database health check failed', { error: error.message });
    return false;
  }
}

// We now initialize the pool explicitly in app.js before starting the server
// rather than automatically in an IIFE to prevent race conditions

export { checkConnection, closePool, initPool, pool };
