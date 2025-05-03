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

/**
 * Centralized setup for component tests that interact with real API
 * This file provides configuration for running tests against real backend services.
 */
import '@testing-library/jest-dom';
import 'jest-localstorage-mock';
import nodeFetch from 'node-fetch';

import { setupLocalStorageMock, setupLocationMock } from './browserMocks.js';

// Define a fixed server address for component tests
const serverAddress = 'http://localhost:9000';

// Set up mocks before each test
beforeEach(() => {
  // Reset mocks
  jest.clearAllMocks();
  localStorage.clear();

  // Set up basic mocks
  setupLocalStorageMock();
  setupLocationMock();

  // Initialize fetch mock that delegates to node-fetch for real API calls
  global.fetch = jest.fn().mockImplementation(async (url, options = {}) => {
    // Log fetch requests (useful for debugging)
    if (process.env.DEBUG) {
      console.log('Fetch request:', url, options?.method || 'GET');
    }

    try {
      // Use node-fetch implementation for real API calls
      const response = await nodeFetch(url, options);

      if (process.env.DEBUG) {
        console.log('Fetch response status:', response.status);
      }

      return response;
    } catch (error) {
      console.error('Fetch error:', error);
      throw error;
    }
  });
});

// Cleanup after each test
afterEach(() => {
  localStorage.clear();
  jest.clearAllMocks();
});

/**
 * Helper function to create a test user and get auth token
 * @param {Object} userData - User data with email and password
 * @returns {Promise<string|null>} - Auth token or null if failed
 */
export async function createTestUser(userData = null) {
  // Generate unique test user if not provided
  const testUser = userData || {
    email: `test_user_${Date.now()}@example.com`,
    password: 'TestPassword123!',
  };

  try {
    console.log('Creating test user with API URL:', `${serverAddress}/api/auth/register`);

    // Register user
    const registerResponse = await fetch(`${serverAddress}/api/auth/register`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(testUser),
    });

    // If we get a 409 (conflict), the user might already exist, so try to login directly
    if (registerResponse.status === 409) {
      console.log('User may already exist, attempting login directly');
    } else if (registerResponse.ok) {
      console.log('User registered successfully');
    } else {
      const errorText = await registerResponse.text();
      console.error('Failed to register test user:', registerResponse.status, errorText);
      return null;
    }

    // Login to get token
    console.log('Logging in with API URL:', `${serverAddress}/api/auth/login`);
    const loginResponse = await fetch(`${serverAddress}/api/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(testUser),
    });

    if (!loginResponse.ok) {
      const errorText = await loginResponse.text();
      console.error('Failed to login test user:', loginResponse.status, errorText);
      return null;
    }

    try {
      // Get the raw response text first
      const responseText = await loginResponse.text();
      console.log('Raw login response:', responseText);

      // Only try to parse as JSON if there's content
      if (responseText && responseText.trim()) {
        try {
          const loginData = JSON.parse(responseText);
          const authToken = loginData.token;

          // Store in localStorage for auth
          localStorage.setItem('token', authToken);
          localStorage.setItem('email', testUser.email);

          console.log('Login successful, token received');
          return authToken;
        } catch (parseError) {
          console.error('Failed to parse login response JSON:', parseError);
          return null;
        }
      } else {
        console.error('Empty login response received');
        return null;
      }
    } catch (error) {
      console.error('Error reading login response:', error);
      return null;
    }
  } catch (error) {
    console.error('Failed to create test user:', error);
    return null;
  }
}

/**
 * Helper function to delete a test user
 * @param {string} authToken - Auth token for the user to delete
 * @returns {Promise<boolean>} - Success status
 */
export async function deleteTestUser(authToken) {
  if (!authToken) return false;

  try {
    console.log('Deleting test user with API URL:', `${serverAddress}/api/auth/delete-account`);

    const response = await fetch(`${serverAddress}/api/auth/delete-account`, {
      method: 'DELETE',
      headers: { Authorization: `Bearer ${authToken}` },
    });

    if (response.ok) {
      console.log('User deleted successfully');
    } else {
      const errorText = await response.text();
      console.error('Failed to delete test user:', response.status, errorText);
    }

    return response.ok;
  } catch (error) {
    console.error('Failed to delete test user:', error);
    return false;
  }
}

/**
 * Helper function to check API health
 * @returns {Promise<boolean>} - Health status
 */
export async function checkApiHealth() {
  try {
    const response = await fetch(`${serverAddress}/api/health`);
    return response.ok;
  } catch (error) {
    console.error('API health check failed:', error);
    return false;
  }
}

// Additional exports
export { serverAddress,   };
export {AuthUtils} from './utils/authUtils.js';
export {errorHandler} from './utils/errorHandler.js';
