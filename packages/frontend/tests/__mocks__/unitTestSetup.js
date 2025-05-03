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
 * Centralized setup for unit tests
 * This provides common mocks with simpler configuration for isolated unit tests.
 */

// Mock jwt-decode for token validation
jest.mock('jwt-decode', () => jest.fn());

// Export basic mocks for unit tests

// Setup helpers for unit tests

// Re-export fixture data
export {
  getTestWordPairs,
  testWordLists,
  createMockToken,
  createExpiredToken,
  setupAuthState,
  apiResponses,
  setupAuthTestDOM,
} from '../__fixtures__/testData';

/**
 * Creates basic errorHandler mock.
 * Simpler version than the full mock for faster unit testing.
 */
export function mockErrorHandler() {
  return {
    handleApiError: jest.fn(),
    showError: jest.fn(),
    init: jest.fn(),
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
    handleTokenExpiration: jest.fn(),
  };
}
export { default as mockJwtDecode } from 'jwt-decode';
export { setupLocalStorageMock, setupLocationMock, suppressConsoleOutput } from './browserMocks.js';
export { errorHandler } from './utils/errorHandler.js';
