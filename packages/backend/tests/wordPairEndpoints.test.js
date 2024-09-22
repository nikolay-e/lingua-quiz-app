// wordPairEndpoints.test.js

const axios = require('axios');
const https = require('https');
const { expect } = require('chai');

// Access environment variables
const { API_URL, JWT_TOKEN } = process.env;

const httpsAgent = new https.Agent({});

const axiosInstance = axios.create({
  httpsAgent,
});

describe('Word Pair Endpoints', () => {
  let insertedTranslationId;

  describe('POST /word-pair', () => {
    it('should insert a new word pair', async () => {
      const wordPairData = {
        translationId: Math.floor(Date.now() / 1000), // Use unix timestamp as integer
        sourceWordId: Math.floor(Date.now() / 1000) + 1,
        targetWordId: Math.floor(Date.now() / 1000) + 2,
        sourceWord: 'Hello',
        targetWord: 'Привет',
        sourceLanguageName: 'English',
        targetLanguageName: 'Russian',
        wordListName: 'Test List',
        sourceWordUsageExample: 'Hello, how are you?',
        targetWordUsageExample: 'Привет, как дела?',
      };

      const response = await axiosInstance.post(`${API_URL}/word-pair`, wordPairData, {
        headers: { Authorization: `Bearer ${JWT_TOKEN}` },
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
          headers: { Authorization: `Bearer ${JWT_TOKEN}` },
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
        headers: { Authorization: `Bearer ${JWT_TOKEN}` },
      });

      expect(response.status).to.equal(200);
      expect(response.data.message).to.equal('Word pair and associated data removed successfully');
    });

    it('should return 400 for non-integer translationId', async () => {
      try {
        await axiosInstance.delete(`${API_URL}/word-pair/invalid-id`, {
          headers: { Authorization: `Bearer ${JWT_TOKEN}` },
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
        headers: { Authorization: `Bearer ${JWT_TOKEN}` },
      });

      expect(response.status).to.equal(200);
      expect(response.data.message).to.equal('Word pair and associated data removed successfully');
    });
  });
});
