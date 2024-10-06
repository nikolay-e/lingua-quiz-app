const axios = require('axios');
const https = require('https');

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

  await axiosInstance.post(`${API_URL}/register`, testUser);
  const loginResponse = await axiosInstance.post(`${API_URL}/login`, testUser);
  const jwtToken = loginResponse.data.token;

  return { user: testUser, token: jwtToken };
}

async function deleteTestUser(token) {
  await axiosInstance.delete(`${API_URL}/delete-account`, {
    headers: { Authorization: `Bearer ${token}` },
  });
}

const generateInt32 = () => Math.floor(Math.random() * 2147483647);

module.exports = { registerTestUser, deleteTestUser, axiosInstance, generateInt32};