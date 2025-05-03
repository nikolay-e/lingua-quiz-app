const https = require('node:https');

const axios = require('axios');

const API_URL = process.env.API_URL;

const httpsAgent = new https.Agent({});

const axiosInstance = axios.create({
  httpsAgent,
});

async function registerTestUser(userPrefix) {
  const testUser = {
    email: `${userPrefix}test${Date.now()}@example.com`,
    password: 'testPassword123!',
  };

  await axiosInstance.post(`${API_URL}/auth/register`, testUser);
  const loginResponse = await axiosInstance.post(`${API_URL}/auth/login`, testUser);
  const jwtToken = loginResponse.data.token;

  return { user: testUser, token: jwtToken };
}

async function deleteTestUser(token) {
  await axiosInstance.delete(`${API_URL}/auth/delete-account`, {
    headers: { Authorization: `Bearer ${token}` },
  });
}

const generateInt32 = () => Math.floor(Math.random() * 2_147_483_647);

module.exports = { registerTestUser, deleteTestUser, axiosInstance, generateInt32 };
