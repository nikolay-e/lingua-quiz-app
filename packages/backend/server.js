const express = require('express');
const { Pool } = require('pg');
const bcrypt = require('bcrypt');
const jwt = require('jsonwebtoken');
const dotenv = require('dotenv');
const rateLimit = require('express-rate-limit');
const { body, validationResult } = require('express-validator');
const winston = require('winston');
const https = require('https');
const fs = require('fs');
const cors = require('cors');

dotenv.config();

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
  const result = await pool.query('SELECT * FROM users WHERE email = $1', [email]);
  return result.rows.length > 0;
}

function authenticateToken(req, res, next) {
  const authHeader = req.headers.authorization;
  const token = authHeader && authHeader.split(' ')[1];

  if (token == null) {
    logger.warn('Authentication failed: No token provided');
    res.sendStatus(401);
    return;
  }

  jwt.verify(token, process.env.JWT_SECRET, (err, user) => {
    if (err) {
      logger.warn('Authentication failed: Invalid token', { error: err });
      res.sendStatus(403);
      return;
    }
    req.userId = user.userId;
    next();
  });
}

const limiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 100,
  skip: (req) => req.path === '/healthz',
});

app.use(limiter);

app.get('/healthz', async (req, res) => {
  try {
    await pool.query('SELECT 1'); // Basic DB check
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

      await pool.query('INSERT INTO users (email, password) VALUES ($1, $2)', [
        email,
        hashedPassword,
      ]);

      logger.info('User registered successfully', { email });
      return res.status(201).json({ message: 'User registered successfully' });
    } catch (error) {
      logger.error('Registration error', { error });
      return res.status(500).json({ message: 'Server error' });
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
      const result = await pool.query('SELECT * FROM users WHERE email = $1', [email]);
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
      return res.json({ token });
    } catch (error) {
      logger.error('Login error', { error });
      return res.status(500).json({ message: 'Server error' });
    }
  }
);

app.delete('/delete-account', authenticateToken, async (req, res) => {
  const { userId } = req;

  try {
    const result = await pool.query('DELETE FROM users WHERE id = $1 RETURNING email', [userId]);

    if (result.rows.length === 0) {
      logger.warn('Account deletion failed: User not found', { userId });
      return res.status(404).json({ message: 'User not found' });
    }

    const deletedUserEmail = result.rows[0].email;
    logger.info('User account deleted successfully', {
      userId,
      email: deletedUserEmail,
    });

    return res.status(200).json({ message: 'Account deleted successfully' });
  } catch (error) {
    logger.error('Account deletion error', { userId, error });
    return res.status(500).json({ message: 'Server error' });
  }
});

app.get('/word-list/:name', authenticateToken, async (req, res) => {
  const { name } = req.params;

  try {
    const result = await pool.query(
      `
          SELECT * FROM get_words_and_translations_by_list_name($1)
      `,
      [name]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ message: 'Word list not found' });
    }

    return res.status(200).json(result.rows);
  } catch (error) {
    logger.error('Error fetching word list', { error });
    return res.status(500).json({ message: 'Server error' });
  }
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

function startServer() {
  const PORT = process.env.PORT || 3000;

  try {
    const sslOptions = getSSLOptions();
    const server = https.createServer(sslOptions, app);

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
      const httpServer = app.listen(PORT, () => {
        logger.info(`HTTP Server running on port ${PORT}`);
      });

      httpServer.on('error', (httpError) => {
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
