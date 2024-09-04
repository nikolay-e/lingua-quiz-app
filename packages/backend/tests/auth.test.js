const axios = require('axios');
const https = require('https');
const { expect } = require('chai');

const API_URL = process.env.API_URL;

const httpsAgent = new https.Agent({});

let jwtToken;

const axiosInstance = axios.create({
  httpsAgent,
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
    jwtToken = response.data.token;
  });

  it('should not login with incorrect credentials', async () => {
    try {
      await axiosInstance.post(`${API_URL}/login`, {
        ...testUser,
        password: 'wrongPassword',
      });
    } catch (error) {
      expect(error.response.status).to.equal(401);
      expect(error.response.data.message).to.equal('Invalid credentials');
    }
  });

  it('should remove test user', async () => {
    const response = await axiosInstance.delete(`${API_URL}/delete-account`, {
      headers: { Authorization: `Bearer ${jwtToken}` },
    });

    expect(response.status).to.equal(200);
    expect(response.data.message).to.equal('Account deleted successfully');
  });
});
