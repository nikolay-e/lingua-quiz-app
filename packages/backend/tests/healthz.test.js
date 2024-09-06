const axios = require('axios');
const https = require('https');
const { expect } = require('chai');

const API_URL = process.env.API_URL || 'https://localhost:443';

const httpsAgent = new https.Agent({});

const axiosInstance = axios.create({
  httpsAgent,
});

describe('Health Check', () => {
  it('should return OK status', async () => {
    const response = await axiosInstance.get(`${API_URL}/healthz`);
    expect(response.status).to.equal(200);
    expect(response.data.status).to.equal('ok');
  });
});
