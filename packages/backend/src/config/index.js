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
const dotenv = require('dotenv');
const winston = require('winston');

// Load environment variables
dotenv.config();

// Environment constants
const ENV = {
  PORT: process.env.PORT || 3000,
  NODE_ENV: process.env.NODE_ENV || 'development',

  // Database
  DB_HOST: process.env.DB_HOST,
  DB_PORT: process.env.DB_PORT || 5432,
  POSTGRES_DB: process.env.POSTGRES_DB,
  POSTGRES_USER: process.env.POSTGRES_USER,
  POSTGRES_PASSWORD: process.env.POSTGRES_PASSWORD,

  // Connection pool settings
  DB_POOL_MAX: process.env.DB_POOL_MAX ? Number.parseInt(process.env.DB_POOL_MAX, 10) : 10,
  DB_POOL_IDLE_TIMEOUT: process.env.DB_POOL_IDLE_TIMEOUT
    ? Number.parseInt(process.env.DB_POOL_IDLE_TIMEOUT, 10)
    : 30_000,
  DB_POOL_CONN_TIMEOUT: process.env.DB_POOL_CONN_TIMEOUT
    ? Number.parseInt(process.env.DB_POOL_CONN_TIMEOUT, 10)
    : 2000,

  // Authentication
  JWT_SECRET: process.env.JWT_SECRET,
  JWT_EXPIRES_IN: process.env.JWT_EXPIRES_IN || '1h',
  BCRYPT_SALT_ROUNDS: process.env.BCRYPT_SALT_ROUNDS
    ? Number.parseInt(process.env.BCRYPT_SALT_ROUNDS, 10)
    : 10,
};

// Status type constants
const STATUS = {
  LEVEL_0: 'LEVEL_0',
  LEVEL_1: 'LEVEL_1',
  LEVEL_2: 'LEVEL_2',
  LEVEL_3: 'LEVEL_3',
  LEVEL_4: 'LEVEL_4',
  LEVEL_5: 'LEVEL_5',

  LEARNING: 'learning',
  LEARNED: 'learned',
  REFRESHING: 'refreshing',
};

// Validate that required environment variables are set
function validateEnvironment() {
  // For tests, we don't need to validate environment variables
  if (process.env.NODE_ENV === 'test') {
    return;
  }

  const requiredVars = [
    'PORT',
    'DB_HOST',
    'POSTGRES_DB',
    'POSTGRES_USER',
    'POSTGRES_PASSWORD',
    'JWT_SECRET',
  ];

  for (const varName of requiredVars) {
    if (!ENV[varName]) {
      throw new Error(`FATAL ERROR: ${varName} environment variable is not set.`);
    }
  }

  // Validate port is a number
  if (Number.isNaN(Number.parseInt(ENV.PORT, 10))) {
    throw new TypeError('FATAL ERROR: PORT environment variable is not a valid number.');
  }
}

// Logger configuration
const logger = winston.createLogger({
  level: process.env.LOG_LEVEL || 'info',
  format: winston.format.combine(winston.format.timestamp(), winston.format.json()),
  transports: [
    new winston.transports.Console({
      format: winston.format.combine(winston.format.colorize(), winston.format.simple()),
    }),
    new winston.transports.File({ filename: 'error.log', level: 'error' }),
    new winston.transports.File({ filename: 'combined.log' }),
  ],
  exceptionHandlers: [new winston.transports.File({ filename: 'exceptions.log' })],
  rejectionHandlers: [new winston.transports.File({ filename: 'rejections.log' })],
});

module.exports = {
  ENV,
  STATUS,
  logger,
  validateEnvironment,
};
