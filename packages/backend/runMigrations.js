const fs = require('fs');
const path = require('path');
const { Pool } = require('pg');
const winston = require('winston');
const csvParser = require('csv-parser');

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

const escapeSQL = (str) => {
  if (typeof str !== 'string') return str;
  return str.replace(/'/g, "''").replace(/\\/g, '\\\\');
};

function parseConfigFromFilename(filename) {
  const basename = path.basename(filename, '.csv');
  const parts = basename.split(' -- ');

  if (parts.length < 3) {
    logger.warn(`Filename ${filename} does not match the expected pattern.`);
    return null;
  }

  const sourceLangName = parts[parts.length - 2];
  const targetLangName = parts[parts.length - 1];
  const wordListName = parts.slice(0, parts.length - 2).join('_');

  return {
    sourceLangName,
    targetLangName,
    wordListName,
  };
}

async function generateSQLFromCSV(csvFilePath, outputSqlFilePath, config) {
  logger.info(`Reading CSV file: ${csvFilePath}`);

  const sqlStatements = [];

  return new Promise((resolve, reject) => {
    fs.createReadStream(csvFilePath)
      .pipe(csvParser())
      .on('data', (row) => {
        const sql = `
          SELECT insert_word_pair_and_add_to_list(
            p_translation_id := ${escapeSQL(row.translation_id)},
            p_source_word_id := ${escapeSQL(row.source_word_id)},
            p_target_word_id := ${escapeSQL(row.target_word_id)},
            p_source_word := '${escapeSQL(row.source_word)}',
            p_target_word := '${escapeSQL(row.target_word)}',
            p_source_language_name := '${escapeSQL(config.sourceLangName)}',
            p_target_language_name := '${escapeSQL(config.targetLangName)}',
            p_word_list_name := '${escapeSQL(config.wordListName)}',
            p_source_word_usage_example := '${escapeSQL(row.source_word_example)}',
            p_target_word_usage_example := '${escapeSQL(row.target_word_example)}'
          );
        `;
        sqlStatements.push(sql);
      })
      .on('end', () => {
        const finalSql = sqlStatements.join('\n');
        fs.writeFileSync(outputSqlFilePath, finalSql);
        logger.info(`SQL file generated: ${outputSqlFilePath}`);
        resolve();
      })
      .on('error', (error) => {
        logger.error(`Error reading CSV file: ${error.message}`);
        reject(error);
      });
  });
}

async function processCSVFiles(migrationsDirPath) {
  const csvFiles = fs
    .readdirSync(migrationsDirPath)
    .filter((file) => path.extname(file) === '.csv');
  logger.info(`Found CSV files: ${csvFiles.join(', ')}`);

  for (let i = 0; i < csvFiles.length; i += 1) {
    const file = csvFiles[i];
    // Extract config from filename
    const config = parseConfigFromFilename(file);

    if (config) {
      const csvFilePath = path.join(migrationsDirPath, file);
      const sqlFileName = `Generated -- ${path.basename(file, '.csv')}.sql`;
      const outputSqlFilePath = path.join(migrationsDirPath, sqlFileName);
      // eslint-disable-next-line no-await-in-loop
      await generateSQLFromCSV(csvFilePath, outputSqlFilePath, config);
    } else {
      logger.warn(`Could not parse configuration from filename ${file}. Skipping this file.`);
    }
  }
}

async function runMigrations(migrationsDirPath) {
  logger.info('Starting migration process...');
  logger.info(`Migration directory: ${migrationsDirPath}`);

  const pool = new Pool({
    host: process.env.DB_HOST,
    port: parseInt(process.env.DB_PORT, 10),
    database: process.env.POSTGRES_DB,
    user: process.env.POSTGRES_USER,
    password: process.env.POSTGRES_PASSWORD,
  });

  const migrationFiles = fs.readdirSync(migrationsDirPath).sort((a, b) => a.localeCompare(b));

  logger.info(`Found migration files: ${migrationFiles.join(', ')}`);

  const runMigration = async (file) => {
    if (path.extname(file) === '.sql') {
      const filePath = path.join(migrationsDirPath, file);
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
    await migrationFiles.reduce(async (previousPromise, file) => {
      await previousPromise;
      return runMigration(file);
    }, Promise.resolve());

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

async function setupAndRunMigrations() {
  const migrationsDirectoryPath = path.join(__dirname, '.', 'migrations');
  await processCSVFiles(migrationsDirectoryPath);
  await runMigrations(migrationsDirectoryPath);
}

module.exports = { setupAndRunMigrations };

// Run migrations if this script is executed directly
if (require.main === module) {
  setupAndRunMigrations().catch((error) => {
    logger.error('Migration process failed:', error);
    process.exit(1);
  });
}
