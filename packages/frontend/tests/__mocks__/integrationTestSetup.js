/*
 * LinguaQuiz – Copyright © 2025 Nikolay Eremeev
 *
 * Dual-licensed:
 *  – Non-Commercial Source-Available v2  →  see LICENSE-NONCOMMERCIAL.md
 *  – Commercial License v2              →  see LICENSE-COMMERCIAL.md
 *
 * Contact: lingua-quiz@nikolay-eremeev.com
 * Repository: https://github.com/nikolay-e/lingua-quiz
 */

/**
 * Centralized setup for integration tests
 * This replaces the individual setup files previously used in integration tests.
 */
import '@testing-library/jest-dom';
import 'jest-localstorage-mock';
import fetchMock from 'jest-fetch-mock';

import { setupLocalStorageMock, setupLocationMock } from './browserMocks';
import { AuthUtils } from './utils/authUtils';
import { errorHandler } from './utils/errorHandler';

// Auto-mock frequently mocked modules
jest.mock('../../src/js/utils/errorHandler.js', () => {
  return {
    errorHandler: require('./utils/errorHandler').errorHandler,
  };
});

jest.mock('../../src/js/utils/authUtils.js', () => {
  return {
    AuthUtils: require('./utils/authUtils').AuthUtils,
  };
});

jest.mock('../../src/js/ui/passwordValidator.js', () => {
  const { PasswordValidator } = require('./ui/passwordValidator');
  return {
    PasswordValidator: jest.fn().mockImplementation(() => new PasswordValidator()),
  };
});

// Mock config for consistent behavior
jest.mock('../../src/js/config.js', () => ({
  __esModule: true,
  default: 'http://localhost:9000',
}));

// Mock jwt-decode - we're using a dedicated mock file at tests/__mocks__/jwt-decode.js
jest.mock('jwt-decode');

// Enable fetch mocks
fetchMock.enableMocks();

// Before each test
beforeEach(() => {
  // Reset mocks
  jest.clearAllMocks();
  localStorage.clear();
  fetchMock.resetMocks();

  // Set up basic mocks
  const mockLocalStorage = setupLocalStorageMock();
  const { locationMock } = setupLocationMock();

  // Reset custom mock helpers
  errorHandler._reset();
  AuthUtils._reset();
});

// Cleanup after each test
afterEach(() => {
  localStorage.clear();
  jest.clearAllMocks();
});

// Exports for test files

// Export utilities from fixture data
export {
  getTestWordPairs,
  testWordLists,
  createMockToken,
  createExpiredToken,
  setupAuthState,
  apiResponses,
  setupAuthTestDOM,
} from '../__fixtures__/testData';
export { suppressConsoleOutput, setupLocalStorageMock, setupLocationMock } from './browserMocks';
export { errorHandler } from './utils/errorHandler';
export { AuthUtils } from './utils/authUtils';
export { default as fetchMock } from 'jest-fetch-mock';
