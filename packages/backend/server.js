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

dotenv.config();

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

async function userExists(email) {
  const result = convertKeysToCamelCase(
    await pool.query('SELECT * FROM "user" WHERE email = $1', [email])
  );
  return result.rows.length > 0;
}

function authenticateToken(req, res, next) {
  const authHeader = req.headers.authorization;
  const token = authHeader && authHeader.split(' ')[1];

  if (token == null) {
    logger.warn('Authentication failed: No token provided');
    return res.sendStatus(401);
  }

  try {
    const user = jwt.verify(token, process.env.JWT_SECRET);
    req.userId = user.userId;
    next();
  } catch (err) {
    logger.warn('Authentication failed: Invalid token', { error: err });
    res.sendStatus(403);
  }
}

const limiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 10000,
  skip: (req) => req.path === '/healthz',
});

app.use(limiter);

app.get('/healthz', async (req, res) => {
  try {
    await pool.query('SELECT 1');
    res.status(200).json({ status: 'ok' });
  } catch (error) {
    logger.error('Health check failed', { error });
    res.status(500).json({ status: 'error', message: 'Database connection failed' });
  }
});

app.post(
  '/register',
  body('email').isEmail(),
  body('password').isLength({ min: 6 }),
  async (req, res) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      logger.warn('Registration validation failed', { errors: errors.array() });
      return res.status(400).json({ errors: errors.array() });
    }

    const { email, password } = req.body;

    try {
      if (await userExists(email)) {
        logger.warn('Registration failed: User already exists', { email });
        return res.status(400).json({ message: 'User already exists' });
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
      logger.error('Registration error', { error });
      res.status(500).json({ message: 'Server error' });
    }
  }
);

app.post(
  '/login',
  body('email').isEmail(),
  body('password').isLength({ min: 6 }),
  async (req, res) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      logger.warn('Login validation failed', { errors: errors.array() });
      return res.status(400).json({ errors: errors.array() });
    }

    const { email, password } = req.body;

    try {
      const result = convertKeysToCamelCase(
        await pool.query('SELECT * FROM "user" WHERE email = $1', [email])
      );
      if (result.rows.length === 0) {
        logger.warn('Login failed: User not found', { email });
        return res.status(401).json({ message: 'Invalid credentials' });
      }

      const user = result.rows[0];

      const validPassword = await bcrypt.compare(password, user.password);
      if (!validPassword) {
        logger.warn('Login failed: Invalid password', { email });
        return res.status(401).json({ message: 'Invalid credentials' });
      }

      const token = jwt.sign({ userId: user.id }, process.env.JWT_SECRET, {
        expiresIn: process.env.JWT_EXPIRES_IN || '1h',
      });

      logger.info('User logged in successfully', { email });
      res.json({ token });
    } catch (error) {
      logger.error('Login error', { error });
      res.status(500).json({ message: 'Server error' });
    }
  }
);

app.delete('/delete-account', authenticateToken, async (req, res) => {
  const { userId } = req;

  try {
    const result = convertKeysToCamelCase(
      await pool.query('DELETE FROM "user" WHERE id = $1 RETURNING email', [userId])
    );

    if (result.rows.length === 0) {
      logger.warn('Account deletion failed: User not found', { userId });
      return res.status(404).json({ message: 'User not found' });
    }

    const deletedUserEmail = result.rows[0].email;
    logger.info('User account deleted successfully', {
      userId,
      email: deletedUserEmail,
    });

    res.status(200).json({ message: 'Account deleted successfully' });
  } catch (error) {
    logger.error('Account deletion error', { userId, error });
    res.status(500).json({ message: 'Server error' });
  }
});

app.get(
  '/user/word-sets',
  authenticateToken,
  query('wordListName').isString().notEmpty(),
  async (req, res) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      logger.warn('Validation failed for word sets retrieval', { errors: errors.array() });
      return res.status(400).json({ errors: errors.array() });
    }

    const { userId } = req;
    const { wordListName } = req.query;

    try {
      const result = convertKeysToCamelCase(
        await pool.query('SELECT * FROM get_user_word_sets($1, $2)', [userId, wordListName])
      );

      if (result.rows.length === 0) {
        logger.info('No word sets found', { userId, wordListName });
        return res.status(404).json({ message: 'No word sets found' });
      }

      logger.info('Word sets retrieved successfully', { userId, wordListName });
      res.status(200).json(result.rows);
    } catch (error) {
      logger.error('Error retrieving word sets', { userId, wordListName, error });
      res.status(500).json({ message: 'Server error' });
    }
  }
);

app.post(
  '/user/word-sets',
  authenticateToken,
  [body('status').isString().notEmpty(), body('wordPairIds').isArray()],
  async (req, res) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      logger.warn('Validation failed for updating word sets', { errors: errors.array() });
      return res.status(400).json({ errors: errors.array() });
    }

    const { userId } = req;
    const { status, wordPairIds } = req.body;

    try {
      await pool.query('SELECT update_user_word_set_status($1, $2, $3::translation_status)', [
        userId,
        wordPairIds,
        status,
      ]);

      logger.info('User word sets updated successfully', { userId, status, wordPairIds });
      res.status(200).json({ message: 'Word sets updated successfully' });
    } catch (error) {
      if (error.message.includes('Invalid status transition')) {
        logger.warn('Invalid status transition attempted', {
          userId,
          status,
          wordPairIds,
          error: error.message,
        });
        return res.status(400).json({ message: 'Invalid status transition', error: error.message });
      }
      logger.error('Error updating user word sets', { userId, status, wordPairIds, error });
      res.status(500).json({ message: 'Server error' });
    }
  }
);

app.post(
  '/word-pair',
  authenticateToken,
  [
    body('translationId').isInt(),
    body('sourceWordId').isInt(),
    body('targetWordId').isInt(),
    body('sourceWord').isString().notEmpty(),
    body('targetWord').isString().notEmpty(),
    body('sourceLanguageName').isString().notEmpty(),
    body('targetLanguageName').isString().notEmpty(),
    body('wordListName').isString().notEmpty(),
    body('sourceWordUsageExample').optional().isString(),
    body('targetWordUsageExample').optional().isString(),
  ],
  async (req, res) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      logger.warn('Validation failed for insert word pair', { errors: errors.array() });
      return res.status(400).json({ errors: errors.array() });
    }

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
    } = req.body;

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
      logger.error('Error inserting word pair', { error, ...req.body });
      res.status(500).json({ message: 'Server error' });
    }
  }
);

app.delete(
  '/word-pair/:translationId',
  authenticateToken,
  [param('translationId').isInt()],
  async (req, res) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      logger.warn('Validation failed for remove word pair', { errors: errors.array() });
      return res.status(400).json({ errors: errors.array() });
    }

    const { translationId } = req.params;

    try {
      const result = await pool.query('SELECT remove_word_pair_and_list_entry($1)', [
        translationId,
      ]);

      if (result.rowCount === 0) {
        logger.warn('Word pair removal failed: Word pair not found', { translationId });
        return res.status(404).json({ message: 'Word pair not found' });
      }

      logger.info('Word pair and associated data removed successfully', { translationId });

      res.status(200).json({ message: 'Word pair and associated data removed successfully' });
    } catch (error) {
      logger.error('Error removing word pair and associated data', { error, translationId });
      res.status(500).json({ message: 'Server error' });
    }
  }
);

app.get('/word-lists', authenticateToken, async (req, res) => {
  try {
    const result = await pool.query('SELECT * FROM get_word_lists()');

    if (result.rows.length === 0) {
      logger.info('No word lists found');
      return res.status(404).json({ message: 'No word lists found' });
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
    logger.error('Error retrieving word lists', { error });
    res.status(500).json({ message: 'Server error' });
  }
});

app.all('*', (req, res) => {
  logger.warn(`Unhandled route: ${req.method} ${req.url}`);
  res.status(404).json({ message: 'Not Found' });
});

app.use((err, req, res, _next) => {
  logger.error(`Error occurred during request: ${req.method} ${req.url}`, { error: err });
  res.status(500).json({ message: 'Internal Server Error' });
});

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

// Declare server variable at the top-level scope
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
});

process.on('uncaughtException', (error) => {
  logger.error('Uncaught Exception:', error);
  process.exit(1);
});

// Export the server instance
module.exports = server;
