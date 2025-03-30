// tests/auth.test.js
const { expect } = require('chai');
const { registerTestUser, deleteTestUser, axiosInstance } = require('./testHelpers');

const API_URL = process.env.API_URL;

describe('Registration and Login', () => {
  let testUser;
  let jwtToken;

  // Регистрируем пользователя один раз перед всеми тестами в этом блоке
  beforeAll(async () => {
      const uniqueUserPrefix = `authTest${Date.now()}`;
      testUser = {
          email: `${uniqueUserPrefix}@example.com`,
          password: 'testPassword123!',
      };
      // Регистрируем, но не проверяем результат здесь
      try {
        await axiosInstance.post(`${API_URL}/register`, testUser);
        // Получаем токен для последующего удаления
        const loginResponse = await axiosInstance.post(`${API_URL}/login`, testUser);
        jwtToken = loginResponse.data.token;
      } catch (error) {
        // Если регистрация или логин здесь упали, что-то не так с окружением
        console.error("!!! Failed to setup user for auth tests:", error.response?.data || error.message);
        throw error; // Прерываем тесты, если setup не удался
      }
  });

  // Удаляем пользователя после всех тестов
  afterAll(async () => {
      if (jwtToken) {
          await deleteTestUser(jwtToken);
      }
  });


  it('should not allow duplicate registration', async () => {
    try {
      // Повторно пытаемся зарегистрировать того же пользователя
      await axiosInstance.post(`${API_URL}/register`, testUser);
      expect.fail('Second registration attempt should have failed');
    } catch (error) {
      expect(error.response).to.exist; // Убедимся, что есть ответ
      // *** ИСПРАВЛЕНО: Ожидаем 409 Conflict ***
      expect(error.response.status).to.equal(409);
      // *** ИСПРАВЛЕНО: Ожидаем сообщение от errorHandler для 409 ***
      expect(error.response.data.message).to.equal(
        'Conflict: The resource already exists or cannot be created.'
      );
      // Если хотите проверить исходное сообщение:
      // expect(error.response.data.error?.message).to.equal('User already exists');
    }
  });

  it('should login with correct credentials', async () => {
    // testUser уже зарегистрирован в beforeAll
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
      // *** ИСПРАВЛЕНО: Ожидаем фактическое сообщение от errorHandler ***
      expect(error.response.data.message).to.equal('Authentication failed or insufficient permissions.');
    }
  });

  // Тест на удаление перенесен в afterAll, чтобы он выполнялся гарантированно
});