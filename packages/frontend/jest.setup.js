import '@testing-library/jest-dom';
import 'jest-localstorage-mock';
import fetchMock from 'jest-fetch-mock';

// Setup fetch mock
fetchMock.enableMocks();

// Create a complete localStorage mock with all required methods
const mockLocalStorage = {
  store: {},
  getItem: jest.fn((key) => mockLocalStorage.store[key] || null),
  setItem: jest.fn((key, value) => {
    mockLocalStorage.store[key] = value?.toString();
  }),
  removeItem: jest.fn((key) => {
    delete mockLocalStorage.store[key];
  }),
  clear: jest.fn(() => {
    mockLocalStorage.store = {};
  }),
};

// Replace the window.localStorage with our mock
Object.defineProperty(window, 'localStorage', {
  value: mockLocalStorage,
  writable: true,
});

// Create a proper location mock with a valid base URL
const locationMock = {
  href: 'http://localhost/',
  origin: 'http://localhost',
  pathname: '/',
  search: '',
  hash: '',
  replace: jest.fn(),
  assign: jest.fn(),
  reload: jest.fn(),
};

// Replace the window.location with our mock
Object.defineProperty(window, 'location', {
  value: locationMock,
  writable: true,
  configurable: true,
});

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
