// Import the actual module to test
import { AuthUtils } from '../../../src/js/utils/authUtils.js';
import jwt_decode from 'jwt-decode';
import { 
  errorHandler, 
  mockJwtDecode, 
  setupLocalStorageMock, 
  setupLocationMock, 
  suppressConsoleOutput,
  createMockToken
} from '../../__mocks__/unitTestSetup.js';

// Mark this module as to be mocked
jest.mock('../../../src/js/utils/errorHandler.js', () => ({
  errorHandler: require('../../__mocks__/utils/errorHandler').errorHandler
}));

describe('AuthUtils', () => {
  let mockLocalStorage;
  let locationMock;
  let consoleCleanup;

  beforeEach(() => {
    // Setup test environment
    mockLocalStorage = setupLocalStorageMock();
    const locationSetup = setupLocationMock();
    locationMock = locationSetup.locationMock;
    consoleCleanup = suppressConsoleOutput();

    // Make sure jwt_decode mock has a good implementation
    mockJwtDecode.mockImplementation(token => {
      if (!token || token === 'invalid-token') {
        throw new Error('Invalid token');
      }
      return { exp: Math.floor(Date.now() / 1000) + 3600 }; // Default to valid token
    });

    // Reset all mocks but maintain implementations
    jest.clearAllMocks();
  });

  afterEach(() => {
    // Restore original implementations
    consoleCleanup.restoreConsole();
  });

  describe('Token Management', () => {
    test('should handle token management', () => {
      // Simply verify that we can call the methods without errors
      const mockToken = 'valid-token';
      
      // Just test that the function exists and doesn't throw errors
      expect(() => {
        AuthUtils.setToken(mockToken);
        AuthUtils.getToken();
      }).not.toThrow();
    });

    test('should handle errors when setting token', () => {
      mockLocalStorage.removeItem.mockClear();
      const mockToken = 'invalid-token';
      mockJwtDecode.mockImplementation(() => {
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
      locationMock.pathname = '/dashboard';
      mockJwtDecode.mockReturnValue({ exp: Date.now() / 1000 - 100 }); // Expired token
      mockLocalStorage.store[AuthUtils.TOKEN_KEY] = 'expired-token';

      const shouldRedirect = AuthUtils.shouldRedirectToLogin();
      expect(shouldRedirect).toBe(true);
    });

    test('should not redirect on login page', () => {
      locationMock.pathname = '/login.html';
      const shouldRedirect = AuthUtils.shouldRedirectToLogin();
      expect(shouldRedirect).toBe(false);
    });

    test('should handle redirect to login', () => {
      locationMock.pathname = '/dashboard';
      AuthUtils.redirectToLogin();
      expect(locationMock.replace).toHaveBeenCalledWith('/login.html');
    });
  });

  describe('Auth Check Initialization', () => {
    beforeEach(() => {
      jest.useFakeTimers();
    });

    afterEach(() => {
      jest.useRealTimers();
    });

    test('should set up interval check when authenticated', () => {
      // Mock dependencies
      const setIntervalSpy = jest.spyOn(global, 'setInterval');
      const handleTokenExpirationSpy = jest
        .spyOn(AuthUtils, 'handleTokenExpiration')
        .mockReturnValue(true);

      // Call the function under test
      const result = AuthUtils.initAuthCheck();

      // Verify behavior
      expect(handleTokenExpirationSpy).toHaveBeenCalled();
      expect(setIntervalSpy).toHaveBeenCalledWith(
        expect.any(Function),
        AuthUtils.AUTH_CHECK_INTERVAL
      );
      expect(result).not.toBeNull(); // Should return the interval handle

      // Clean up
      handleTokenExpirationSpy.mockRestore();
    });

    test('should not set interval if not authenticated', () => {
      // Mock dependencies
      const setIntervalSpy = jest.spyOn(global, 'setInterval');
      const handleTokenExpirationSpy = jest
        .spyOn(AuthUtils, 'handleTokenExpiration')
        .mockReturnValue(false);

      // Set path to something other than login page
      locationMock.pathname = '/dashboard';

      // Call the function under test
      const result = AuthUtils.initAuthCheck();

      // Verify behavior
      expect(handleTokenExpirationSpy).toHaveBeenCalled();
      expect(result).toBeNull(); // Should return null
      expect(setIntervalSpy).not.toHaveBeenCalled(); // Should not set up interval

      // Clean up
      handleTokenExpirationSpy.mockRestore();
    });

    test('should set up interval on login page if token valid', () => {
      // Mock dependencies
      const setIntervalSpy = jest.spyOn(global, 'setInterval');
      const handleTokenExpirationSpy = jest
        .spyOn(AuthUtils, 'handleTokenExpiration')
        .mockReturnValue(true);

      // Set path to login page
      locationMock.pathname = AuthUtils.LOGIN_PAGE;

      // Call the function under test
      const result = AuthUtils.initAuthCheck();

      // Verify behavior
      expect(handleTokenExpirationSpy).toHaveBeenCalled();
      expect(setIntervalSpy).toHaveBeenCalled(); // Should set up interval
      expect(result).not.toBeNull(); // Should return interval

      // Clean up
      handleTokenExpirationSpy.mockRestore();
    });

    test('should perform check on interval', () => {
      // Mock dependencies
      const handleTokenExpirationSpy = jest
        .spyOn(AuthUtils, 'handleTokenExpiration')
        .mockReturnValueOnce(true) // First check during initialization - token valid
        .mockReturnValueOnce(false); // Second check during interval - token invalid, redirected

      // Set up environment
      locationMock.pathname = '/dashboard'; // Not on login page

      // Call the function under test
      AuthUtils.initAuthCheck();

      // Advance time to trigger interval
      jest.advanceTimersByTime(AuthUtils.AUTH_CHECK_INTERVAL);

      // Verify behavior - handleTokenExpiration called twice, first for init then for interval
      expect(handleTokenExpirationSpy).toHaveBeenCalledTimes(2);

      // Clean up
      handleTokenExpirationSpy.mockRestore();
    });

    test('should handle custom token check interval', () => {
      // Set up custom interval
      window._authCheckInterval = 1000; // 1 second for testing

      // Mock dependencies
      const setIntervalSpy = jest.spyOn(global, 'setInterval');
      const handleTokenExpirationSpy = jest
        .spyOn(AuthUtils, 'handleTokenExpiration')
        .mockReturnValue(true);

      // Call the function under test
      AuthUtils.initAuthCheck();

      // Verify behavior
      expect(setIntervalSpy).toHaveBeenCalledWith(expect.any(Function), 1000);

      // Clean up
      delete window._authCheckInterval;
      handleTokenExpirationSpy.mockRestore();
    });
  });

  describe('Token Validation Edge Cases', () => {
    test('should handle token validation', () => {
      const invalidToken = 'this.is.not.a.jwt';
      
      // Setup mockJwtDecode to throw for invalid tokens
      mockJwtDecode.mockImplementationOnce(() => {
        throw new Error('Invalid token');
      });
      
      // Call the function under test with invalid token
      const invalidResult = AuthUtils.isValidToken(invalidToken);
      
      // Check the result is correct
      expect(invalidResult).toBeFalsy();
    });

    test('should handle tokens without expiration', () => {
      // Setup mockJwtDecode to return token without exp
      mockJwtDecode.mockImplementationOnce(() => {
        return { iat: Date.now() / 1000 }; // No exp field
      });
      
      // Call the function
      const noExpResult = AuthUtils.isValidToken('valid.token.noexp');
      
      // Check result - token without exp should be invalid
      expect(noExpResult).toBeFalsy();
    });

    test('should handle tokens expiring soon', () => {
      // Setup token expiring in 30 seconds
      const futureExp = Math.floor(Date.now() / 1000) + 30;
      
      // Setup mockJwtDecode to return soon-expiring token
      mockJwtDecode.mockImplementationOnce(() => {
        return { exp: futureExp };
      });
      
      // Call the function
      const soonExpiringResult = AuthUtils.isValidToken('valid.token.expiringsoon');
      
      // Check result - soon expiring token should be invalid
      expect(soonExpiringResult).toBeFalsy();
    });
  });

  describe('handleTokenExpiration', () => {
    test('should return true for valid token', () => {
      const validToken = 'valid.token.withexp';
      const futureExp = Math.floor(Date.now() / 1000) + 3600; // 1 hour in future

      // Set up mock for isValidToken
      const isValidTokenSpy = jest.spyOn(AuthUtils, 'isValidToken').mockReturnValue(true);
      const getTokenSpy = jest.spyOn(AuthUtils, 'getToken').mockReturnValue(validToken);
      // Spy on methods we want to verify aren't called
      const clearAuthSpy = jest.spyOn(AuthUtils, 'clearAuth').mockImplementation(() => {});
      const redirectSpy = jest.spyOn(AuthUtils, 'redirectToLogin').mockImplementation(() => {});

      // Call the function under test
      const result = AuthUtils.handleTokenExpiration();

      // Verify behavior
      expect(getTokenSpy).toHaveBeenCalled();
      expect(isValidTokenSpy).toHaveBeenCalledWith(validToken);
      expect(clearAuthSpy).not.toHaveBeenCalled();
      expect(redirectSpy).not.toHaveBeenCalled();
      expect(result).toBe(true);

      // Clean up
      isValidTokenSpy.mockRestore();
      getTokenSpy.mockRestore();
      clearAuthSpy.mockRestore();
      redirectSpy.mockRestore();
    });

    test('should clear auth and redirect for invalid token', () => {
      const invalidToken = 'invalid.token';

      // Set up mocks
      locationMock.pathname = '/dashboard'; // Not on login page
      const isValidTokenSpy = jest.spyOn(AuthUtils, 'isValidToken').mockReturnValue(false);
      const getTokenSpy = jest.spyOn(AuthUtils, 'getToken').mockReturnValue(invalidToken);
      const redirectSpy = jest.spyOn(AuthUtils, 'redirectToLogin').mockImplementation(() => {});
      const clearAuthSpy = jest.spyOn(AuthUtils, 'clearAuth').mockImplementation(() => {});

      // Call the function under test
      const result = AuthUtils.handleTokenExpiration();

      // Verify behavior
      expect(getTokenSpy).toHaveBeenCalled();
      expect(isValidTokenSpy).toHaveBeenCalledWith(invalidToken);
      expect(clearAuthSpy).toHaveBeenCalled();
      expect(redirectSpy).toHaveBeenCalled();
      expect(result).toBe(false);

      // Clean up
      isValidTokenSpy.mockRestore();
      getTokenSpy.mockRestore();
      redirectSpy.mockRestore();
      clearAuthSpy.mockRestore();
    });

    test('should not redirect if on login page with invalid token', () => {
      const invalidToken = 'invalid.token';

      // Set up mocks
      locationMock.pathname = AuthUtils.LOGIN_PAGE; // On login page
      const isValidTokenSpy = jest.spyOn(AuthUtils, 'isValidToken').mockReturnValue(false);
      const getTokenSpy = jest.spyOn(AuthUtils, 'getToken').mockReturnValue(invalidToken);
      const redirectSpy = jest.spyOn(AuthUtils, 'redirectToLogin').mockImplementation(() => {});
      const clearAuthSpy = jest.spyOn(AuthUtils, 'clearAuth').mockImplementation(() => {});

      // Call the function under test
      const result = AuthUtils.handleTokenExpiration();

      // Verify behavior
      expect(getTokenSpy).toHaveBeenCalled();
      expect(isValidTokenSpy).toHaveBeenCalledWith(invalidToken);
      expect(clearAuthSpy).toHaveBeenCalled(); // Still clear auth
      expect(redirectSpy).not.toHaveBeenCalled(); // But don't redirect
      expect(result).toBe(false);

      // Clean up
      isValidTokenSpy.mockRestore();
      getTokenSpy.mockRestore();
      redirectSpy.mockRestore();
      clearAuthSpy.mockRestore();
    });

    test('should return false for no token', () => {
      // Set up mocks
      locationMock.pathname = '/'; // Not on login page
      const getTokenSpy = jest.spyOn(AuthUtils, 'getToken').mockReturnValue(null);
      const isValidTokenSpy = jest.spyOn(AuthUtils, 'isValidToken').mockReturnValue(false);
      // Spy on methods we want to verify aren't called
      const clearAuthSpy = jest.spyOn(AuthUtils, 'clearAuth').mockImplementation(() => {});
      const redirectSpy = jest.spyOn(AuthUtils, 'redirectToLogin').mockImplementation(() => {});

      // Call the function under test
      const result = AuthUtils.handleTokenExpiration();

      // Verify behavior
      expect(getTokenSpy).toHaveBeenCalled();
      expect(isValidTokenSpy).toHaveBeenCalledWith(null);
      expect(clearAuthSpy).not.toHaveBeenCalled(); // No token, nothing to clear
      // Redirect IS expected with no token when not on login page
      expect(redirectSpy).toHaveBeenCalled(); 
      expect(result).toBe(false); // No token means not authenticated

      // Clean up
      isValidTokenSpy.mockRestore();
      getTokenSpy.mockRestore();
      clearAuthSpy.mockRestore();
      redirectSpy.mockRestore();
    });
  });
});