// globalTeardown.js
const fs = require('fs');
const path = require('path');
const axios = require('axios');

module.exports = async () => {
  // Load environment variables
  const dotenv = require('dotenv');
  dotenv.config({ path: path.resolve(__dirname, '.test.env') });

  const jwtToken = process.env.JWT_TOKEN;
  const { API_URL } = process.env;

  // Delete the test user account
  if (jwtToken) {
    const axiosInstance = axios.create();
    await axiosInstance.delete(`${API_URL}/delete-account`, {
      headers: { Authorization: `Bearer ${jwtToken}` },
    });
  }

  const env = process.env.TEST_ENV || 'local';

  if (env === 'local') {
    // Stop the server
    if (global.__SERVER__) {
      await new Promise((resolve, reject) => {
        global.__SERVER__.close((err) => {
          if (err) return reject(err);
          resolve();
        });
      });
    }

    // Stop the PostgreSQL container
    if (global.__TESTCONTAINER__) {
      await global.__TESTCONTAINER__.stop();
    }
  }

  // Remove the .test.env file
  fs.unlinkSync(path.resolve(__dirname, '.test.env'));
};
