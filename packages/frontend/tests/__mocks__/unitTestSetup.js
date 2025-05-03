/**
 * Centralized setup for unit tests
 * This provides common mocks with simpler configuration for isolated unit tests.
 */
import { errorHandler } from './utils/errorHandler.js';
import { setupLocalStorageMock, setupLocationMock, suppressConsoleOutput } from './browserMocks.js';
import jwt_decode from 'jwt-decode';

// Mock jwt-decode for token validation
jest.mock('jwt-decode', () => jest.fn());

// Export basic mocks for unit tests
export { errorHandler };
export const mockJwtDecode = jwt_decode;

// Setup helpers for unit tests
export { 
  setupLocalStorageMock, 
  setupLocationMock, 
  suppressConsoleOutput 
};

// Re-export fixture data
export { 
  getTestWordPairs,
  testWordLists,
  createMockToken,
  createExpiredToken,
  setupAuthState,
  apiResponses,
  setupAuthTestDOM
} from '../__fixtures__/testData';

/**
 * Creates basic errorHandler mock.
 * Simpler version than the full mock for faster unit testing.
 */
export function mockErrorHandler() {
  return {
    handleApiError: jest.fn(),
    showError: jest.fn(),
    init: jest.fn()
  };
}

/**
 * Creates basic authUtils mock.
 * Simpler version than the full mock for faster unit testing.
 */
export function mockAuthUtils() {
  return {
    TOKEN_KEY: 'token',
    EMAIL_KEY: 'email',
    TOKEN_EXPIRATION_KEY: 'tokenExpiration',
    LOGIN_PAGE: '/login.html',
    getToken: jest.fn(),
    setToken: jest.fn(),
    setEmail: jest.fn(),
    clearAuth: jest.fn(),
    isValidToken: jest.fn(),
    redirectToLogin: jest.fn(),
    shouldRedirectToLogin: jest.fn(),
    initAuthCheck: jest.fn(),
    handleTokenExpiration: jest.fn()
  };
}