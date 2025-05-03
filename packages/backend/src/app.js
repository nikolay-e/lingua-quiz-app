const http = require('node:http');

const cors = require('cors');
const express = require('express');
const rateLimit = require('express-rate-limit');
const helmet = require('helmet');

const { ENV, logger, validateEnvironment } = require('./config');
const { closePool } = require('./db');
const { requestLogger, responseLogger, errorHandler } = require('./middleware');
const routes = require('./routes');

// Create Express app
const app = express();

// Apply middleware
app.use(express.json());
app.use(cors());
app.use(helmet()); // Set security headers

// Add rate limiting
const apiLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 500, // Increased from 100 to 500 for e2e testing
  standardHeaders: true, // Return rate limit info in the `RateLimit-*` headers
  legacyHeaders: false, // Disable the `X-RateLimit-*` headers
  message: 'Too many requests from this IP, please try again later',
});

// Apply rate limiting to all routes
app.use(apiLimiter);

// Add stricter rate limit for auth endpoints
const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 100, // Increased from 10 to 100 for e2e testing
  standardHeaders: true,
  legacyHeaders: false,
  message: 'Too many authentication attempts, please try again later',
});

// Apply logging middleware
app.use(requestLogger);
app.use(responseLogger);

// Apply routes with API prefix
app.use('/api', routes);

// Handle 404 for non-API routes
app.all('*', (req, res, next) => {
  next({ statusCode: 404, message: `Cannot ${req.method} ${req.path}` });
});

// Apply error handler
app.use(errorHandler);

// Create HTTP server
let server;

function startServer() {
  try {
    // Validate environment variables
    validateEnvironment();

    // Create and start HTTP server
    server = http.createServer(app);
    server.listen(ENV.PORT, () => {
      logger.info(`HTTP Server running successfully on port ${ENV.PORT}`);
    });

    server.on('error', (serverError) => {
      logger.error(`Server failed to start on port ${ENV.PORT}:`, serverError);
      process.exit(1);
    });

    return server;
  } catch (error) {
    logger.error('Error starting server:', error);
    process.exit(1);
  }
}

// Graceful shutdown handler
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

      closePool()
        .then(() => {
          logger.info('Graceful shutdown completed.');
          process.exit(0);
        })
        .catch((error) => {
          logger.error('Error closing database pool:', error);
          process.exit(1);
        });
    });
  } else {
    logger.info('Server not running. Exiting.');
    process.exit(0);
  }

  // Force exit after timeout
  setTimeout(() => {
    logger.error('Graceful shutdown timed out. Forcing exit.');
    process.exit(1);
  }, 10_000);
}

// Set up signal handlers
process.on('SIGTERM', () => gracefulShutdown('SIGTERM'));
process.on('SIGINT', () => gracefulShutdown('SIGINT'));

module.exports = { app, server, startServer };
