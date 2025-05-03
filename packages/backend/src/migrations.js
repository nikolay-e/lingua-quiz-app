const fs = require('node:fs');
const path = require('node:path');

const dotenv = require('dotenv');
const { Pool } = require('pg');

const { ENV, logger } = require('./config');

// Load environment variables
dotenv.config();

/**
 * Run SQL migration files in sequential order
 * @param {string} migrationsDirPath - Path to migrations directory
 * @returns {Promise<void>}
 */
async function runSqlMigrations(migrationsDirPath) {
  logger.info('Starting SQL migrations...');

  // Create database connection
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

  try {
    // Get all SQL migration files and sort them
    const migrationFiles = fs
      .readdirSync(migrationsDirPath)
      .filter((file) => path.extname(file) === '.sql')
      .sort((a, b) => a.localeCompare(b));

    logger.info(`Found ${migrationFiles.length} SQL migration files to process`);

    // Run each migration in order
    for (const file of migrationFiles) {
      const filePath = path.join(migrationsDirPath, file);
      logger.info(`Running migration: ${file}`);

      const sql = fs.readFileSync(filePath, 'utf8');
      try {
        await pool.query(sql);
        logger.info(`Completed migration: ${file}`);
      } catch (error) {
        logger.error(`Error in migration ${file}:`, error);
        throw error;
      }
    }

    logger.info('All SQL migrations completed successfully');
  } finally {
    await pool.end();
    logger.info('Database connection closed');
  }
}

/**
 * Main migration function that runs SQL migrations
 * @returns {Promise<void>}
 */
async function runMigrations() {
  logger.info('Starting migration process...');

  const migrationsDirPath = path.join(__dirname, '../migrations');

  try {
    // Run all SQL migrations
    await runSqlMigrations(migrationsDirPath);

    logger.info('Migration process completed successfully');
  } catch (error) {
    logger.error('Migration process failed:', error);
    throw error;
  }
}

// Run migrations if this script is executed directly
if (require.main === module) {
  runMigrations().catch((error) => {
    logger.error('Migration failed:', error);
    process.exit(1);
  });
}

module.exports = { runMigrations };
