// packages/e2e-tests/utils/timeouts.js

/**
 * Timeouts for tests - reduced for faster testing
 */
export const TIMEOUTS = {
  // Standard timeouts
  SHORT: 500, // 0.5 second - for quick operations that should be almost immediate
  MEDIUM: 1000, // 1 second - for regular UI operations
  LONG: 3000, // 3 seconds - for network-dependent operations
  EXTRA_LONG: 5000, // 5 seconds - for very slow operations (like data downloads)

  // Authentication specific timeouts
  REGISTRATION_FORM_VISIBLE: 1000, // Time to wait for registration form to be visible
  LOGIN_FORM_VISIBLE: 1000, // Time to wait for login form to be visible
  REGISTRATION_SUCCESS: 3000, // Time to wait for successful registration message
  LOGIN_REDIRECT: 3000, // Time to wait for redirect after login
  ERROR_MESSAGE_VISIBLE: 1000, // Time to wait for error message to be visible
  TEST_TIMEOUT: 30_000, // Default test timeout (30 seconds)

  // API response timeouts
  API_RESPONSE: 3000, // Time to wait for API response
  SERVER_ERROR_RESPONSE: 1000, // Time to wait for server error response
};
