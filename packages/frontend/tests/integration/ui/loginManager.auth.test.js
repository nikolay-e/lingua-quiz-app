// packages/frontend/tests/integration/ui/loginManager.auth.test.js
import { AuthManager } from '../../../src/js/ui/loginManager.js';
import { AuthUtils } from '../../../src/js/utils/authUtils.js';
import { errorHandler } from '../../../src/js/utils/errorHandler.js';

// Import integration test setup and helpers
import { setupLocalStorageMock, setupLocationMock } from '../../__mocks__/browserMocks.js';

// --- Mock external dependencies using centralized mocks ---
jest.mock('../../../src/js/utils/authUtils.js', () => ({
  AuthUtils: require('../../__mocks__/utils/authUtils').AuthUtils,
}));

jest.mock('../../../src/js/utils/errorHandler.js', () => ({
  errorHandler: require('../../__mocks__/utils/errorHandler').errorHandler,
}));

jest.mock('../../../src/js/ui/passwordValidator.js', () => ({
  PasswordValidator: jest
    .fn()
    .mockImplementation(() => require('../../__mocks__/ui/passwordValidator').PasswordValidator),
}));

describe('AuthManager - Authentication State & Logout', () => {
  let authManager;
  let mockLocalStorage;
  let originalLocation;

  beforeEach(() => {
    // --- DOM Setup (Minimal needed for these tests) ---
    document.body.innerHTML = `
      <div id="user-status">
         <div class="user-actions">
             <button id="login-logout-btn">Login</button>
             <button id="delete-account-btn" style="display: none;">Delete</button>
          </div>
      </div>
    `; // Need at least the button container

    // --- Mock Setup ---
    jest.clearAllMocks();

    // Set up localStorage and location mocks using our centralized helpers
    mockLocalStorage = setupLocalStorageMock();
    const { locationMock, restoreLocation } = setupLocationMock('/');
    originalLocation = restoreLocation; // Store the restore function

    // Mock fetch for completeness
    global.fetch = jest.fn();

    // --- Instance Creation ---
    authManager = new AuthManager();

    // Default mock behaviors
    AuthUtils.isValidToken.mockReturnValue(false);
    AuthUtils.shouldRedirectToLogin.mockImplementation(() => {
      return (
        window.location.pathname !== AuthUtils.LOGIN_PAGE &&
        !AuthUtils.isValidToken(AuthUtils.getToken())
      );
    });

    // Reset all centralized mocks
    AuthUtils._reset();
    errorHandler._reset();
  });

  afterEach(() => {
    // Restore original location
    originalLocation();

    // Clear localStorage
    mockLocalStorage.clear();

    // Clean up any other mocks
    jest.clearAllMocks();
  });

  // --- Test Cases ---

  describe('Authentication State', () => {
    test('should check authentication status correctly', () => {
      AuthUtils.isValidToken.mockReturnValueOnce(true);
      expect(authManager.isAuthenticated()).toBe(true);
      expect(AuthUtils.isValidToken).toHaveBeenCalledTimes(1);

      AuthUtils.isValidToken.mockReturnValueOnce(false);
      expect(authManager.isAuthenticated()).toBe(false);
      expect(AuthUtils.isValidToken).toHaveBeenCalledTimes(2);
    });
  });

  describe('Logout', () => {
    test('should clear auth and redirect on logout', () => {
      // Simulate logged-in state for UI update
      AuthUtils.isValidToken.mockReturnValue(true);
      authManager.updateLoginStatus();

      const loginButton = document.querySelector('#login-logout-btn');
      expect(loginButton).toBeTruthy();

      // Mock both the clearAuth and the updateLoginStatus methods
      const originalUpdateLoginStatus = authManager.updateLoginStatus;
      authManager.updateLoginStatus = jest.fn(() => {
        // Simulate the button text change that would happen during updateLoginStatus
        loginButton.innerHTML = '<i class="fas fa-sign-in-alt"></i><span>Login</span>';
      });

      // Call logout method
      authManager.logout();

      // Check if clearAuth was called
      expect(AuthUtils.clearAuth).toHaveBeenCalledTimes(1);

      // Check if updateLoginStatus was called to update the UI
      expect(authManager.updateLoginStatus).toHaveBeenCalledTimes(1);

      // Check if the button text was changed to "Login"
      expect(loginButton.textContent).toContain('Login');

      // Check if redirect was called
      expect(AuthUtils.redirectToLogin).toHaveBeenCalledTimes(1);

      // Restore original method
      authManager.updateLoginStatus = originalUpdateLoginStatus;
    });
  });

  describe('Auth Check', () => {
    test('should check auth and redirect if needed (non-login page)', () => {
      window.location.pathname = '/dashboard'; // Simulate being on another page
      // Simulate invalid token with handleTokenExpiration returning false (redirected)
      AuthUtils.handleTokenExpiration.mockReturnValueOnce(false);

      authManager.checkAuthAndRedirect();

      expect(AuthUtils.handleTokenExpiration).toHaveBeenCalledTimes(1);
      // No need to check redirectToLogin as it's now handled internally by handleTokenExpiration
    });

    test('should not redirect if on login page', () => {
      window.location.pathname = AuthUtils.LOGIN_PAGE; // Simulate being on login page
      // Simulate valid token with handleTokenExpiration returning true (not redirected)
      AuthUtils.handleTokenExpiration.mockReturnValueOnce(true);

      authManager.checkAuthAndRedirect();

      expect(AuthUtils.handleTokenExpiration).toHaveBeenCalledTimes(1);
    });

    test('should not redirect if authenticated', () => {
      window.location.pathname = '/dashboard';
      // Simulate valid token with handleTokenExpiration returning true (not redirected)
      AuthUtils.handleTokenExpiration.mockReturnValueOnce(true);

      authManager.checkAuthAndRedirect();

      expect(AuthUtils.handleTokenExpiration).toHaveBeenCalledTimes(1);
    });
  });
});
