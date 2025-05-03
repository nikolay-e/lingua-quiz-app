/**
 * Standard mock for the AuthUtils module.
 * This should be used across all tests that need to mock authentication functionality.
 */

// Constants that match the real implementation
const TOKEN_KEY = 'token';
const EMAIL_KEY = 'email';
const TOKEN_EXPIRATION_KEY = 'tokenExpiration';
const LOGIN_PAGE = '/login.html';
const AUTH_CHECK_INTERVAL = 60000; // 1 minute

// Create mock functions with mockName for better error messages
const getToken = jest.fn().mockName('AuthUtils.getToken');
const setToken = jest.fn().mockName('AuthUtils.setToken');
const setEmail = jest.fn().mockName('AuthUtils.setEmail');
const clearAuth = jest.fn().mockName('AuthUtils.clearAuth');
const isValidToken = jest.fn().mockName('AuthUtils.isValidToken');
const redirectToLogin = jest.fn().mockName('AuthUtils.redirectToLogin');
const shouldRedirectToLogin = jest.fn().mockName('AuthUtils.shouldRedirectToLogin');
const initAuthCheck = jest.fn().mockName('AuthUtils.initAuthCheck');
const handleTokenExpiration = jest.fn().mockName('AuthUtils.handleTokenExpiration');

// Export the AuthUtils object that matches the real implementation's interface
export const AuthUtils = {
  // Constants
  TOKEN_KEY,
  EMAIL_KEY,
  TOKEN_EXPIRATION_KEY,
  LOGIN_PAGE,
  AUTH_CHECK_INTERVAL,
  
  // Functions
  getToken,
  setToken,
  setEmail,
  clearAuth,
  isValidToken,
  redirectToLogin,
  shouldRedirectToLogin,
  initAuthCheck,
  handleTokenExpiration,
  
  // Helper to reset all mocks between tests
  _reset() {
    getToken.mockClear();
    setToken.mockClear();
    setEmail.mockClear();
    clearAuth.mockClear();
    isValidToken.mockClear();
    redirectToLogin.mockClear();
    shouldRedirectToLogin.mockClear();
    initAuthCheck.mockClear();
    handleTokenExpiration.mockClear();
  }
};

// Default mock implementations
AuthUtils.getToken.mockImplementation(() => {
  return localStorage.getItem(TOKEN_KEY);
});

AuthUtils.setToken.mockImplementation((token) => {
  localStorage.setItem(TOKEN_KEY, token);
  try {
    // Simulate JWT decoding
    const parts = token.split('.');
    if (parts.length === 3) {
      const payload = JSON.parse(atob(parts[1]));
      if (payload.exp) {
        localStorage.setItem(TOKEN_EXPIRATION_KEY, payload.exp * 1000);
      }
    }
  } catch (e) {
    console.error('[MOCK] Error decoding token:', e);
  }
});

AuthUtils.setEmail.mockImplementation((email) => {
  localStorage.setItem(EMAIL_KEY, email);
});

AuthUtils.clearAuth.mockImplementation(() => {
  localStorage.removeItem(TOKEN_KEY);
  localStorage.removeItem(EMAIL_KEY);
  localStorage.removeItem(TOKEN_EXPIRATION_KEY);
});

AuthUtils.isValidToken.mockImplementation((token) => {
  if (!token) return false;
  
  try {
    // Simple token validation (assuming JWT format)
    const parts = token.split('.');
    if (parts.length !== 3) return false;
    
    // Check expiration if it exists
    const payload = JSON.parse(atob(parts[1]));
    if (!payload.exp) return false;
    
    // Check if token is expired (with 60s buffer)
    const now = Math.floor(Date.now() / 1000);
    return payload.exp > (now + 60);
  } catch (e) {
    return false;
  }
});

AuthUtils.redirectToLogin.mockImplementation(() => {
  if (window.location.pathname === LOGIN_PAGE) {
    console.log('[MOCK] Already on login page, not redirecting');
    return;
  }
  console.log('[MOCK] Redirecting to login');
  window.location.href = LOGIN_PAGE;
});

AuthUtils.shouldRedirectToLogin.mockImplementation(() => {
  return window.location.pathname !== LOGIN_PAGE && !AuthUtils.isValidToken(AuthUtils.getToken());
});

AuthUtils.handleTokenExpiration.mockImplementation(() => {
  const token = AuthUtils.getToken();
  const isValid = AuthUtils.isValidToken(token);
  
  if (!isValid && token) {
    // Clear auth if token exists but is invalid
    AuthUtils.clearAuth();
  }
  
  // Only redirect if not on login page and not authenticated
  if (!isValid && window.location.pathname !== LOGIN_PAGE) {
    AuthUtils.redirectToLogin();
  }
  
  return isValid;
});

AuthUtils.initAuthCheck.mockImplementation(() => {
  // Initial check
  const isAuthenticated = AuthUtils.handleTokenExpiration();
  if (!isAuthenticated) return null;
  
  // Set up interval
  return setInterval(() => {
    AuthUtils.handleTokenExpiration();
  }, AUTH_CHECK_INTERVAL);
});