const { startServer } = require('./app');

// Start the server when this file is run directly
if (require.main === module) {
  startServer();
}

// Export for testing
module.exports = require('./app');
