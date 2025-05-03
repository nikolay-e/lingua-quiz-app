/**
 * Centralized setup for integration tests
 * This replaces the individual setup files previously used in integration tests.
 */
import '@testing-library/jest-dom';
import 'jest-localstorage-mock';
import fetchMock from 'jest-fetch-mock';
import jwt_decode from 'jwt-decode';
import { setupLocalStorageMock, setupLocationMock, suppressConsoleOutput } from './browserMocks';
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

// Mock jwt-decode
jest.mock('jwt-decode', () => jest.fn());

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
  
  // Set default jwt-decode behavior
  jwt_decode.mockImplementation((token) => {
    if (token && token.split('.').length === 3) {
      return JSON.parse(atob(token.split('.')[1]));
    }
    throw new Error('Invalid token');
  });
  
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
export { errorHandler, AuthUtils, fetchMock };
export { setupLocalStorageMock, setupLocationMock, suppressConsoleOutput };

// Export utilities from fixture data
export { 
  getTestWordPairs,
  testWordLists,
  createMockToken,
  createExpiredToken,
  setupAuthState,
  apiResponses,
  setupAuthTestDOM
} from '../__fixtures__/testData';