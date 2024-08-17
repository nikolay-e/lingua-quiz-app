const axios = require('axios');
const https = require('https');
const { expect } = require('chai');

const API_URL = process.env.API_URL || 'https://localhost:3000';

const httpsAgent = new https.Agent({});

const axiosInstance = axios.create({
  httpsAgent,
});

describe('Word List Endpoint', () => {
  const testUser = {
    email: `test${Date.now()}@example.com`,
    password: 'testPassword123!',
  };

  let jwtToken;

  it('should register and login to initialize the jwtToken', async () => {
    await axiosInstance.post(`${API_URL}/register`, testUser);

    const loginResponse = await axiosInstance.post(`${API_URL}/login`, testUser);
    jwtToken = loginResponse.data.token;
  });

  it('should retrieve the Spanish-Russian word list', async () => {
    const response = await axiosInstance.get(`${API_URL}/word-list/spanish-russian`, {
      headers: { Authorization: `Bearer ${jwtToken}` },
    });

    expect(response.status).to.equal(200);
    expect(response.data).to.be.an('array');

    if (response.data.length > 0) {
      const firstWord = response.data[0];
      expect(firstWord).to.have.property('word');
      expect(firstWord).to.have.property('language_code');
      expect(firstWord).to.have.property('translation');
      expect(firstWord).to.have.property('translation_language_code');
    }
  });

  it('should remove test user', async () => {
    await axiosInstance.delete(`${API_URL}/delete-account`, {
      headers: { Authorization: `Bearer ${jwtToken}` },
    });
  });
});
