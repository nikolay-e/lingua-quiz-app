/*
 * LinguaQuiz - Copyright © 2025 Nikolay Eremeev
 *
 * Dual-licensed:
 *  - Non-Commercial Source-Available v2  →  see LICENSE-NONCOMMERCIAL.md
 *  - Commercial License v2               →  see LICENSE-COMMERCIAL.md
 *
 * Contact: lingua-quiz@nikolay-eremeev.com
 * Repository: https://github.com/nikolay-e/lingua-quiz
 * File: packages/backend/src/app.js
 */

import { createServer } from 'node:http';

import cors from 'cors';
import express from 'express';
import rateLimit from 'express-rate-limit';
import helmet from 'helmet';

import { ENV, logger, validateEnvironment } from './config/index.js';
import { closePool, initPool } from './db/index.js';
import { errorHandler, requestLogger, responseLogger } from './middleware/index.js';
import routes from './routes/index.js';

// Create Express app
const app = express();

// Create HTTP server
let server;

// Graceful shutdown handler with improved flow control
async function gracefulShutdown(signal) {
  logger.info(`Received ${signal}. Starting graceful shutdown...`);

  // Set a timeout to force exit if the graceful shutdown takes too long
  const forceExitTimeout = setTimeout(() => {
    logger.error('Graceful shutdown timed out after 10 seconds. Forcing exit.');

    process.exit(1);
  }, 10_000);

  try {
    // Close server first if it exists
    if (server) {
      logger.info('Closing HTTP server...');

      try {
        await new Promise((resolve, reject) => {
          // Add a timeout for server closing (5 seconds)
          const serverCloseTimeout = setTimeout(() => {
            reject(new Error('Server close timed out after 5 seconds'));
          }, 5000);

          server.close((err) => {
            clearTimeout(serverCloseTimeout);
            if (err) {
              logger.error('Error closing HTTP server:', err);
              reject(err);
            } else {
              logger.info('HTTP server closed successfully.');
              resolve();
            }
          });
        });
      } catch (serverError) {
        logger.error('Failed to close HTTP server gracefully:', serverError);
        // Continue with database shutdown even if server fails to close
      }
    } else {
      logger.info('HTTP server not running.');
    }

    // Close database connections
    logger.info('Closing database pool...');
    try {
      await closePool();
      logger.info('Database pool closed successfully.');
    } catch (dbError) {
      logger.error('Error closing database pool:', dbError);
      // Exit with error if database cleanup fails
      clearTimeout(forceExitTimeout);

      process.exit(1);
    }

    // If we get here, everything closed properly
    logger.info('Graceful shutdown completed successfully.');
    clearTimeout(forceExitTimeout);

    process.exit(signal === 'SIGINT' || signal === 'SIGTERM' ? 0 : 1);
  } catch (error) {
    logger.error('Unexpected error during graceful shutdown:', error);
    clearTimeout(forceExitTimeout);

    process.exit(1);
  }
}

// Apply middleware
app.use(express.json());
app.use(
  cors({
    allowedHeaders: ['Content-Type', 'Authorization'],
    credentials: true,
    methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
    origin: ENV.CORS_ALLOWED_ORIGINS,
  })
);
app.use(
  helmet({
    contentSecurityPolicy: {
      directives: {
        defaultSrc: ["'self'"],
        scriptSrc: ["'self'", "'unsafe-inline'"],
        styleSrc: ["'self'", "'unsafe-inline'"],
        imgSrc: ["'self'", 'data:', 'https:'],
        connectSrc: ["'self'"],
        fontSrc: ["'self'"],
        objectSrc: ["'none'"],
        mediaSrc: ["'self'"],
        frameSrc: ["'none'"],
      },
    },
  })
); // Set security headers

// Add rate limiting
const apiLimiter = rateLimit({
  // Return rate limit info in the `RateLimit-*` headers
  legacyHeaders: false,
  // 15 minutes
  max: 500,
  // Disable the `X-RateLimit-*` headers
  message: 'Too many requests from this IP, please try again later',
  // Increased from 100 to 500 for e2e testing
  standardHeaders: true,
  windowMs: 15 * 60 * 1000,
  // Skip auth routes, which use their own dedicated rate limiter
  // This prevents double rate limiting on auth endpoints
  skip: (req) => req.path.startsWith('/api/auth/'),
});

// Apply general rate limiting to all other routes
app.use(apiLimiter);

// Apply logging middleware
app.use(requestLogger);
app.use(responseLogger);

// Apply routes with API prefix
app.use('/api', routes);

// Handle 404 for non-API routes
app.all('*', (req, res, next) => {
  next({ message: `Cannot ${req.method} ${req.path}`, statusCode: 404 });
});

// Apply error handler
app.use(errorHandler);

// Handle uncaught exceptions - initiate graceful shutdown instead of abrupt exit
process.on('uncaughtException', (error) => {
  logger.error('Uncaught exception - initiating graceful shutdown:', error);
  logger.error('UNCAUGHT EXCEPTION - initiating graceful shutdown:', error);
  // Initiate graceful shutdown with exit code 1
  gracefulShutdown('UNCAUGHT_EXCEPTION').catch((shutdownError) => {
    logger.error('Error during graceful shutdown after uncaught exception:', shutdownError);
    logger.error('Failed to shutdown gracefully. Forcing exit...', shutdownError);
    // Force exit if graceful shutdown fails
    process.exit(1);
  });
});

// Handle unhandled promise rejections - also with graceful shutdown
process.on('unhandledRejection', (reason, promise) => {
  logger.error('Unhandled promise rejection - initiating graceful shutdown:', { promise, reason });
  logger.error('UNHANDLED REJECTION - initiating graceful shutdown:', reason);
  // Initiate graceful shutdown with exit code 1
  gracefulShutdown('UNHANDLED_REJECTION').catch((shutdownError) => {
    logger.error('Error during graceful shutdown after unhandled rejection:', shutdownError);
    logger.error('Failed to shutdown gracefully. Forcing exit...', shutdownError);
    // Force exit if graceful shutdown fails
    process.exit(1);
  });
});

async function startServer() {
  try {
    // Validate environment variables
    validateEnvironment();

    // Display debug info
    logger.info('Starting server with configuration:');
    logger.info(`- PORT: ${ENV.PORT}`);
    logger.info(`- NODE_ENV: ${ENV.NODE_ENV}`);
    logger.info(`- DB_HOST: ${ENV.DB_HOST}`);
    logger.info(`- DB_PORT: ${ENV.DB_PORT}`);

    // Wait for database connection before starting server
    logger.info('Initializing database connection pool...');
    await initPool();
    logger.info('Database connection pool initialized successfully.');

    // Create HTTP server
    server = createServer(app);

    // Add request logging for debugging
    server.on('request', (_req, _res) => {
      if (process.env.DEBUG === 'true') {
        logger.debug(`[${new Date().toISOString()}] ${_req.method} ${_req.url}`);
      }
    });

    // Set up error handler before listening
    server.on('error', (serverError) => {
      logger.error(`Server failed to start on port ${ENV.PORT}:`, serverError);
      logger.error(`Server error on port ${ENV.PORT}:`, serverError);
      throw serverError; // Throw to propagate the error
    });

    // Make server.listen return a promise so we can await it
    await new Promise((resolve, reject) => {
      server.listen(ENV.PORT, () => {
        logger.info(`HTTP Server running successfully on port ${ENV.PORT}`);
        logger.info(`HTTP Server running on port ${ENV.PORT}`);
        resolve(); // Resolve only after server is listening
      });

      // Set timeout in case listen never resolves
      const timeout = setTimeout(() => {
        reject(new Error(`Server failed to start listening within timeout period on port ${ENV.PORT}`));
      }, 10000); // 10 second timeout

      // Clean up timeout if we resolve successfully
      server.once('listening', () => {
        clearTimeout(timeout);
      });

      // Reject if server emits an error
      server.once('error', (err) => {
        clearTimeout(timeout);
        reject(err);
      });
    });

    return server;
  } catch (error) {
    logger.error('Error starting server:', error);
    logger.error('Error starting server:', error);
    // Rethrow the error to indicate startup failure
    throw error;
  }
}

// Set up signal handlers
process.on('SIGTERM', () => gracefulShutdown('SIGTERM'));
process.on('SIGINT', () => gracefulShutdown('SIGINT'));

// Export object with all the components
export { app, startServer, server };
