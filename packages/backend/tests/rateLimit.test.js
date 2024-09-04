const axios = require('axios');
const https = require('https');
const { expect } = require('chai');

const API_URL = process.env.API_URL;

const httpsAgent = new https.Agent({});

const axiosInstance = axios.create({
  httpsAgent,
});

describe('Rate Limiting', () => {
  it('should enforce rate limit', async () => {
    const requests = Array(105)
      .fill()
      .map(() => axiosInstance.get(`${API_URL}/healthz`));
    try {
      await Promise.all(requests);
    } catch (error) {
      expect(error.response.status).to.equal(429);
    }
  });
});
