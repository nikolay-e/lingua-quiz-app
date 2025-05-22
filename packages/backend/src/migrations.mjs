/*
 * LinguaQuiz - Copyright © 2025 Nikolay Eremeev
 *
 * Dual-licensed:
 *  - Non-Commercial Source-Available v2  →  see LICENSE-NONCOMMERCIAL.md
 *  - Commercial License v2               →  see LICENSE-COMMERCIAL.md
 *
 * Contact: lingua-quiz@nikolay-eremeev.com
 * Repository: https://github.com/nikolay-e/lingua-quiz
 * File: packages/backend/src/migrations.mjs
 */

import crypto from 'crypto';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

// Getting logger from config
import { logger } from './config/index.js';
import { initPool, pool } from './db/connection.js';

// Get __dirname equivalent in ESM
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

/**
 * Calculate SHA-256 checksum of a file
 * @param {string} content - File content
 * @returns {string} - SHA-256 checksum
 */
function calculateChecksum(content) {
  return crypto.createHash('sha256').update(content).digest('hex');
}

/**
 * Check if the migrations table exists
 * @returns {Promise<boolean>} - True if table exists
 */
async function migrationTableExists() {
  const result = await pool.query(`
    SELECT EXISTS (
      SELECT FROM information_schema.tables
      WHERE table_schema = 'public'
      AND table_name = 'schema_migrations'
    );
  `);
  return result.rows[0].exists;
}

/**
 * Check if migration functions exist in the database
 * @returns {Promise<boolean>} - True if functions exist
 */
async function checkMigrationFunctionsExist() {
  try {
    const result = await pool.query(`
      SELECT EXISTS (
        SELECT FROM pg_proc
        WHERE proname = 'acquire_migration_lock'
      );
    `);
    return result.rows[0].exists;
  } catch (error) {
    logger.warn('Error checking if migration functions exist:', error.message);
    return false;
  }
}

/**
 * Initialize migration tracking system
 * @returns {Promise<void>}
 */
async function initMigrationSystem() {
  try {
    // Check if migration functions exist
    const fnExists = await checkMigrationFunctionsExist();

    // If migration functions don't exist, we need to create them
    if (!fnExists) {
      logger.info('Migration functions not found, attempting to create them...');

      try {
        // Create schema_migrations table and functions directly
        const setupFile = path.join(__dirname, '../migrations/000_schema_migrations_table.sql');
        const setupSql = fs.readFileSync(setupFile, 'utf8');

        logger.info('Creating schema_migrations table and migration functions...');
        await pool.query(setupSql);
        logger.info('Successfully created migration functions');
      } catch (setupError) {
        logger.error('Error creating migration functions:', setupError);
        logger.info('Continuing without migration locking (may be unsafe for concurrent migrations)');
        // Continue without locking - at least we tried
      }
    }

    // Attempt to acquire migration lock, but handle gracefully if functions don't exist
    let lockAcquired = false;
    try {
      const lockResult = await pool.query('SELECT acquire_migration_lock() as lock_acquired;');
      lockAcquired = lockResult.rows[0].lock_acquired;
      if (!lockAcquired) {
        logger.warn('Could not acquire migration lock - another migration process may be running.');
        // Continue anyway - better than failing completely
      } else {
        logger.info('Migration lock acquired successfully');
      }
    } catch (lockError) {
      // If we can't acquire a lock, log warning but continue
      logger.warn('Could not acquire migration lock:', lockError.message);
      logger.info('Continuing without migration locking (may be unsafe for concurrent migrations)');
    }

    // Check if table exists first
    const tableExists = await migrationTableExists();
    if (!tableExists) {
      // Create schema_migrations table if it doesn't exist yet
      const setupFile = path.join(__dirname, '../migrations/000_schema_migrations_table.sql');
      const setupSql = fs.readFileSync(setupFile, 'utf8');

      logger.info('Creating schema_migrations table...');
      try {
        await pool.query(setupSql);

        // Record this initial migration
        await pool.query('INSERT INTO schema_migrations (version, checksum) VALUES ($1, $2)', [
          '000_schema_migrations_table.sql',
          calculateChecksum(setupSql),
        ]);
        logger.info('Migration tracking system initialized');
      } catch (tableCreateError) {
        // If we get here, it's likely because the table was just created
        logger.warn('Error creating schema_migrations table (may already exist):', tableCreateError.message);
      }
    }

    return lockAcquired;
  } catch (error) {
    logger.error('Failed to initialize migration system:', error);
    throw error;
  }
}

/**
 * Get list of already applied migrations
 * @returns {Promise<Set<string>>} - Set of applied migration filenames
 */
async function getAppliedMigrations() {
  const result = await pool.query('SELECT version FROM schema_migrations ORDER BY id ASC');
  return new Set(result.rows.map((row) => row.version));
}

/**
 * Runs a specific set of SQL migration files with version tracking
 * @param {string} dirPath - Path to migration directory
 * @returns {Promise<void>}
 */
async function runSqlMigrations(dirPath) {
  try {
    // Initialize migration system if needed
    await initMigrationSystem();

    // Get list of applied migrations
    const appliedMigrations = await getAppliedMigrations();

    // Get all migration files
    let migrationFiles = fs
      .readdirSync(dirPath)
      .filter((file) => file.endsWith('.sql'))
      .sort(); // Ensure migrations run in order

    // Log all files found
    logger.info(`All migration files found: ${migrationFiles.join(', ')}`);

    // Force 000_schema_migrations_table.sql to be first if it exists
    if (migrationFiles.includes('000_schema_migrations_table.sql')) {
      migrationFiles = ['000_schema_migrations_table.sql', ...migrationFiles.filter((f) => f !== '000_schema_migrations_table.sql')];
    }

    // Filter out already applied migrations
    const pendingMigrations = migrationFiles.filter((file) => !appliedMigrations.has(file));

    logger.info(`Found ${pendingMigrations.length} pending SQL migrations to execute`);

    // Log detailed information about pending migrations
    if (pendingMigrations.length > 0) {
      logger.info(`Pending migrations: ${pendingMigrations.join(', ')}`);
    } else {
      logger.info('No pending migrations found');
      // If no pending migrations, but we have migration files, force execute them all
      // This is a development-only hack to ensure migrations run
      if (process.env.NODE_ENV === 'development' && migrationFiles.length > 0) {
        logger.info('DEVELOPMENT MODE: Forcing execution of all migrations');
        pendingMigrations.push(...migrationFiles);
      }
    }

    // Run each pending migration in a transaction
    for (const file of pendingMigrations) {
      const filePath = path.join(dirPath, file);
      const sql = fs.readFileSync(filePath, 'utf8');
      const checksum = calculateChecksum(sql);

      // Skip migration in case it was already applied (redundant check)
      if (appliedMigrations.has(file) && file !== '000_schema_migrations_table.sql') {
        logger.info(`Skipping already applied migration: ${file}`);
        continue;
      }

      // Run migration in a transaction
      const client = await pool.connect();
      try {
        await client.query('BEGIN');

        logger.info(`Running migration: ${file}`);
        await client.query(sql);

        // For the schema_migrations table itself, we need to handle it specially
        if (file === '000_schema_migrations_table.sql') {
          try {
            // First check if this version is already in the table
            const versionExists = await client.query('SELECT EXISTS(SELECT 1 FROM schema_migrations WHERE version = $1)', [file]);

            if (!versionExists.rows[0].exists) {
              // Only insert if it doesn't exist
              await client.query('INSERT INTO schema_migrations (version, checksum) VALUES ($1, $2)', [file, checksum]);
            } else {
              logger.info(`Migration ${file} already tracked, skipping record insertion`);
            }
          } catch (err) {
            // If this fails, it's probably because we just created the table
            // and don't have the version record yet
            logger.warn(`Could not check if ${file} exists, trying direct insert: ${err.message}`);
            try {
              await client.query('INSERT INTO schema_migrations (version, checksum) VALUES ($1, $2)', [file, checksum]);
            } catch (insertErr) {
              // If this also fails, we'll just continue with the migration
              logger.warn(`Could not insert ${file} record: ${insertErr.message}`);
            }
          }
        } else {
          // For all other migrations, record them normally
          await client.query('INSERT INTO schema_migrations (version, checksum) VALUES ($1, $2)', [file, checksum]);
        }

        await client.query('COMMIT');
        logger.info(`Successfully completed migration: ${file}`);
      } catch (error) {
        await client.query('ROLLBACK');
        logger.error(`Error running migration ${file}:`, error);
        throw error;
      } finally {
        client.release();
      }
    }

    // Release lock when done, but only attempt if we successfully acquired one
    try {
      await pool.query('SELECT release_migration_lock();');
    } catch (releaseError) {
      logger.warn('Could not release migration lock (may not have been acquired):', releaseError.message);
    }
  } catch (error) {
    logger.error('Migration process failed:', error);
    // Attempt to release lock in case of error
    try {
      await pool.query('SELECT release_migration_lock();');
    } catch (releaseError) {
      // Ignore - we may not have acquired a lock
    }
    throw error;
  }
}

export async function runMigrations() {
  logger.info('Starting migration process...');
  const migrationsDirPath = path.join(__dirname, '../migrations');
  try {
    // Initialize database pool if not already initialized
    if (!pool || !pool.query) {
      logger.info('Initializing database pool for migrations');
      await initPool();
    }

    // Run all SQL migrations
    await runSqlMigrations(migrationsDirPath);
    logger.info('Migration process completed successfully');
  } catch (error) {
    logger.error('Migration process failed:', error);
    throw error;
  }
}

// Run migrations if this script is executed directly
if (import.meta.url === `file://${process.argv[1]}`) {
  // Use async IIFE to allow top-level await
  (async () => {
    try {
      await runMigrations();
    } catch (error) {
      logger.error('Migration failed:', error);
      // We need this for the CLI usage of the migrations script
      // Using a comment to disable the ESLint rule specifically for this usage

      process.exit(1);
    }
  })();
}

export default {
  runMigrations,
};
