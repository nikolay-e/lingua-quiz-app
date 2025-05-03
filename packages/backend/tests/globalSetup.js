const fs = require('node:fs');
const path = require('node:path');

const { PostgreSqlContainer } = require('@testcontainers/postgresql');
const axios = require('axios');
const { Pool } = require('pg');

// Import the runMigrations function from the new location
const { runMigrations } = require('../src/migrations');

module.exports = async () => {
  const env = process.env.TEST_ENV || 'local';

  if (env === 'local') {
    // Start PostgreSQL container
    const container = await new PostgreSqlContainer()
      .withDatabase('linguaquiz_test_db')
      .withUsername('linguaquiz_test_user')
      .withPassword('test_password')
      .start();

    // Set environment variables for the test run
    process.env.DB_HOST = container.getHost();
    process.env.DB_PORT = container.getMappedPort(5432);
    process.env.POSTGRES_DB = 'linguaquiz_test_db';
    process.env.POSTGRES_USER = 'linguaquiz_test_user';
    process.env.POSTGRES_PASSWORD = 'test_password';
    process.env.JWT_SECRET = 'test_secret';
    process.env.JWT_EXPIRES_IN = '1h';
    process.env.NODE_ENV = 'test';
    process.env.PORT = '3000'; // Set a fixed port for the test server
    process.env.API_URL = `http://localhost:${process.env.PORT}/api`;

    // Run migrations
    await runMigrations();

    // Import the server instance from new location
    const { startServer } = require('../src/app');

    // Give database time to start
    await new Promise((resolve) => setTimeout(resolve, 3000));

    // Start the server
    const server = startServer();

    // Wait for the server to start
    await new Promise((resolve) => setTimeout(resolve, 3000));

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
`;

    fs.writeFileSync(path.resolve(__dirname, '.test.env'), envVars);

    // Store references to the container and server in global variables
    global.__TESTCONTAINER__ = container;
    global.__SERVER__ = server;
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
