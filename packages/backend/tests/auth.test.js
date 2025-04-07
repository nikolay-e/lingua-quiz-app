const { expect } = require('chai');
const { deleteTestUser, axiosInstance } = require('./testHelpers');

const API_URL = process.env.API_URL;

describe('Registration and Login', () => {
  let testUser;
  let jwtToken;

  beforeAll(async () => {
    const uniqueUserPrefix = `authTest${Date.now()}`;
    testUser = {
      email: `${uniqueUserPrefix}@example.com`,
      password: 'testPassword123!',
    };
    try {
      await axiosInstance.post(`${API_URL}/register`, testUser);
      const loginResponse = await axiosInstance.post(`${API_URL}/login`, testUser);
      jwtToken = loginResponse.data.token;
    } catch (error) {
      console.error('!!! Failed to setup user for auth tests:', error.response?.data || error.message);
      throw error;
    }
  });

  afterAll(async () => {
    if (jwtToken) {
      await deleteTestUser(jwtToken);
    }
  });

  it('should not allow duplicate registration', async () => {
    try {
      await axiosInstance.post(`${API_URL}/register`, testUser);
      expect.fail('Second registration attempt should have failed');
    } catch (error) {
      expect(error.response).to.exist;
      expect(error.response.status).to.equal(409);
      expect(error.response.data.message).to.equal('Conflict: The resource already exists or cannot be created.');
    }
  });

  it('should login with correct credentials', async () => {
    const response = await axiosInstance.post(`${API_URL}/login`, testUser);
    expect(response.status).to.equal(200);
    expect(response.data).to.have.property('token');
  });

  it('should not login with incorrect credentials', async () => {
    try {
      await axiosInstance.post(`${API_URL}/login`, {
        ...testUser,
        password: 'wrongPassword',
      });
      expect.fail('Login with incorrect password should have failed');
    } catch (error) {
      expect(error.response).to.exist;
      expect(error.response.status).to.equal(401);
      expect(error.response.data.message).to.equal('Authentication failed or insufficient permissions.');
    }
  });
});
