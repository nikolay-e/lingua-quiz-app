import axios from 'axios';
import https from 'https';

// Fix: API endpoints in Docker have different paths
const API_URL = process.env.API_URL || 'http://localhost:9000/api';
const API_AUTH_PATH = `${API_URL}/auth`;

const httpsAgent = new https.Agent({});

const axiosInstance = axios.create({
  httpsAgent,
});

async function registerTestUser(userPrefix) {
  const testUser = {
    email: `${userPrefix}test${Date.now()}@example.com`,
    password: 'testPassword123!',
  };

  await axiosInstance.post(`${API_AUTH_PATH}/register`, testUser);
  const loginResponse = await axiosInstance.post(`${API_AUTH_PATH}/login`, testUser);
  const jwtToken = loginResponse.data.token;

  return { user: testUser, token: jwtToken };
}

async function deleteTestUser(token) {
  await axiosInstance.delete(`${API_AUTH_PATH}/delete-account`, {
    headers: { Authorization: `Bearer ${token}` },
  });
}

const generateInt32 = () => Math.floor(Math.random() * 2147483647);

export { registerTestUser, deleteTestUser, axiosInstance, generateInt32 };
