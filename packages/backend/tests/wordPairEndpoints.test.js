// wordPairEndpoints.test.js

const { expect } = require('chai');
const { registerTestUser, deleteTestUser, axiosInstance, generateInt32 } = require('./testHelpers');

const API_URL = process.env.API_URL;

describe('Word Pair Endpoints', () => {
  let testUser;
  let jwtToken;
  let insertedTranslationId;

  beforeAll(async () => {
    const testData = await registerTestUser('wordPairEndpoints');
    testUser = testData.user;
    jwtToken = testData.token;
  });

  afterAll(async () => {
    await deleteTestUser(jwtToken);
  });

  describe('POST /word-pair', () => {
    it('should insert a new word pair', async () => {
      const wordPairData = {
        translationId: generateInt32(), // Use unix timestamp as integer
        sourceWordId: generateInt32(),
        targetWordId: generateInt32(),
        sourceWord: 'Hello',
        targetWord: 'Привет',
        sourceLanguageName: 'English',
        targetLanguageName: 'Russian',
        wordListName: 'Test Word Pair End Points',
        sourceWordUsageExample: 'Hello, how are you?',
        targetWordUsageExample: 'Привет, как дела?',
      };

      const response = await axiosInstance.post(`${API_URL}/word-pair`, wordPairData, {
        headers: { Authorization: `Bearer ${jwtToken}` },
      });

      expect(response.status).to.equal(201);
      expect(response.data.message).to.equal('Word pair inserted successfully');

      insertedTranslationId = wordPairData.translationId;
    });

    it('should return 400 for invalid input', async () => {
      const invalidData = {
        // Missing required fields
      };

      try {
        await axiosInstance.post(`${API_URL}/word-pair`, invalidData, {
          headers: { Authorization: `Bearer ${jwtToken}` },
        });
        // If no error is thrown, fail the test
        expect.fail('Expected request to fail with status code 400');
      } catch (error) {
        expect(error.response.status).to.equal(400);
      }
    });
  });

  describe('DELETE /word-pair/:translationId', () => {
    it('should remove an existing word pair', async () => {
      const response = await axiosInstance.delete(`${API_URL}/word-pair/${insertedTranslationId}`, {
        headers: { Authorization: `Bearer ${jwtToken}` },
      });

      expect(response.status).to.equal(200);
      expect(response.data.message).to.equal('Word pair and associated data removed successfully');
    });

    it('should return 400 for non-integer translationId', async () => {
      try {
        await axiosInstance.delete(`${API_URL}/word-pair/invalid-id`, {
          headers: { Authorization: `Bearer ${jwtToken}` },
        });
        // If no error is thrown, fail the test
        expect.fail('Expected request to fail with status code 400');
      } catch (error) {
        expect(error.response.status).to.equal(400);
      }
    });

    it('should return 200 for non-existent integer translationId', async () => {
      const nonExistentId = 999999999; // An ID that's unlikely to exist
      const response = await axiosInstance.delete(`${API_URL}/word-pair/${nonExistentId}`, {
        headers: { Authorization: `Bearer ${jwtToken}` },
      });

      expect(response.status).to.equal(200);
      expect(response.data.message).to.equal('Word pair and associated data removed successfully');
    });
  });
});
