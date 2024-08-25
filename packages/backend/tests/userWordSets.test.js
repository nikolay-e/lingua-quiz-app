/* eslint-disable no-plusplus */
/* eslint-disable max-len */
/* eslint-disable no-await-in-loop */
/* eslint-disable no-restricted-syntax */
const axios = require('axios');
const https = require('https');
const { expect } = require('chai');

const API_URL = process.env.API_URL || 'https://localhost:3000';

const httpsAgent = new https.Agent();

const axiosInstance = axios.create({
  httpsAgent,
});

describe('User Word Sets Endpoint', () => {
  const testUser = {
    email: `test${Date.now()}@example.com`,
    password: 'testPassword123!',
  };

  let jwtToken;
  let initialUpcomingWords;

  // Increase timeout for all tests
  // eslint-disable-next-line no-undef
  jest.setTimeout(60000); // 60 seconds

  it('should register and login to initialize the JWT token', async () => {
    await axiosInstance.post(`${API_URL}/register`, testUser);

    const loginResponse = await axiosInstance.post(`${API_URL}/login`, testUser);
    jwtToken = loginResponse.data.token;
    expect(jwtToken).to.be.a('string');
  });

  it('should retrieve the initial word sets and verify all are in Upcoming Words', async () => {
    const wordListName = 'Test Spanish';
    const response = await axiosInstance.get(`${API_URL}/user/word-sets`, {
      headers: { Authorization: `Bearer ${jwtToken}` },
      params: { wordListName },
    });

    expect(response.status).to.equal(200);
    expect(response.data).to.be.an('array');
    expect(response.data.length).to.equal(30); // We inserted 30 word pairs

    // Verify all words are in Upcoming Words initially
    initialUpcomingWords = response.data.filter((set) => set.status === 'Upcoming Words');
    expect(initialUpcomingWords.length).to.equal(30);
    response.data.forEach((set) => {
      expect(set.status).to.equal('Upcoming Words');
      expect(set.source_word_usage_example).to.be.a('string');
      expect(set.target_word_usage_example).to.be.a('string');
    });
  });

  it('should update the word sets', async () => {
    const wordUpdates = [
      {
        status: 'Focus Words',
        wordPairIds: initialUpcomingWords.slice(0, 10).map((set) => set.word_pair_id),
      },
      {
        status: 'Mastered One Direction',
        wordPairIds: initialUpcomingWords.slice(10, 20).map((set) => set.word_pair_id),
      },
      {
        status: 'Mastered Vocabulary',
        wordPairIds: initialUpcomingWords.slice(20, 30).map((set) => set.word_pair_id),
      },
    ];

    for (const { status, wordPairIds } of wordUpdates) {
      const updateResponse = await axiosInstance.post(
        `${API_URL}/user/word-sets`,
        {
          status,
          wordPairIds,
        },
        {
          headers: { Authorization: `Bearer ${jwtToken}` },
        }
      );

      expect(updateResponse.status).to.equal(200);
    }
  });

  it('should verify the updated word sets', async () => {
    const wordListName = 'Test Spanish';
    const response = await axiosInstance.get(`${API_URL}/user/word-sets`, {
      headers: { Authorization: `Bearer ${jwtToken}` },
      params: { wordListName },
    });

    expect(response.status).to.equal(200);
    expect(response.data).to.be.an('array');
    expect(response.data.length).to.equal(30);

    const statusCounts = response.data.reduce((acc, set) => {
      acc[set.status] = (acc[set.status] || 0) + 1;
      return acc;
    }, {});

    expect(statusCounts['Focus Words']).to.equal(10);
    expect(statusCounts['Mastered One Direction']).to.equal(10);
    expect(statusCounts['Mastered Vocabulary']).to.equal(10);

    response.data.forEach((set) => {
      expect(set.source_word_usage_example).to.be.a('string');
      expect(set.target_word_usage_example).to.be.a('string');
    });
  });

  it('should handle an empty wordPairIds array for all statuses gracefully', async () => {
    const wordListName = 'Test Spanish';
    const statuses = ['Focus Words', 'Mastered One Direction', 'Mastered Vocabulary'];

    const initialResponse = await axiosInstance.get(`${API_URL}/user/word-sets`, {
      headers: { Authorization: `Bearer ${jwtToken}` },
      params: { wordListName },
    });

    expect(initialResponse.status).to.equal(200);
    expect(initialResponse.data).to.be.an('array');

    const initialWordSets = initialResponse.data;

    // Iterate over each status and perform the update with an empty array
    for (const status of statuses) {
      const updateResponse = await axiosInstance.post(
        `${API_URL}/user/word-sets`,
        {
          status,
          wordPairIds: [],
        },
        {
          headers: { Authorization: `Bearer ${jwtToken}` },
        }
      );

      expect(updateResponse.status).to.equal(200);
    }

    const finalResponse = await axiosInstance.get(`${API_URL}/user/word-sets`, {
      headers: { Authorization: `Bearer ${jwtToken}` },
      params: { wordListName },
    });

    expect(finalResponse.status).to.equal(200);
    expect(finalResponse.data).to.be.an('array');

    // Instead of expecting exact equality, we'll check that all words are now "Upcoming Words"
    finalResponse.data.forEach((wordSet) => {
      expect(wordSet.status).to.equal('Upcoming Words');
      expect(wordSet.source_word_usage_example).to.be.a('string');
      expect(wordSet.target_word_usage_example).to.be.a('string');
    });

    // Check that the word sets are the same except for the status
    // eslint-disable-next-line no-unused-vars
    expect(finalResponse.data.map(({ status, ...rest }) => rest)).to.deep.equal(
      // eslint-disable-next-line no-unused-vars
      initialWordSets.map(({ status, ...rest }) => rest)
    );
  });

  it('should remove the test user', async () => {
    const deleteResponse = await axiosInstance.delete(`${API_URL}/delete-account`, {
      headers: { Authorization: `Bearer ${jwtToken}` },
    });
    expect(deleteResponse.status).to.equal(200);
  });
});
