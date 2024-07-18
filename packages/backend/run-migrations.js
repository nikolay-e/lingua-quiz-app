const fs = require('fs');
const path = require('path');
const { Pool } = require('pg');
const winston = require('winston');

// Configure Winston logger
const logger = winston.createLogger({
  level: 'info',
  format: winston.format.combine(
    winston.format.timestamp(),
    winston.format.printf(({ timestamp, level, message }) => {
      return `${timestamp} [${level.toUpperCase()}]: ${message}`;
    })
  ),
  transports: [
    new winston.transports.Console(),
    new winston.transports.File({ filename: 'migration.log' }),
  ],
});

const pool = new Pool({
  host: process.env.DB_HOST,
  port: process.env.DB_PORT,
  database: process.env.POSTGRES_DB,
  user: process.env.POSTGRES_USER,
  password: process.env.POSTGRES_PASSWORD,
});

async function runMigrations() {
  logger.info('Starting migration process...');
  logger.info(`Migration directory: ${path.join(__dirname, 'migrations')}`);

  const migrationFiles = fs
    .readdirSync(path.join(__dirname, 'migrations'))
    .sort((a, b) => a.localeCompare(b));

  logger.info(`Found migration files: ${migrationFiles.join(', ')}`);

  const runMigration = async (file) => {
    if (path.extname(file) === '.sql') {
      const filePath = path.join(__dirname, 'migrations', file);
      logger.info(`Reading file: ${filePath}`);

      const sql = fs.readFileSync(filePath, 'utf8');
      logger.info(`Migration content for ${file}: ${sql.substring(0, 100)}...`);

      logger.info(`Running migration: ${file}`);
      try {
        await pool.query(sql);
        logger.info(`Completed migration: ${file}`);
      } catch (error) {
        logger.error(`Error in migration ${file}:`, error);
        throw error;
      }
    } else {
      logger.info(`Skipping non-SQL file: ${file}`);
    }
  };

  try {
    await Promise.all(migrationFiles.map(runMigration));
    logger.info('All migrations completed successfully');
  } catch (error) {
    logger.error('Error during migrations:', error);
    throw error;
  } finally {
    logger.info('Closing database connection...');
    await pool.end();
    logger.info('Database connection closed');
  }
}

runMigrations().catch((error) => {
  logger.error('Migration process failed:', error);
  process.exit(1);
});
