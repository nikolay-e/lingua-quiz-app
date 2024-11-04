import { AuthManager } from '../../src/js/ui/loginManager.js';
import { AuthUtils } from '../../src/js/utils/authUtils.js';
import { errorHandler } from '../../src/js/utils/errorHandler.js';
import serverAddress from '../../src/js/config.js';

jest.mock('../../src/js/utils/authUtils.js', () => ({
  AuthUtils: {
    TOKEN_KEY: 'token',
    EMAIL_KEY: 'email',
    TOKEN_EXPIRATION_KEY: 'tokenExpiration',
    getToken: jest.fn(),
    setToken: jest.fn(),
    setEmail: jest.fn(),
    clearAuth: jest.fn(),
    isValidToken: jest.fn(),
    redirectToLogin: jest.fn(),
    shouldRedirectToLogin: jest.fn(),
    initAuthCheck: jest.fn(),
  },
}));

jest.mock('../../src/js/utils/errorHandler.js', () => ({
  errorHandler: {
    handleApiError: jest.fn(),
    showError: jest.fn(),
    init: jest.fn(),
  },
}));

describe('AuthManager', () => {
  let authManager;
  let mockLocalStorage;
  let mockFetch;

  beforeEach(() => {
    // Setup DOM
    document.body.innerHTML = `
      <div id="user-status">
        <div id="login-logout-btn"></div>
      </div>
      <form id="login-form">
        <input id="email" type="email" />
        <input id="password" type="password" />
        <div id="login-message"></div>
      </form>
      <form id="register-form">
        <input id="register-email" type="email" />
        <input id="register-password" type="password" />
        <button type="submit">Register</button>
        <div id="register-message"></div>
        <div class="password-requirements"></div>
      </form>
    `;

    // Setup localStorage mock
    mockLocalStorage = {
      store: {},
      getItem: jest.fn((key) => mockLocalStorage.store[key]),
      setItem: jest.fn((key, value) => {
        mockLocalStorage.store[key] = value;
      }),
      removeItem: jest.fn((key) => {
        delete mockLocalStorage.store[key];
      }),
      clear: jest.fn(() => {
        mockLocalStorage.store = {};
      }),
    };
    Object.defineProperty(window, 'localStorage', {
      value: mockLocalStorage,
      writable: true,
    });

    // Setup fetch mock
    mockFetch = jest.fn();
    global.fetch = mockFetch;

    // Setup window.location mock
    const locationMock = {
      href: '/',
      pathname: '/',
      replace: jest.fn(),
      assign: jest.fn(),
    };

    Object.defineProperty(window, 'location', {
      value: locationMock,
      writable: true,
      configurable: true,
    });

    // Create instance
    authManager = new AuthManager();

    // Reset all mocks
    jest.clearAllMocks();
  });

  afterEach(() => {
    jest.resetAllMocks();
  });

  describe('Authentication State', () => {
    test('should check authentication status correctly', () => {
      AuthUtils.isValidToken.mockReturnValueOnce(true);
      expect(authManager.isAuthenticated()).toBe(true);

      AuthUtils.isValidToken.mockReturnValueOnce(false);
      expect(authManager.isAuthenticated()).toBe(false);
    });
  });

  describe('Login Handling', () => {
    test('should handle successful login', async () => {
      const mockResponse = { token: 'valid-token' };
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve(mockResponse),
      });

      const event = { preventDefault: jest.fn() };
      document.getElementById('email').value = 'test@example.com';
      document.getElementById('password').value = 'password123';

      await authManager.handleLogin(event);

      expect(event.preventDefault).toHaveBeenCalled();
      expect(AuthUtils.setToken).toHaveBeenCalledWith('valid-token');
      expect(AuthUtils.setEmail).toHaveBeenCalledWith('test@example.com');
      expect(document.getElementById('login-message').textContent).toContain('Login successful');
      expect(window.location.replace).toHaveBeenCalledWith('/');
    });

    test('should handle login failure', async () => {
      const mockError = { message: 'Invalid credentials' };
      mockFetch.mockResolvedValueOnce({
        ok: false,
        json: () => Promise.resolve(mockError),
      });

      const event = { preventDefault: jest.fn() };
      await authManager.handleLogin(event);

      expect(errorHandler.showError).toHaveBeenCalledWith('Invalid credentials');
    });

    test('should handle network errors during login', async () => {
      mockFetch.mockRejectedValueOnce(new Error('Network error'));

      const event = { preventDefault: jest.fn() };
      await authManager.handleLogin(event);

      expect(errorHandler.handleApiError).toHaveBeenCalled();
    });
  });

  describe('Logout', () => {
    test('should clear auth and redirect on logout', () => {
      authManager.logout();

      expect(AuthUtils.clearAuth).toHaveBeenCalled();
      expect(window.location.replace).toHaveBeenCalledWith('login.html');
    });
  });

  describe('UI Updates', () => {
    test('should update login button for authenticated user', () => {
      AuthUtils.isValidToken.mockReturnValue(true);
      mockLocalStorage.getItem.mockReturnValueOnce('test@example.com');

      authManager.updateLoginStatus();

      const button = document.getElementById('login-logout-btn');
      expect(button.innerHTML).toContain('Logout');
      expect(button.innerHTML).toContain('test@example.com');
    });

    test('should update login button for unauthenticated user', () => {
      AuthUtils.isValidToken.mockReturnValue(false);

      authManager.updateLoginStatus();

      const button = document.getElementById('login-logout-btn');
      expect(button.innerHTML).toContain('Login');
    });
  });

  describe('Password Validation', () => {
    test('should initialize password validation UI', () => {
      const passwordInput = document.getElementById('register-password');
      const registerForm = document.getElementById('register-form');

      authManager.initializePasswordValidation(passwordInput, registerForm);

      expect(document.querySelector('.password-requirements')).toBeTruthy();
      expect(document.querySelector('.toggle-password-btn')).toBeTruthy();
    });

    test('should toggle password visibility', () => {
      const passwordInput = document.getElementById('register-password');
      const registerForm = document.getElementById('register-form');

      authManager.initializePasswordValidation(passwordInput, registerForm);
      const toggleButton = document.querySelector('.toggle-password-btn');

      toggleButton.click();
      expect(passwordInput.type).toBe('text');

      toggleButton.click();
      expect(passwordInput.type).toBe('password');
    });
  });

  describe('Registration', () => {
    test('should handle successful registration', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve({ message: 'Success' }),
      });

      const event = { preventDefault: jest.fn() };
      document.getElementById('register-email').value = 'new@example.com';
      document.getElementById('register-password').value = 'ValidPassword123!';

      authManager.passwordValidator.validatePassword = jest.fn().mockReturnValue(true);

      await authManager.handleRegister(event);

      expect(event.preventDefault).toHaveBeenCalled();
      expect(document.getElementById('register-message').textContent).toContain(
        'Registration successful'
      );
    });

    test('should validate password requirements', async () => {
      const event = { preventDefault: jest.fn() };
      document.getElementById('register-password').value = 'weak';

      authManager.passwordValidator.validatePassword = jest.fn().mockReturnValue(false);

      await authManager.handleRegister(event);

      expect(errorHandler.showError).toHaveBeenCalledWith('Please meet all password requirements');
      expect(mockFetch).not.toHaveBeenCalled();
    });

    test('should handle registration failure', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: false,
        json: () => Promise.resolve({ message: 'Email already exists' }),
      });

      const event = { preventDefault: jest.fn() };
      document.getElementById('register-password').value = 'ValidPassword123!';
      authManager.passwordValidator.validatePassword = jest.fn().mockReturnValue(true);

      await authManager.handleRegister(event);

      expect(errorHandler.showError).toHaveBeenCalledWith('Email already exists');
    });

    test('should handle network errors during registration', async () => {
      mockFetch.mockRejectedValueOnce(new Error('Network error'));

      const event = { preventDefault: jest.fn() };
      document.getElementById('register-password').value = 'ValidPassword123!';
      authManager.passwordValidator.validatePassword = jest.fn().mockReturnValue(true);

      await authManager.handleRegister(event);

      expect(errorHandler.handleApiError).toHaveBeenCalled();
    });
  });

  describe('Form Initialization', () => {
    test('should initialize forms and event listeners', () => {
      const initializePasswordValidationSpy = jest
        .spyOn(authManager, 'initializePasswordValidation')
        .mockImplementation(() => {});

      authManager.initializeForms();

      expect(initializePasswordValidationSpy).toHaveBeenCalled();
      expect(document.getElementById('register-form')).toBeTruthy();
      expect(document.getElementById('login-form')).toBeTruthy();

      initializePasswordValidationSpy.mockRestore();
    });
  });

  describe('Auth Check', () => {
    test('should check auth and redirect when needed', () => {
      AuthUtils.shouldRedirectToLogin.mockReturnValue(true);

      authManager.checkAuthAndRedirect();

      expect(AuthUtils.redirectToLogin).toHaveBeenCalled();
    });

    test('should not redirect when auth is valid', () => {
      AuthUtils.shouldRedirectToLogin.mockReturnValue(false);

      authManager.checkAuthAndRedirect();

      expect(AuthUtils.redirectToLogin).not.toHaveBeenCalled();
    });
  });
});
