/* eslint-disable consistent-return */
/* eslint-disable max-len */
const fs = require('fs'); // eslint-disable-line no-unused-vars
const http = require('http');

const bcrypt = require('bcrypt');
const cors = require('cors');
const dotenv = require('dotenv');
const express = require('express');
const { body, query, validationResult } = require('express-validator');
const jwt = require('jsonwebtoken');
const _ = require('lodash');
const { Pool } = require('pg');
const winston = require('winston');
const xss = require('xss');

dotenv.config();

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

function sanitizeInput(obj) {
  if (typeof obj !== 'object' || obj === null) {
    return xss(obj);
  }
  if (Array.isArray(obj)) {
    return obj.map((item) => sanitizeInput(item));
  }
  return Object.keys(obj).reduce((acc, key) => {
    acc[key] = sanitizeInput(obj[key]);
    return acc;
  }, {});
}

function convertKeysToCamelCase(obj) {
  if (Array.isArray(obj)) {
    return obj.map((item) => convertKeysToCamelCase(item));
  }
  if (obj !== null && typeof obj === 'object') {
    return Object.entries(obj).reduce((acc, [key, value]) => {
      const newKey = _.camelCase(key);
      acc[newKey] = convertKeysToCamelCase(value);
      return acc;
    }, {});
  }
  return obj;
}

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

const app = express();
app.use(express.json());
app.use(cors());

app.use((req, _res, next) => {
  logger.info(`Incoming request: ${req.method} ${req.originalUrl || req.url} from ${req.ip}`);
  next();
});
app.use((req, res, next) => {
  const oldSend = res.send;
  res.send = function send(...args) {
    res.on('finish', () => {
      logger.info(`Response status: ${res.statusCode} for ${req.method} ${req.originalUrl || req.url}`);
    });
    oldSend.apply(res, args);
  };
  next();
});

const pool = new Pool({
  host: process.env.DB_HOST,
  port: process.env.DB_PORT || 5432,
  database: process.env.POSTGRES_DB,
  user: process.env.POSTGRES_USER,
  password: process.env.POSTGRES_PASSWORD,
  max: process.env.DB_POOL_MAX ? parseInt(process.env.DB_POOL_MAX, 10) : 10,
  idleTimeoutMillis: process.env.DB_POOL_IDLE_TIMEOUT ? parseInt(process.env.DB_POOL_IDLE_TIMEOUT, 10) : 30000,
  connectionTimeoutMillis: process.env.DB_POOL_CONN_TIMEOUT ? parseInt(process.env.DB_POOL_CONN_TIMEOUT, 10) : 2000,
});
pool.on('connect', (client) => {
  logger.info(`Connected to the database (Client PID: ${client.processID})`);
});
pool.on('error', (err, client) => {
  logger.error('Database pool error', {
    error: err.message,
    clientInfo: client ? `Client PID: ${client.processID}` : 'N/A',
  });
});

class DatabaseError extends Error {
  constructor(message, originalError) {
    super(message);
    this.name = 'DatabaseError';
    this.originalError = originalError;
    this.statusCode = 500;
  }
}

async function userExists(email) {
  try {
    const result = await pool.query('SELECT 1 FROM "user" WHERE email = $1 LIMIT 1', [email]);
    return result.rows.length > 0;
  } catch (error) {
    throw new DatabaseError('Error checking user existence', error);
  }
}

function authenticateToken(req, res, next) {
  const authHeader = req.headers.authorization;
  const token = authHeader && authHeader.startsWith('Bearer ') && authHeader.split(' ')[1];
  if (token == null) {
    return next({ statusCode: 401, message: 'No token provided' });
  }
  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    req.userId = decoded.userId;
    logger.debug(`Token authenticated for userId: ${req.userId}`);
    next();
  } catch (err) {
    logger.warn('Invalid token received', { error: err.message });
    next({ statusCode: 403, message: 'Invalid or expired token' });
  }
}

app.get('/healthz', async (req, res, next) => {
  try {
    await pool.query('SELECT 1');
    res.status(200).json({ status: 'ok', message: 'Database connection successful' });
  } catch (error) {
    logger.error('Health check failed - database query error', { error: error.message });
    next({
      statusCode: 503,
      message: 'Service Unavailable: Cannot reach database',
      originalError: error,
    });
  }
});

app.post(
  '/register',
  [
    body('email').isEmail().normalizeEmail().withMessage('Invalid email format'),
    body('password')
      .isLength({ min: 8 })
      .withMessage('Password must be at least 8 characters long')
      .matches(/^(?=.*\d)(?=.*[a-z])(?=.*[A-Z])(?=.*[^a-zA-Z0-9]).{8,}$/)
      .withMessage('Password must contain at least one lowercase letter, one uppercase letter, one number, and one special character'),
  ],
  async (req, res, next) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      logger.warn('Registration validation failed', { errors: errors.array() });
      return next({ statusCode: 400, message: 'Validation failed', errors: errors.array() });
    }
    const sanitizedInput = sanitizeInput(req.body);
    const { email, password } = sanitizedInput;
    try {
      if (await userExists(email)) {
        logger.warn('Registration attempt for existing user', { email });
        return next({ statusCode: 409, message: 'User already exists' }); // 409 Conflict
      }
      const saltRounds = process.env.BCRYPT_SALT_ROUNDS ? parseInt(process.env.BCRYPT_SALT_ROUNDS, 10) : 10;
      const hashedPassword = await bcrypt.hash(password, saltRounds);
      await pool.query('INSERT INTO "user" (email, password) VALUES ($1, $2)', [email, hashedPassword]);
      logger.info('User registered successfully', { email });
      res.status(201).json({ message: 'User registered successfully' });
    } catch (error) {
      next(error);
    }
  }
);

app.post(
  '/login',
  [body('email').isEmail().normalizeEmail().withMessage('Invalid email format'), body('password').notEmpty().withMessage('Password cannot be empty')],
  async (req, res, next) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      logger.warn('Login validation failed', { errors: errors.array() });
      return next({ statusCode: 400, message: 'Validation failed', errors: errors.array() });
    }
    const sanitizedInput = sanitizeInput(req.body);
    const { email, password } = sanitizedInput;
    try {
      const result = await pool.query('SELECT id, email, password FROM "user" WHERE email = $1', [email]);
      const users = convertKeysToCamelCase(result.rows);
      if (users.length === 0) {
        logger.warn('Login attempt for non-existent user', { email });
        return next({ statusCode: 401, message: 'Invalid credentials' });
      }
      const user = users[0];
      const validPassword = await bcrypt.compare(password, user.password);
      if (!validPassword) {
        logger.warn('Login attempt with invalid password', { email });
        return next({ statusCode: 401, message: 'Invalid credentials' });
      }
      const jwtExpiresIn = process.env.JWT_EXPIRES_IN || '1h';
      const token = jwt.sign({ userId: user.id }, process.env.JWT_SECRET, {
        expiresIn: jwtExpiresIn,
      });
      logger.info('User logged in successfully', { email, userId: user.id });
      res.json({ token, expiresIn: jwtExpiresIn });
    } catch (error) {
      next(error);
    }
  }
);

app.delete('/delete-account', authenticateToken, async (req, res, next) => {
  const { userId } = req;
  try {
    const result = await pool.query('DELETE FROM "user" WHERE id = $1 RETURNING email', [userId]);
    if (result.rowCount === 0) {
      logger.warn('Attempt to delete non-existent user account', { userId });
      return next({ statusCode: 404, message: 'User not found' });
    }
    const deletedUserEmail = result.rows[0].email;
    logger.info('User account deleted successfully', {
      userId,
      email: deletedUserEmail,
    });
    res.status(200).json({ message: 'Account deleted successfully' });
  } catch (error) {
    logger.error('Error deleting user account', { userId, error: error.message });
    next(error);
  }
});

app.get(
  '/user/word-sets',
  authenticateToken,
  [query('wordListName').isString().trim().notEmpty().withMessage('wordListName query parameter is required')],
  async (req, res, next) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return next({ statusCode: 400, message: 'Validation failed', errors: errors.array() });
    }
    const { userId } = req;
    const sanitizedQuery = sanitizeInput(req.query);
    const { wordListName } = sanitizedQuery;
    try {
      const result = await pool.query('SELECT * FROM get_user_word_sets($1, $2)', [userId, wordListName]);
      const wordSets = convertKeysToCamelCase(result.rows);
      logger.info('User word sets retrieved successfully', { userId, wordListName });
      res.status(200).json(wordSets);
    } catch (error) {
      next(error);
    }
  }
);

app.post(
  '/user/word-sets',
  authenticateToken,
  [
    body('status').isString().trim().isIn(Object.values(STATUS)).withMessage('Invalid status value'),
    body('wordPairIds').isArray({ min: 0 }).withMessage('wordPairIds must be an array'),
    body('wordPairIds.*').isInt({ min: 1 }).withMessage('Each wordPairId must be a positive integer'),
  ],
  async (req, res, next) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      logger.warn('Update user word sets validation failed', {
        errors: errors.array(),
        body: req.body,
      });
      return next({ statusCode: 400, message: 'Validation failed', errors: errors.array() });
    }
    const { userId } = req;
    const sanitizedInput = sanitizeInput(req.body);
    const { status, wordPairIds } = sanitizedInput;
    try {
      if (wordPairIds.length === 0) {
        logger.info('Received empty wordPairIds array, no database update needed.', {
          userId,
          status,
        });
        return res.status(200).json({
          message: 'Word sets status update request received (no changes applied for empty list).',
        });
      }

      const wordPairIdsArray = `{${wordPairIds.join(',')}}`;
      await pool.query('SELECT update_user_word_set_status($1, $2, $3::translation_status)', [userId, wordPairIdsArray, status]);
      logger.info('User word sets status updated successfully', {
        userId,
        status,
        count: wordPairIds.length,
      });
      res.status(200).json({ message: 'Word sets status updated successfully' });
    } catch (error) {
      if (error.message && error.message.includes('Invalid status transition')) {
        logger.warn('Invalid status transition attempt', { userId, status, error: error.message });
        return next({
          statusCode: 400,
          message: 'Invalid status transition',
          details: error.message,
        });
      }
      next(error);
    }
  }
);

app.get('/word-lists', authenticateToken, async (req, res, next) => {
  try {
    const result = await pool.query('SELECT * FROM get_word_lists()');
    const wordLists = convertKeysToCamelCase(result.rows);
    logger.info('Word lists retrieved successfully');
    res.status(200).json(wordLists);
  } catch (error) {
    next(error);
  }
});

app.all('*', (req, res, next) => {
  next({ statusCode: 404, message: `Cannot ${req.method} ${req.path}` });
});

// eslint-disable-next-line no-unused-vars
function errorHandler(err, req, res, _next) {
  logger.error('Error occurred:', {
    message: err.message,
    stack: err.stack,
    statusCode: err.statusCode,
    errorCode: err.code,
    originalError: err.originalError ? err.originalError.message : undefined,
    url: req.originalUrl || req.url,
    method: req.method,
    ip: req.ip,
  });
  const statusCode = err.statusCode || 500;
  let userMessage = err.message || 'An unexpected error occurred. Please try again later.';

  if (statusCode >= 500 && !(err instanceof DatabaseError)) {
    userMessage = 'An internal server error occurred.';
  } else if (statusCode === 400 && err.errors) {
    userMessage = 'Invalid request data.';
  } else if (statusCode === 401 || statusCode === 403) {
    userMessage = 'Authentication failed or insufficient permissions.';
  } else if (statusCode === 404) {
    userMessage = 'The requested resource was not found.';
  } else if (statusCode === 409) {
    userMessage = 'Conflict: The resource already exists or cannot be created.';
  } else if (statusCode === 503) {
    userMessage = 'Service currently unavailable. Please try again later.';
  }

  const responseError =
    process.env.NODE_ENV === 'production' && statusCode >= 500
      ? undefined
      : {
          message: err.message,
          code: err.code,
          errors: err.errors,
        };
  res.status(statusCode).json({
    message: userMessage,
    ...(responseError && { error: responseError }),
  });
}
app.use(errorHandler);

let server;

function startServer() {
  const { PORT } = process.env;
  if (!PORT || Number.isNaN(parseInt(PORT, 10))) {
    logger.error('FATAL ERROR: PORT environment variable is not set or invalid.');
    process.exit(1);
  }
  server = http.createServer(app);
  server.listen(PORT, () => {
    logger.info(`HTTP Server running successfully on port ${PORT}`);
  });
  server.on('error', (serverError) => {
    logger.error(`Server failed to start on port ${PORT}:`, serverError);
    process.exit(1);
  });
}

startServer();

// --- Graceful Shutdown ---
async function gracefulShutdown(signal) {
  logger.info(`Received ${signal}. Starting graceful shutdown...`);
  if (server) {
    server.close((err) => {
      if (err) {
        logger.error('Error closing HTTP server:', err);
        process.exit(1);
      } else {
        logger.info('HTTP server closed.');
      }
      pool
        .end()
        .then(() => {
          logger.info('Database pool closed.');
          logger.info('Graceful shutdown completed.');
          process.exit(0);
        })
        .catch((poolErr) => {
          logger.error('Error closing database pool:', poolErr);
          process.exit(1);
        });
    });
  } else {
    logger.info('Server not running. Exiting.');
    process.exit(0);
  }
  setTimeout(() => {
    logger.error('Graceful shutdown timed out. Forcing exit.');
    process.exit(1);
  }, 10000);
}
process.on('SIGTERM', () => gracefulShutdown('SIGTERM'));
process.on('SIGINT', () => gracefulShutdown('SIGINT'));

module.exports = server;
