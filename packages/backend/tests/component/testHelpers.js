/*
 * LinguaQuiz – Copyright © 2025 Nikolay Eremeev
 *
 * Dual-licensed:
 *  – Non-Commercial Source-Available v2  →  see LICENSE-NONCOMMERCIAL.md
 *  – Commercial License v2              →  see LICENSE-COMMERCIAL.md
 *
 * Contact: lingua-quiz@nikolay-eremeev.com
 * Repository: https://github.com/nikolay-e/lingua-quiz
 */
const http = require('node:http');
const https = require('node:https');

const axios = require('axios');

// In CI environment, we need to connect to the services directly
const isCI = process.env.CI === 'true';

// Default to localhost:9000/api if API_URL is not set
const API_URL = process.env.API_URL || 'http://localhost:9000/api';

// Validate API_URL
const apiUrl = API_URL.endsWith('/api') ? API_URL : `${API_URL}/api`;
console.log(`Using API URL: ${apiUrl}`);

// Create an axios instance with appropriate configuration
const axiosInstance = axios.create({
  baseURL: apiUrl,
  timeout: 10_000, // 10 seconds timeout
  httpAgent: new http.Agent({ keepAlive: true }),
  httpsAgent: new https.Agent({ rejectUnauthorized: false }), // Allow self-signed certs in test
  validateStatus: (status) => status < 500, // Prevent axios from throwing on 4xx responses
});

/**
 * Helper to make API requests with better error handling
 */
async function safeApiCall(method, url, data = null, config = {}) {
  try {
    console.log(`Making ${method.toUpperCase()} request to: ${url}`);
    const response = await axiosInstance({
      method,
      url,
      data,
      ...config,
    });

    return response;
  } catch (error) {
    console.error(`API call failed (${method} ${url}):`, error.message);
    if (error.response) {
      console.error('Response data:', error.response.data);
      console.error('Response status:', error.response.status);
    }
    throw error;
  }
}

/**
 * Register a test user
 */
async function registerTestUser(userPrefix) {
  const testUser = {
    email: `${userPrefix}test${Date.now()}@example.com`,
    password: 'testPassword123!',
  };

  console.log(`Attempting to register test user: ${testUser.email}`);

  // Register the user
  await safeApiCall('post', '/auth/register', testUser);

  // Login to get token
  const loginResponse = await safeApiCall('post', '/auth/login', testUser);

  if (!loginResponse.data || !loginResponse.data.token) {
    console.error('Login response missing token:', loginResponse.data);
    throw new Error('No token received from login');
  }

  const jwtToken = loginResponse.data.token;
  console.log('Successfully registered and logged in test user');

  return { user: testUser, token: jwtToken };
}

/**
 * Delete a test user
 */
async function deleteTestUser(token) {
  if (!token) {
    console.log('No token provided for user deletion, skipping');
    return;
  }

  try {
    await safeApiCall('delete', '/auth/delete-account', null, {
      headers: { Authorization: `Bearer ${token}` },
    });
    console.log('Test user deleted successfully');
  } catch (error) {
    console.error('Failed to delete test user:', error.message);
  }
}

/**
 * Generate a random integer for testing
 */
const generateInt32 = () => Math.floor(Math.random() * 2_147_483_647);

// Export all helpers
module.exports = {
  registerTestUser,
  deleteTestUser,
  axiosInstance,
  generateInt32,
  safeApiCall,
  apiUrl,
};
