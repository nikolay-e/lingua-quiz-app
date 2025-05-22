/*
 * LinguaQuiz - Copyright © 2025 Nikolay Eremeev
 *
 * Dual-licensed:
 *  - Non-Commercial Source-Available v2  →  see LICENSE-NONCOMMERCIAL.md
 *  - Commercial License v2               →  see LICENSE-COMMERCIAL.md
 *
 * Contact: lingua-quiz@nikolay-eremeev.com
 * Repository: https://github.com/nikolay-e/lingua-quiz
 * File: packages/backend/src/server.js
 */

// Import named exports
import { startServer, app } from './app.js';
import { logger } from './config/index.js';

// Debug information about server availability
logger.info('Starting LinguaQuiz backend server...');
logger.info(`PORT environment variable: ${process.env.PORT || 'not set'}`);
logger.info(`NODE_ENV: ${process.env.NODE_ENV || 'not set'}`);

// Start the server when this file is run directly
(async () => {
  try {
    const serverInstance = await startServer();

    if (serverInstance) {
      logger.info(`Backend server has started and is listening on port ${serverInstance.address().port}`);

      // The server.listen() call in startServer() itself will keep the Node.js process alive.
      // No need for additional keepAlive mechanisms.

      serverInstance.on('close', () => {
        logger.info('HTTP Server in server.js received "close" event.');
        // The process will exit once all handles are closed
      });

      // Add error handler to catch and log server errors
      serverInstance.on('error', (error) => {
        logger.error('Server error:', error);
        // Don't exit, let the error handling logic decide
      });
    } else {
      logger.error('Failed to start server: startServer() did not return a server instance.');
      process.exit(1);
    }
  } catch (error) {
    logger.error('Failed to start server due to an error in server.js:', error);
    process.exit(1);
  }
})();

// Note: SIGTERM and SIGINT are already handled in app.js with gracefulShutdown()

// Export for testing
export default app;
