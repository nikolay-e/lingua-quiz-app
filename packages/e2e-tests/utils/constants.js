// packages/e2e-tests/utils/constants.js

/**
 * Constants for quiz tests - reduced for faster testing
 */
export const QUIZ_CONSTANTS = {
  // Retry configuration
  MAX_SUBMIT_RETRIES: 1,
  RETRY_DELAY_MS: 50,

  // Timeout values in milliseconds
  WAIT_FOR_ELEMENT_TIMEOUT: 5000, // Increased from 3s to 5s
  WAIT_FOR_LIST_TIMEOUT: 10_000, // Increased from 5s to 10s
  TEST_TIMEOUT_MS: 90_000, // Increased from 60s to 90s per quiz

  // Error handling
  MAX_CONSECUTIVE_ERRORS_BEFORE_FAIL: 3,

  // List refresh interval (in question count)
  FULL_LIST_REFRESH_INTERVAL: 10,
};

/**
 * Constants for login/authentication tests - reduced for faster testing
 */
export const AUTH_CONSTANTS = {
  // Time to wait after login/logout
  POST_LOGIN_WAIT_MS: 300,
  POST_LOGOUT_WAIT_MS: 300,

  // Default user credentials for tests
  DEFAULT_PASSWORD: 'TestPassword123!',

  // Account deletion confirmation
  DELETION_DIALOG_TIMEOUT_MS: 1000,
};
