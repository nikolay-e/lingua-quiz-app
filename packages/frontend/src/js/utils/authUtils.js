import jwtDecode from 'jwt-decode';

import { errorHandler } from './errorHandler.js';

// eslint-disable-next-line import/prefer-default-export
export class AuthUtils {
  static TOKEN_KEY = 'token';

  static EMAIL_KEY = 'email';

  static TOKEN_EXPIRATION_KEY = 'tokenExpiration';

  static LOGIN_PAGE = '/login.html';

  static AUTH_CHECK_INTERVAL = 60000; // 60 seconds

  static isValidToken(token) {
    if (!token) return false;

    try {
      const decoded = jwtDecode(token);
      const currentTime = Date.now() / 1000;

      if (!decoded.exp || decoded.exp <= currentTime + 60) {
        this.clearAuth();
        return false;
      }

      return true;
    } catch (error) {
      this.clearAuth();
      return false;
    }
  }

  static getToken() {
    return localStorage.getItem(this.TOKEN_KEY);
  }

  static setToken(token) {
    try {
      const decoded = jwtDecode(token);
      localStorage.setItem(this.TOKEN_KEY, token);
      localStorage.setItem(this.TOKEN_EXPIRATION_KEY, decoded.exp * 1000);
    } catch (error) {
      errorHandler.handleApiError(error);
      this.clearAuth();
    }
  }

  static setEmail(email) {
    localStorage.setItem(this.EMAIL_KEY, email);
  }

  static clearAuth() {
    localStorage.removeItem(this.TOKEN_KEY);
    localStorage.removeItem(this.EMAIL_KEY);
    localStorage.removeItem(this.TOKEN_EXPIRATION_KEY);
  }

  static shouldRedirectToLogin() {
    const currentPath = window.location.pathname;
    return !currentPath.endsWith(this.LOGIN_PAGE) && !this.isValidToken(this.getToken());
  }

  static redirectToLogin() {
    if (!window.location.pathname.endsWith(this.LOGIN_PAGE)) {
      window.location.href = this.LOGIN_PAGE;
    }
  }

  static initAuthCheck() {
    // Use custom interval if set (for testing purposes)
    // eslint-disable-next-line no-underscore-dangle
    const interval = window._authCheckInterval || this.AUTH_CHECK_INTERVAL;

    const checkInterval = setInterval(() => {
      if (this.shouldRedirectToLogin()) {
        this.redirectToLogin();
        clearInterval(checkInterval);
      }
    }, interval);

    // Immediate check on init
    if (this.shouldRedirectToLogin()) {
      this.redirectToLogin();
    }

    // Add listener for 401 errors
    window.addEventListener('unhandledrejection', (event) => {
      if (event.reason?.response?.status === 401) {
        this.clearAuth();
        this.redirectToLogin();
      }
    });

    return checkInterval;
  }
}
