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
const { beforeAll, afterAll } = require('@jest/globals');
const { expect } = require('chai');

const { registerTestUser, deleteTestUser, safeApiCall } = require('./testHelpers');

describe('Registration and Login', () => {
  let testUser;
  let jwtToken;

  beforeAll(async () => {
    try {
      // Register a test user for our auth tests
      const { user, token } = await registerTestUser('authTest');
      testUser = user;
      jwtToken = token;

      console.log('Test setup completed successfully');
    } catch (error) {
      console.error('Failed to setup user for auth tests:', error.message);
      // Let the error propagate - we want tests to fail if setup fails
      throw error;
    }
  });

  afterAll(async () => {
    if (jwtToken) {
      await deleteTestUser(jwtToken);
    }
  });

  it('should not allow duplicate registration', async () => {
    try {
      // Try to register the same user again
      await safeApiCall('post', '/auth/register', testUser);

      // If we got here, the API didn't reject the duplicate, which is unexpected
      expect.fail('Second registration attempt should have failed');
    } catch (error) {
      // Expected behavior - API should return 409 Conflict
      if (error.response) {
        expect(error.response.status).to.equal(409);
        expect(error.response.data.message).to.include('Conflict');
      } else {
        // Re-throw unexpected errors
        throw error;
      }
    }
  });

  it('should login with correct credentials', async () => {
    // Test login with the same user credentials
    const response = await safeApiCall('post', '/auth/login', testUser);

    expect(response.status).to.equal(200);
    expect(response.data).to.have.property('token');
    expect(response.data.token).to.be.a('string');
  });

  it('should not login with incorrect credentials', async () => {
    try {
      // Try to login with wrong password
      await safeApiCall('post', '/auth/login', {
        ...testUser,
        password: 'wrongPassword',
      });

      // If we got here, the API didn't reject the bad login, which is unexpected
      expect.fail('Login with incorrect password should have failed');
    } catch (error) {
      // Expected behavior - API should return 401 Unauthorized
      if (error.response) {
        expect(error.response.status).to.equal(401);
        expect(error.response.data.message).to.include('Authentication failed');
      } else {
        // Re-throw unexpected errors
        throw error;
      }
    }
  });
});
