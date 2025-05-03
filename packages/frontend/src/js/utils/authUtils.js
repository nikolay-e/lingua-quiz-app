// src/js/utils/authUtils.js
import jwtDecode from 'jwt-decode';

import { errorHandler } from './errorHandler.js';

// Export as an object literal
export const AuthUtils = {
  TOKEN_KEY: 'token',
  EMAIL_KEY: 'email',
  TOKEN_EXPIRATION_KEY: 'tokenExpiration',
  LOGIN_PAGE: '/login.html', // Absolute path for consistency in all redirects
  AUTH_CHECK_INTERVAL: 60_000, // 60 seconds

  isValidToken(token) {
    if (!token) return false;
    try {
      const decoded = jwtDecode(token);
      const currentTime = Date.now() / 1000;

      // Expired or expires within 60 seconds buffer
      // Only check validity, don't clear auth here
      if (!decoded || !decoded.exp || decoded.exp <= currentTime + 60) {
        return false;
      }
      return true;
    } catch {
      return false;
    }
  },

  // New method to handle token expiration with proper encapsulation
  handleTokenExpiration() {
    const token = AuthUtils.getToken();
    const isValid = AuthUtils.isValidToken(token);

    // If no token or token is invalid, we need to take action
    if (!isValid) {
      // Clear auth data if token exists but is invalid
      if (token) {
        AuthUtils.clearAuth();
      }
      
      // Only redirect if not already on login page
      if (!window.location.pathname.includes(AuthUtils.LOGIN_PAGE.substring(1))) {
        AuthUtils.redirectToLogin();
        return false;
      }
    }

    return isValid;
  },

  getToken() {
    return localStorage.getItem(AuthUtils.TOKEN_KEY); // Use AuthUtils.
  },

  setToken(token) {
    try {
      const decoded = jwtDecode(token);
      localStorage.setItem(AuthUtils.TOKEN_KEY, token); // Use AuthUtils.
      localStorage.setItem(AuthUtils.TOKEN_EXPIRATION_KEY, decoded.exp * 1000); // Use AuthUtils.
    } catch (error) {
      errorHandler.handleApiError(error);
      AuthUtils.clearAuth(); // Use AuthUtils.
    }
  },

  setEmail(email) {
    localStorage.setItem(AuthUtils.EMAIL_KEY, email); // Use AuthUtils.
  },

  clearAuth() {
    localStorage.removeItem(AuthUtils.TOKEN_KEY); // Use AuthUtils.
    localStorage.removeItem(AuthUtils.EMAIL_KEY); // Use AuthUtils.
    localStorage.removeItem(AuthUtils.TOKEN_EXPIRATION_KEY); // Use AuthUtils.
  },

  shouldRedirectToLogin() {
    const currentPath = window.location.pathname;
    // Only check if token is valid - don't perform side effects
    // This method is only used for the decision, actual redirection is done elsewhere
    return (
      !currentPath.includes(AuthUtils.LOGIN_PAGE.substring(1)) && !AuthUtils.isValidToken(AuthUtils.getToken())
    );
  },

  redirectToLogin() {
    // Log debugging info
    console.log(
      `Redirecting to login. Current: ${window.location.pathname}, Login page: ${AuthUtils.LOGIN_PAGE}`
    );

    // Only redirect if not already on login page
    if (!window.location.pathname.includes(AuthUtils.LOGIN_PAGE.substring(1))) {
      // Force redirect to login page and replace current history entry
      console.log(`Executing redirect to: ${AuthUtils.LOGIN_PAGE}`);
      // Use replace to avoid adding to browser history
      window.location.replace(AuthUtils.LOGIN_PAGE);
    } else {
      console.log('Already on login page, not redirecting');
    }
  },

  // Handle authentication verification with race condition protection
  initAuthCheck() {
    // First verify immediately using our encapsulated method
    // This handles validation, clearing tokens, and redirecting if needed
    const isAuthenticated = AuthUtils.handleTokenExpiration();

    // If handleTokenExpiration returns false and already handled redirection
    if (isAuthenticated === false) {
      return null; // Don't set up interval if already redirected
    }

    // Set up interval for continuous checking
    const interval = window._authCheckInterval || AuthUtils.AUTH_CHECK_INTERVAL;
    const checkInterval = setInterval(() => {
      // Use the encapsulated method that handles validation, clearing and redirection
      const isStillAuthenticated = AuthUtils.handleTokenExpiration();

      // If token became invalid and we were redirected, stop interval
      if (isStillAuthenticated === false) {
        clearInterval(checkInterval);
      }
    }, interval);

    return checkInterval;
  },
};
