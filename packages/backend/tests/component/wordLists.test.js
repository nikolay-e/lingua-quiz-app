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

describe('Word Lists Endpoint', () => {
  let testUser;
  let jwtToken;

  beforeAll(async () => {
    // Create a test user for this test suite
    const testData = await registerTestUser('wordLists');
    testUser = testData.user;
    jwtToken = testData.token;

    console.log('Test setup completed successfully');
  });

  afterAll(async () => {
    if (jwtToken) {
      await deleteTestUser(jwtToken);
    }
  });

  it('should retrieve the list of word lists', async function () {
    // Make an authenticated request to the word sets endpoint
    const response = await safeApiCall('get', '/word-sets', null, {
      headers: { Authorization: `Bearer ${jwtToken}` },
    });

    // Verify the response status and data structure
    expect(response.status).to.equal(200);
    expect(response.data).to.be.an('array');

    // If we have data, check its structure
    if (response.data.length > 0) {
      const wordList = response.data[0];
      expect(wordList).to.have.property('id');
      expect(wordList).to.have.property('name');
      expect(wordList).to.have.property('createdAt');
      expect(wordList).to.have.property('updatedAt');
    }
  });

  it('should return 401 if not authenticated', async function () {
    try {
      // Make an unauthenticated request
      await safeApiCall('get', '/word-sets');

      // If we got here, the API didn't require authentication
      expect.fail('Expected request to fail with status code 401');
    } catch (error) {
      // Expected behavior - API should return 401 Unauthorized
      if (error.response) {
        expect(error.response.status).to.equal(401);
      } else {
        // Re-throw unexpected errors
        throw error;
      }
    }
  });
});
