const express = require('express');
const { Pool } = require('pg');
const bcrypt = require('bcrypt');
const jwt = require('jsonwebtoken');
const dotenv = require('dotenv');
const rateLimit = require('express-rate-limit');
const { body, validationResult } = require('express-validator');
const winston = require('winston');

dotenv.config();

// Configure Winston logger
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

const pool = new Pool({
  host: process.env.DB_HOST,
  port: process.env.DB_PORT,
  database: process.env.POSTGRES_DB,
  user: process.env.POSTGRES_USER,
  password: process.env.POSTGRES_PASSWORD,
});

// Log database connection
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
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 100, // limit each IP to 100 requests per windowMs
});

app.use(limiter);

// Healthz endpoint for K8s probes
app.get('/healthz', (req, res) => {
  logger.info('Health check request received');
  res.status(200).json({ status: 'ok' });
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

app.get('/protected', authenticateToken, (req, res) => {
  logger.info('Protected route accessed', { userId: req.userId });
  res.json({ message: 'This is a protected route', userId: req.userId });
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  logger.info(`Server running on port ${PORT}`);
});

// Log unhandled promise rejections
process.on('unhandledRejection', (reason, promise) => {
  logger.error('Unhandled Rejection at:', promise, 'reason:', reason);
});

// Log uncaught exceptions
process.on('uncaughtException', (error) => {
  logger.error('Uncaught Exception:', error);
  process.exit(1);
});
