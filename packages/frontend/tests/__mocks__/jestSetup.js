/**
 * Global Jest setup file for all tests
 * This file imports necessary test libraries and sets up global mocks
 */
import '@testing-library/jest-dom';
import 'jest-localstorage-mock';
import fetchMock from 'jest-fetch-mock';

// Import our centralized mock utilities
import { 
  setupLocalStorageMock, 
  setupLocationMock, 
  suppressConsoleOutput,
  setupFetchMock
} from './browserMocks.js';

// Enable fetch mocks globally
fetchMock.enableMocks();

// Set up the essential mocks for all tests
const mockLocalStorage = setupLocalStorageMock();
const { locationMock } = setupLocationMock();

// Optional: globally suppress console output for cleaner test output
// Uncomment if needed
// const consoleSuppress = suppressConsoleOutput();

// Reset all mocks before each test
beforeEach(() => {
  jest.clearAllMocks();
  mockLocalStorage.clear();
  fetchMock.resetMocks();
  locationMock.href = 'http://localhost/';
  locationMock.pathname = '/';
  locationMock.replace.mockClear();
  locationMock.assign.mockClear();
  locationMock.reload.mockClear();
});

// Cleanup after each test
afterEach(() => {
  mockLocalStorage.clear();
  jest.clearAllMocks();
});