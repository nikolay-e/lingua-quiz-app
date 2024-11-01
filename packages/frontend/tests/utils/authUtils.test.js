import { AuthUtils } from '../../src/js/utils/authUtils.js';
import { errorHandler } from '../../src/js/utils/errorHandler.js';
import jwtDecode from 'jwt-decode';

jest.mock('jwt-decode', () => jest.fn());
jest.mock('../../src/js/utils/errorHandler.js', () => ({
  errorHandler: {
    handleApiError: jest.fn(),
    showError: jest.fn(),
  },
}));

describe('AuthUtils', () => {
  let consoleErrorSpy;
  let mockLocalStorage;

  beforeEach(() => {
    // Setup console mocks
    consoleErrorSpy = jest.spyOn(console, 'error').mockImplementation(() => {});

    // Reset all mocks
    jest.clearAllMocks();

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

    // Setup window.location mock
    delete window.location;
    window.location = {
      href: 'http://localhost/',
      pathname: '/',
      origin: 'http://localhost',
      search: '',
      hash: '',
    };
  });

  afterEach(() => {
    consoleErrorSpy.mockRestore();
    jest.resetAllMocks();
  });

  describe('Token Management', () => {
    test('should set token and expiration', () => {
      const mockToken = 'valid-token';
      const mockExp = Math.floor(Date.now() / 1000 + 3600);
      jwtDecode.mockReturnValue({ exp: mockExp });

      AuthUtils.setToken(mockToken);

      expect(mockLocalStorage.setItem).toHaveBeenCalledWith(AuthUtils.TOKEN_KEY, mockToken);
      expect(mockLocalStorage.setItem).toHaveBeenCalledWith(
        AuthUtils.TOKEN_EXPIRATION_KEY,
        mockExp * 1000
      );
    });

    test('should handle errors when setting token', () => {
      mockLocalStorage.removeItem.mockClear();
      const mockToken = 'invalid-token';
      jwtDecode.mockImplementation(() => {
        throw new Error('Invalid token');
      });

      AuthUtils.setToken(mockToken);

      expect(errorHandler.handleApiError).toHaveBeenCalled();
      expect(mockLocalStorage.removeItem).toHaveBeenCalledWith(AuthUtils.TOKEN_KEY);
      expect(mockLocalStorage.removeItem).toHaveBeenCalledWith(AuthUtils.EMAIL_KEY);
      expect(mockLocalStorage.removeItem).toHaveBeenCalledWith(AuthUtils.TOKEN_EXPIRATION_KEY);
    });

    test('should set email', () => {
      const mockEmail = 'test@example.com';
      AuthUtils.setEmail(mockEmail);
      expect(mockLocalStorage.setItem).toHaveBeenCalledWith(AuthUtils.EMAIL_KEY, mockEmail);
    });

    test('should clear auth', () => {
      mockLocalStorage.removeItem.mockClear();
      AuthUtils.clearAuth();
      expect(mockLocalStorage.removeItem).toHaveBeenCalledWith(AuthUtils.TOKEN_KEY);
      expect(mockLocalStorage.removeItem).toHaveBeenCalledWith(AuthUtils.EMAIL_KEY);
      expect(mockLocalStorage.removeItem).toHaveBeenCalledWith(AuthUtils.TOKEN_EXPIRATION_KEY);
    });

    test('should get token', () => {
      const mockToken = 'test-token';
      mockLocalStorage.store[AuthUtils.TOKEN_KEY] = mockToken;
      expect(AuthUtils.getToken()).toBe(mockToken);
    });
  });

  describe('Navigation and Redirect Logic', () => {
    test('should determine correct redirect to login status when not on login page', () => {
      window.location.pathname = '/dashboard';
      jwtDecode.mockReturnValue({ exp: Date.now() / 1000 - 100 }); // Expired token
      mockLocalStorage.store[AuthUtils.TOKEN_KEY] = 'expired-token';

      const shouldRedirect = AuthUtils.shouldRedirectToLogin();
      expect(shouldRedirect).toBe(true);
    });

    test('should not redirect on login page', () => {
      window.location.pathname = '/login.html';
      const shouldRedirect = AuthUtils.shouldRedirectToLogin();
      expect(shouldRedirect).toBe(false);
    });

    test('should handle redirect to login', () => {
      window.location.pathname = '/dashboard';
      AuthUtils.redirectToLogin();
      expect(window.location.href).toBe('/login.html');
    });
  });

  describe('Auth Check Initialization', () => {
    beforeEach(() => {
      jest.useFakeTimers();
    });

    afterEach(() => {
      jest.useRealTimers();
    });

    test('should set up interval check', () => {
      const setIntervalSpy = jest.spyOn(global, 'setInterval');

      AuthUtils.initAuthCheck();

      expect(setIntervalSpy).toHaveBeenCalledWith(
        expect.any(Function),
        AuthUtils.AUTH_CHECK_INTERVAL
      );
    });

    test('should perform check on interval', () => {
      const redirectSpy = jest.spyOn(AuthUtils, 'redirectToLogin').mockImplementation(() => {});
      jest
        .spyOn(AuthUtils, 'shouldRedirectToLogin')
        .mockReturnValueOnce(false)
        .mockReturnValueOnce(true);

      AuthUtils.initAuthCheck();
      jest.advanceTimersByTime(AuthUtils.AUTH_CHECK_INTERVAL);

      expect(redirectSpy).toHaveBeenCalled();
      redirectSpy.mockRestore();
    });

    test('should handle token check interval', () => {
      window._authCheckInterval = 1000; // 1 second for testing
      const setIntervalSpy = jest.spyOn(global, 'setInterval');

      AuthUtils.initAuthCheck();

      expect(setIntervalSpy).toHaveBeenCalledWith(expect.any(Function), 1000);
      delete window._authCheckInterval;
    });

    test('should not handle non-401 errors', async () => {
      AuthUtils.initAuthCheck();

      const error = { response: { status: 500 } };
      const event = new Event('unhandledrejection');
      Object.defineProperty(event, 'reason', { value: error });

      window.dispatchEvent(event);
      await Promise.resolve();

      expect(mockLocalStorage.removeItem).not.toHaveBeenCalled();
    });
  });
});
