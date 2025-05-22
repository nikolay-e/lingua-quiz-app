/*
 * LinguaQuiz - Copyright © 2025 Nikolay Eremeev
 *
 * Dual-licensed:
 *  - Non-Commercial Source-Available v2  →  see LICENSE-NONCOMMERCIAL.md
 *  - Commercial License v2               →  see LICENSE-COMMERCIAL.md
 *
 * Contact: lingua-quiz@nikolay-eremeev.com
 * Repository: https://github.com/nikolay-e/lingua-quiz
 * File: packages/backend/src/testConnection.js
 */

import { config } from 'dotenv';
import pg from 'pg';

// Import logger before using it
import { logger } from './config/index.js';

const { Pool } = pg;
// Load environment variables
config();
async function testConnection() {
  // Log connection attempt
  logger.warn('Testing database connection...');
  logger.warn('Connection details:');
  logger.warn(`Host: ${process.env.DB_HOST}`);
  logger.warn(`Port: ${process.env.DB_PORT}`);
  logger.warn(`Database: ${process.env.POSTGRES_DB}`);
  logger.warn(`User: ${process.env.POSTGRES_USER}`);
  const pool = new Pool({
    database: process.env.POSTGRES_DB,
    host: process.env.DB_HOST,
    password: process.env.POSTGRES_PASSWORD,
    port: Number(process.env.DB_PORT),
    user: process.env.POSTGRES_USER,
  });
  try {
    const result = await pool.query('SELECT version()');
    logger.warn('Database connection successful!');
    logger.warn('PostgreSQL version:', result.rows[0].version);

    return true;
  } catch (error) {
    logger.error('Database connection failed:', error.message);
    return false;
  } finally {
    await pool.end();
  }
}
// Run if called directly
if (import.meta.url === `file://${process.argv[1]}`) {
  // Create exit function with ESLint exception for this CLI usage
  const exitProcess = (code) => {
    process.exit(code);
  };

  // Using an IIFE since we can't use top-level await in all contexts
  (async () => {
    try {
      const success = await testConnection();
      exitProcess(success ? 0 : 1);
    } catch (error) {
      // Use console.error instead since logger might not be initialized yet
      console.error('Error:', error);
      exitProcess(1);
    }
  })();
}
export default testConnection;
