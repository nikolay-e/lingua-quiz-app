/* eslint-disable consistent-return */
const express = require('express');
const { Pool } = require('pg');
const bcrypt = require('bcrypt');
const jwt = require('jsonwebtoken');
const dotenv = require('dotenv');
const rateLimit = require('express-rate-limit');
const { body, param, query, validationResult } = require('express-validator');
const winston = require('winston');
const https = require('https');
const _ = require('lodash');
const fs = require('fs');
const cors = require('cors');
const xss = require('xss');

dotenv.config();

function sanitizeInput(obj) {
  if (typeof obj !== 'object' || obj === null) {
    return xss(obj);
  }
  return Object.keys(obj).reduce((acc, key) => {
    acc[key] = typeof obj[key] === 'object' ? sanitizeInput(obj[key]) : xss(obj[key]);
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
  level: 'info',
  format: winston.format.combine(winston.format.timestamp(), winston.format.json()),
  transports: [
    new winston.transports.Console(),
    new winston.transports.File({ filename: 'error.log', level: 'error' }),
    new winston.transports.File({ filename: 'combined.log' }),
  ],
});

const app = express();
app.use(express.json());
app.use(cors());

app.use((req, _res, next) => {
  logger.info(`Incoming request: ${req.method} ${req.url}`);
  next();
});

app.use((req, res, next) => {
  const oldSend = res.send;
  res.send = function send(...args) {
    logger.info(`Response status: ${res.statusCode} for ${req.method} ${req.url}`);
    oldSend.apply(res, args);
  };
  next();
});

const pool = new Pool({
  host: process.env.DB_HOST,
  port: process.env.DB_PORT,
  database: process.env.POSTGRES_DB,
  user: process.env.POSTGRES_USER,
  password: process.env.POSTGRES_PASSWORD,
});

pool.on('connect', () => {
  logger.info('Connected to the database');
});

pool.on('error', (err) => {
  logger.error('Database error', { error: err });
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
    const result = convertKeysToCamelCase(
      await pool.query('SELECT * FROM "user" WHERE email = $1', [email])
    );
    return result.rows.length > 0;
  } catch (error) {
    throw new DatabaseError('Error checking user existence', error);
  }
}

function authenticateToken(req, res, next) {
  const authHeader = req.headers.authorization;
  const token = authHeader && authHeader.split(' ')[1];

  if (token == null) {
    return next({ statusCode: 401, message: 'No token provided' });
  }

  try {
    const user = jwt.verify(token, process.env.JWT_SECRET);
    req.userId = user.userId;
    next();
  } catch (err) {
    next({ statusCode: 403, message: 'Invalid token' });
  }
}

const limiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 100000,
  skip: (req) => req.path === '/healthz',
});

app.use(limiter);

app.get('/healthz', async (req, res, next) => {
  try {
    await pool.query('SELECT 1');
    res.status(200).json({ status: 'ok' });
  } catch (error) {
    next(new DatabaseError('Health check failed', error));
  }
});

app.post(
  '/register',
  [
    body('email').isEmail().normalizeEmail(),
    body('password')
      .isLength({ min: 8 })
      .matches(/^(?=.*\d)(?=.*[a-z])(?=.*[A-Z])(?=.*[^a-zA-Z0-9]).{8,}$/)
      .withMessage(
        // eslint-disable-next-line max-len
        'Password must be at least 8 characters long and contain at least one lowercase letter, one uppercase letter, one number, and one special character'
      ),
  ],
  async (req, res, next) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return next({ statusCode: 400, message: 'Validation failed', errors: errors.array() });
    }

    const sanitizedInput = sanitizeInput(req.body);
    const { email, password } = sanitizedInput;

    try {
      if (await userExists(email)) {
        return next({ statusCode: 400, message: 'User already exists' });
      }

      const hashedPassword = await bcrypt.hash(
        password,
        Number(process.env.BCRYPT_SALT_ROUNDS) || 10
      );

      await pool.query('INSERT INTO "user" (email, password) VALUES ($1, $2)', [
        email,
        hashedPassword,
      ]);

      logger.info('User registered successfully', { email });
      res.status(201).json({ message: 'User registered successfully' });
    } catch (error) {
      next(error);
    }
  }
);

app.post(
  '/login',
  [
    body('email').isEmail().normalizeEmail(),
    body('password').notEmpty().withMessage('Password cannot be empty'),
  ],
  async (req, res, next) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return next({ statusCode: 400, message: 'Validation failed', errors: errors.array() });
    }

    const sanitizedInput = sanitizeInput(req.body);
    const { email, password } = sanitizedInput;

    try {
      const result = convertKeysToCamelCase(
        await pool.query('SELECT * FROM "user" WHERE email = $1', [email])
      );
      if (result.rows.length === 0) {
        return next({ statusCode: 401, message: 'Invalid credentials' });
      }

      const user = result.rows[0];

      const validPassword = await bcrypt.compare(password, user.password);
      if (!validPassword) {
        return next({ statusCode: 401, message: 'Invalid credentials' });
      }

      const token = jwt.sign({ userId: user.id }, process.env.JWT_SECRET, {
        expiresIn: process.env.JWT_EXPIRES_IN || '1h',
      });

      logger.info('User logged in successfully', { email });
      res.json({ token });
    } catch (error) {
      next(error);
    }
  }
);

app.delete('/delete-account', authenticateToken, async (req, res, next) => {
  const { userId } = req;

  try {
    const result = convertKeysToCamelCase(
      await pool.query('DELETE FROM "user" WHERE id = $1 RETURNING email', [userId])
    );

    if (result.rows.length === 0) {
      return next({ statusCode: 404, message: 'User not found' });
    }

    const deletedUserEmail = result.rows[0].email;
    logger.info('User account deleted successfully', {
      userId,
      email: deletedUserEmail,
    });

    res.status(200).json({ message: 'Account deleted successfully' });
  } catch (error) {
    next(error);
  }
});

app.get(
  '/user/word-sets',
  authenticateToken,
  query('wordListName').isString().trim().notEmpty(),
  async (req, res, next) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return next({ statusCode: 400, message: 'Validation failed', errors: errors.array() });
    }

    const { userId } = req;
    const sanitizedQuery = sanitizeInput(req.query);
    const { wordListName } = sanitizedQuery;

    try {
      const result = convertKeysToCamelCase(
        await pool.query('SELECT * FROM get_user_word_sets($1, $2)', [userId, wordListName])
      );

      if (result.rows.length === 0) {
        return next({ statusCode: 404, message: 'No word sets found' });
      }

      logger.info('Word sets retrieved successfully', { userId, wordListName });
      res.status(200).json(result.rows);
    } catch (error) {
      next(error);
    }
  }
);

app.post(
  '/user/word-sets',
  authenticateToken,
  [
    body('status').isString().trim().notEmpty(),
    body('wordPairIds').isArray().notEmpty(),
    body('wordPairIds.*').isInt({ min: 0 }),
  ],
  async (req, res, next) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return next({ statusCode: 400, message: 'Validation failed', errors: errors.array() });
    }

    const { userId } = req;
    const sanitizedInput = sanitizeInput(req.body);
    const { status, wordPairIds } = sanitizedInput;

    try {
      await pool.query('SELECT update_user_word_set_status($1, $2, $3::translation_status)', [
        userId,
        Object.values(wordPairIds),
        status,
      ]);

      logger.info('User word sets updated successfully', { userId, status, wordPairIds });
      res.status(200).json({ message: 'Word sets updated successfully' });
    } catch (error) {
      if (error.message.includes('Invalid status transition')) {
        return next({
          statusCode: 400,
          message: 'Invalid status transition',
          error: error.message,
        });
      }
      next(error);
    }
  }
);

app.post(
  '/word-pair',
  authenticateToken,
  [
    body('translationId').isInt({ min: 1 }),
    body('sourceWordId').isInt({ min: 1 }),
    body('targetWordId').isInt({ min: 1 }),
    body('sourceWord').isString().trim().notEmpty(),
    body('targetWord').isString().trim().notEmpty(),
    body('sourceLanguageName').isString().trim().notEmpty(),
    body('targetLanguageName').isString().trim().notEmpty(),
    body('wordListName').isString().trim().notEmpty(),
    body('sourceWordUsageExample').optional().isString().trim(),
    body('targetWordUsageExample').optional().isString().trim(),
  ],
  async (req, res, next) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return next({ statusCode: 400, message: 'Validation failed', errors: errors.array() });
    }

    const sanitizedInput = sanitizeInput(req.body);
    const {
      translationId,
      sourceWordId,
      targetWordId,
      sourceWord,
      targetWord,
      sourceLanguageName,
      targetLanguageName,
      wordListName,
      sourceWordUsageExample,
      targetWordUsageExample,
    } = sanitizedInput;

    try {
      await pool.query(
        'SELECT insert_word_pair_and_add_to_list($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)',
        [
          translationId,
          sourceWordId,
          targetWordId,
          sourceWord,
          targetWord,
          sourceLanguageName,
          targetLanguageName,
          wordListName,
          sourceWordUsageExample,
          targetWordUsageExample,
        ]
      );

      logger.info('Word pair inserted successfully', {
        translationId,
        sourceWord,
        targetWord,
        wordListName,
      });

      res.status(201).json({ message: 'Word pair inserted successfully' });
    } catch (error) {
      next(error);
    }
  }
);

app.delete(
  '/word-pair/:translationId',
  authenticateToken,
  [param('translationId').isInt({ min: 1 })],
  async (req, res, next) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return next({ statusCode: 400, message: 'Validation failed', errors: errors.array() });
    }

    const { translationId } = req.params;

    try {
      const result = await pool.query('SELECT remove_word_pair_and_list_entry($1)', [
        translationId,
      ]);

      if (result.rowCount === 0) {
        return next({ statusCode: 404, message: 'Word pair not found' });
      }

      logger.info('Word pair and associated data removed successfully', { translationId });

      res.status(200).json({ message: 'Word pair and associated data removed successfully' });
    } catch (error) {
      next(error);
    }
  }
);

app.get('/word-lists', authenticateToken, async (req, res, next) => {
  try {
    const result = await pool.query('SELECT * FROM get_word_lists()');

    if (result.rows.length === 0) {
      return next({ statusCode: 404, message: 'No word lists found' });
    }

    const wordLists = result.rows.map((row) => ({
      id: row.id,
      name: row.name,
      createdAt: row.created_at,
      updatedAt: row.updated_at,
    }));

    logger.info('Word lists retrieved successfully');
    res.status(200).json(wordLists);
  } catch (error) {
    next(error);
  }
});

app.all('*', (req, res, next) => {
  next({ statusCode: 404, message: 'Not Found' });
});

function errorHandler(err, req, res, _next) {
  logger.error('Error occurred:', {
    error: err.message,
    stack: err.stack,
    url: req.url,
    method: req.method,
    body: req.body,
    params: req.params,
    query: req.query,
  });

  const statusCode = err.statusCode || 500;

  let userMessage = 'An unexpected error occurred. Please try again later.';
  if (statusCode === 400) {
    userMessage = 'Invalid request. Please check your input and try again.';
  } else if (statusCode === 401 || statusCode === 403) {
    userMessage = 'Authentication failed.';
  } else if (statusCode === 404) {
    userMessage = 'The requested resource was not found.';
  }

  res.status(statusCode).json({
    message: userMessage,
    error: process.env.NODE_ENV === 'production' ? undefined : err.message,
  });
}

app.use(errorHandler);

function getSSLOptions() {
  const keyPath = process.env.SSL_KEY_PATH || '/etc/tls/tls.key';
  const certPath = process.env.SSL_CERT_PATH || '/etc/tls/tls.crt';

  if (!fs.existsSync(keyPath)) {
    throw new Error(`SSL key file not found: ${keyPath}`);
  }
  if (!fs.existsSync(certPath)) {
    throw new Error(`SSL certificate file not found: ${certPath}`);
  }

  try {
    return {
      key: fs.readFileSync(keyPath),
      cert: fs.readFileSync(certPath),
    };
  } catch (readError) {
    throw new Error(`Failed to read SSL files: ${readError.message}`);
  }
}

let server;

function startServer() {
  const PORT = process.env.PORT || 443;

  try {
    const sslOptions = getSSLOptions();
    server = https.createServer(sslOptions, app);

    server.listen(PORT, () => {
      logger.info(`HTTPS Server running on port ${PORT}`);
    });

    server.on('error', (serverError) => {
      logger.error('Server error:', serverError);
      process.exit(1);
    });
  } catch (sslError) {
    logger.error('Failed to start HTTPS server:', sslError);
    if (process.env.NODE_ENV === 'production') {
      process.exit(1);
    } else {
      logger.warn('Falling back to HTTP server in non-production environment');
      server = app.listen(PORT, () => {
        logger.info(`HTTP Server running on port ${PORT}`);
      });

      server.on('error', (httpError) => {
        logger.error('HTTP Server error:', httpError);
        process.exit(1);
      });
    }
  }
}

startServer();

process.on('unhandledRejection', (reason, promise) => {
  logger.error('Unhandled Rejection at:', promise, 'reason:', reason);
  // Optionally, you might want to crash the process as unhandled promise rejections are deprecated
  process.exit(1);
});

process.on('uncaughtException', (error) => {
  logger.error('Uncaught Exception:', error);
  // Always crash the process on uncaught exceptions
  process.exit(1);
});

// Export the server instance
module.exports = server;
