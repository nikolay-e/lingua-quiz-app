const { beforeAll, afterAll } = require('@jest/globals');
const { expect } = require('chai');

const { registerTestUser, deleteTestUser, axiosInstance } = require('./testHelpers');

const API_URL = process.env.API_URL;

describe('Word Lists Endpoint', () => {
  let testUser;
  let jwtToken;

  beforeAll(async () => {
    const testData = await registerTestUser('wordLists');
    testUser = testData.user;
    jwtToken = testData.token;
  });

  afterAll(async () => {
    await deleteTestUser(jwtToken);
  });

  it('should retrieve the list of word lists', async function () {
    const response = await axiosInstance.get(`${API_URL}/word-sets`, {
      headers: { Authorization: `Bearer ${jwtToken}` },
    });

    expect(response.status).to.equal(200);
    expect(response.data).to.be.an('array');

    // Assuming there's at least one word list in the database
    expect(response.data.length).to.be.at.least(1);

    // Check the structure of the returned word list objects
    for (const wordList of response.data) {
      expect(wordList).to.have.all.keys('id', 'name', 'createdAt', 'updatedAt');
      expect(wordList.id).to.be.a('number');
      expect(wordList.name).to.be.a('string');
      expect(wordList.createdAt).to.be.a('string');
      expect(wordList.updatedAt).to.be.a('string');
    }
  });

  it('should return 401 if not authenticated', async function () {
    try {
      await axiosInstance.get(`${API_URL}/word-sets`);
      // If no error is thrown, fail the test
      expect.fail('Expected request to fail with status code 401');
    } catch (error) {
      expect(error.response.status).to.equal(401);
    }
  });
});
