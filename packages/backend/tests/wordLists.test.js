// wordLists.test.js

const axios = require('axios');
const https = require('https');
const { expect } = require('chai');

const { API_URL, JWT_TOKEN } = process.env;

const httpsAgent = new https.Agent({});

const axiosInstance = axios.create({
  httpsAgent,
});

describe('Word Lists Endpoint', () => {
  it('should retrieve the list of word lists', async function () {
    const response = await axiosInstance.get(`${API_URL}/word-lists`, {
      headers: { Authorization: `Bearer ${JWT_TOKEN}` },
    });

    expect(response.status).to.equal(200);
    expect(response.data).to.be.an('array');

    // Assuming there's at least one word list in the database
    expect(response.data.length).to.be.at.least(1);

    // Check the structure of the returned word list objects
    response.data.forEach(wordList => {
      expect(wordList).to.have.all.keys('id', 'name', 'createdAt', 'updatedAt');
      expect(wordList.id).to.be.a('number');
      expect(wordList.name).to.be.a('string');
      expect(wordList.createdAt).to.be.a('string');
      expect(wordList.updatedAt).to.be.a('string');
    });
  });

  it('should return 401 if not authenticated', async function () {
    try {
      await axiosInstance.get(`${API_URL}/word-lists`);
      // If no error is thrown, fail the test
      expect.fail('Expected request to fail with status code 401');
    } catch (error) {
      expect(error.response.status).to.equal(401);
    }
  });
});