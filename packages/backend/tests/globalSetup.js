// globalSetup.js
const { PostgreSqlContainer } = require('@testcontainers/postgresql');
const { Pool } = require('pg');
const axios = require('axios');
const fs = require('fs');
const path = require('path');
const { setupAndRunMigrations } = require('../runMigrations');

module.exports = async () => {
  const env = process.env.TEST_ENV || 'local';

  if (env === 'local') {
    // Start PostgreSQL container
    const container = await new PostgreSqlContainer()
      .withDatabase('test_db')
      .withUsername('test_user')
      .withPassword('test_password')
      .start();

    // Set environment variables for the test run
    process.env.DB_HOST = container.getHost();
    process.env.DB_PORT = container.getMappedPort(5432);
    process.env.POSTGRES_DB = 'test_db';
    process.env.POSTGRES_USER = 'test_user';
    process.env.POSTGRES_PASSWORD = 'test_password';
    process.env.JWT_SECRET = 'test_secret';
    process.env.JWT_EXPIRES_IN = '1h';
    process.env.NODE_ENV = 'development';
    process.env.PORT = '3000'; // Set a fixed port for the test server
    process.env.API_URL = `http://localhost:${process.env.PORT}`;

    // Run migrations
    await setupAndRunMigrations();

    // Import the server instance
    const server = require('../server');

    // Wait for the server to start
    await new Promise((resolve) => setTimeout(resolve, 2000));

    // Create test user and obtain JWT token
    const testUser = {
      email: `test${Date.now()}@example.com`,
      password: 'testPassword123!',
    };

    const axiosInstance = axios.create();
    await axiosInstance.post(`${process.env.API_URL}/register`, testUser);
    const loginResponse = await axiosInstance.post(`${process.env.API_URL}/login`, testUser);
    const jwtToken = loginResponse.data.token;

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
JWT_TOKEN=${jwtToken}
TEST_USER_EMAIL=${testUser.email}
TEST_USER_PASSWORD=${testUser.password}
`;

    fs.writeFileSync(path.resolve(__dirname, '.test.env'), envVars);

    // Store references to the container and server in global variables
    global.__TESTCONTAINER__ = container;
    global.__SERVER__ = server;
  } else {
    // For 'test' or 'production' environments, assume database and server are already set up
    // Set API_URL based on the environment
    process.env.API_URL = process.env.API_URL;

    // Create test user and obtain JWT token
    const testUser = {
      email: `test${Date.now()}@example.com`,
      password: 'testPassword123!',
    };

    const axiosInstance = axios.create();
    await axiosInstance.post(`${process.env.API_URL}/register`, testUser);
    const loginResponse = await axiosInstance.post(`${process.env.API_URL}/login`, testUser);
    const jwtToken = loginResponse.data.token;

    // Write environment variables to a file
    const envVars = `
API_URL=${process.env.API_URL}
JWT_TOKEN=${jwtToken}
TEST_USER_EMAIL=${testUser.email}
TEST_USER_PASSWORD=${testUser.password}
`;

    fs.writeFileSync(path.resolve(__dirname, '.test.env'), envVars);

    global.__TEST_USER_EMAIL__ = testUser.email;
    global.__JWT_TOKEN__ = jwtToken;
  }
};
