const { PostgreSqlContainer } = require('@testcontainers/postgresql');
const { Pool } = require('pg');
const axios = require('axios');
const fs = require('fs');
const path = require('path');

module.exports = async () => {
  const env = process.env.TEST_ENV || 'local';

  if (env === 'local') {
    let container = null;

    try {
      // Try to start PostgreSQL container
      console.log('Attempting to start PostgreSQL container...');
      container = await new PostgreSqlContainer().withDatabase('test_db').withUsername('test_user').withPassword('test_password').start();

      // Set environment variables for the test run
      process.env.DB_HOST = container.getHost();
      process.env.DB_PORT = container.getMappedPort(5432);
      console.log(`Container started successfully. DB_HOST=${process.env.DB_HOST}, DB_PORT=${process.env.DB_PORT}`);
    } catch (error) {
      console.warn('Failed to start PostgreSQL container:', error.message);
      console.warn('Using mock database configuration for tests...');

      // Set mock environment variables
      process.env.DB_HOST = 'localhost';
      process.env.DB_PORT = '5432';
    }

    // Set common environment variables
    process.env.POSTGRES_DB = 'test_db';
    process.env.POSTGRES_USER = 'test_user';
    process.env.POSTGRES_PASSWORD = 'test_password';
    process.env.JWT_SECRET = 'test_secret';
    process.env.JWT_EXPIRES_IN = '1h';
    process.env.NODE_ENV = 'development';
    process.env.PORT = '3000'; // Set a fixed port for the test server
    process.env.API_URL = `http://localhost:${process.env.PORT}/api`;
    process.env.TEST_MODE = 'true'; // Flag to indicate we're in test mode

    // Run database migrations first
    try {
      console.log('Running database migrations...');
      const migrationsModule = await import('../src/migrations.mjs');
      await migrationsModule.default.runMigrations();
      console.log('Database migrations completed successfully.');
    } catch (error) {
      console.warn('Failed to run migrations:', error.message);
      console.warn('Tests may fail due to missing schema/data.');
    }

    let server = null;
    try {
      // Import and start the server
      console.log('Attempting to start server...');
      const { startServer } = await import('../src/app.js');
      server = await startServer();
      console.log('Server started successfully.');
    } catch (error) {
      console.warn('Failed to start server:', error.message);
      console.warn('Tests will run with mocked API responses.');
    }

    // Write environment variables to a file
    const envVars = `
DB_HOST=${process.env.DB_HOST}
DB_PORT=${process.env.DB_PORT}
POSTGRES_DB=${process.env.POSTGRES_DB}
POSTGRES_USER=${process.env.POSTGRES_USER}
POSTGRES_PASSWORD=${process.env.POSTGRES_PASSWORD}
JWT_SECRET=${process.env.JWT_SECRET}
JWT_EXPIRES_IN=${process.env.JWT_EXPIRES_IN}
NODE_ENV=${process.env.NODE_ENV}
PORT=${process.env.PORT}
API_URL=${process.env.API_URL}
TEST_MODE=${process.env.TEST_MODE}
`;

    fs.writeFileSync(path.resolve(__dirname, '.test.env'), envVars);

    // Store references to the container and server in global variables
    if (container) global.__TESTCONTAINER__ = container;
    if (server) global.__SERVER__ = server;
  } else {
    // For 'test' or 'production' environments, assume database and server are already set up
    // Set API_URL based on the environment
    process.env.API_URL = process.env.API_URL;

    // Write environment variables to a file
    const envVars = `
API_URL=${process.env.API_URL}
`;

    fs.writeFileSync(path.resolve(__dirname, '.test.env'), envVars);
  }
};
