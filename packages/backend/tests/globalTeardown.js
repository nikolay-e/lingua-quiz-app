// globalTeardown.js
const fs = require('fs');
const path = require('path');
const axios = require('axios');
const dotenv = require('dotenv');

module.exports = async () => {
  // Load environment variables
  dotenv.config({ path: path.resolve(__dirname, '.test.env') });

  const jwtToken = process.env.JWT_TOKEN;
  const { API_URL } = process.env;

  // Delete the test user account
  if (jwtToken) {
    const axiosInstance = axios.create();
    await axiosInstance.delete(`${API_URL}/auth/delete-account`, {
      headers: { Authorization: `Bearer ${jwtToken}` },
    });
  }

  const env = process.env.TEST_ENV || 'local';

  if (env === 'local') {
    // Stop the server
    if (global.__SERVER__) {
      try {
        await new Promise((resolve, reject) => {
          global.__SERVER__.close((err) => {
            if (err) return reject(err);
            resolve();
          });
        });
        console.log('Server stopped successfully.');
      } catch (error) {
        console.warn('Error stopping server:', error.message);
      }
    }

    // Stop the PostgreSQL container
    if (global.__TESTCONTAINER__) {
      try {
        await global.__TESTCONTAINER__.stop();
        console.log('PostgreSQL container stopped successfully.');
      } catch (error) {
        console.warn('Error stopping PostgreSQL container:', error.message);
      }
    }
  }

  // Remove the .test.env file
  try {
    fs.unlinkSync(path.resolve(__dirname, '.test.env'));
    console.log('Test environment file cleaned up.');
  } catch (error) {
    console.warn('Could not remove test environment file:', error.message);
  }
};
