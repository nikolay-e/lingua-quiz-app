const { expect } = require('chai');
const { registerTestUser, deleteTestUser, axiosInstance } = require('./testHelpers');

const API_URL = process.env.API_URL;

describe('Registration and Login', () => {
  let testUser;
  let jwtToken;

  it('should register test user', async () => {
    testUser = {
      email: `authTest${Date.now()}@example.com`,
      password: 'testPassword123!',
    };

    await axiosInstance.post(`${API_URL}/register`, testUser);
    const loginResponse = await axiosInstance.post(`${API_URL}/login`, testUser);
    jwtToken = loginResponse.data.token;
  });

  it('should not register an existing user', async () => {
    try {
      await axiosInstance.post(`${API_URL}/register`, testUser);
    } catch (error) {
      expect(error.response.status).to.equal(400);
      expect(error.response.data.message).to.equal(
        'Invalid request. Please check your input and try again.'
      );
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
    } catch (error) {
      expect(error.response.status).to.equal(401);
      expect(error.response.data.message).to.equal('Authentication failed.');
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
