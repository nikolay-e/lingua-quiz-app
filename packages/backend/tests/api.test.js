const axios = require('axios');
const https = require('https');
const { expect } = require('chai');

const API_URL = process.env.API_URL || 'https://localhost:3000';

const httpsAgent = new https.Agent({});

// Create an Axios instance with the custom agent
const axiosInstance = axios.create({
  httpsAgent,
});

describe('Backend API Tests', () => {
  describe('Health Check', () => {
    it('should return OK status', async () => {
      const response = await axiosInstance.get(`${API_URL}/healthz`);
      expect(response.status).to.equal(200);
      expect(response.data.status).to.equal('ok');
    });
  });

  describe('Registration and Login', () => {
    const testUser = {
      email: `test${Date.now()}@example.com`,
      password: 'testPassword123!',
    };

    it('should register a new user', async () => {
      const response = await axiosInstance.post(`${API_URL}/register`, testUser);
      expect(response.status).to.equal(201);
      expect(response.data.message).to.equal('User registered successfully');
    });

    it('should not register an existing user', async () => {
      try {
        await axiosInstance.post(`${API_URL}/register`, testUser);
      } catch (error) {
        expect(error.response.status).to.equal(400);
        expect(error.response.data.message).to.equal('User already exists');
      }
    });

    it('should login with correct credentials', async () => {
      const response = await axiosInstance.post(`${API_URL}/login`, testUser);
      expect(response.status).to.equal(200);
      expect(response.data).to.have.property('token');
    });

    it('should not login with incorrect credentials', async () => {
      try {
        await axiosInstance.post(`${API_URL}/login`, { ...testUser, password: 'wrongPassword' });
      } catch (error) {
        expect(error.response.status).to.equal(401);
        expect(error.response.data.message).to.equal('Invalid credentials');
      }
    });
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
});
