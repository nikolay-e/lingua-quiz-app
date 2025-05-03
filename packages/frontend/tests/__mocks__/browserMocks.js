/**
 * Centralized browser mocks for consistent test setup
 * This file provides standardized mocks for browser APIs like localStorage and location.
 */

/**
 * Sets up a consistent mock for localStorage
 * Use this instead of directly mocking window.localStorage
 */
export function setupLocalStorageMock() {
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
  
  return mockLocalStorage;
}

/**
 * Sets up a consistent mock for window.location
 * Use this instead of directly mocking window.location
 */
export function setupLocationMock(initialPath = '/') {
  // Store original location
  const originalLocation = window.location;
  
  // Create location mock
  const locationMock = {
    href: `http://localhost${initialPath}`,
    origin: 'http://localhost',
    pathname: initialPath,
    search: '',
    hash: '',
    replace: jest.fn((url) => {
      if (url.startsWith('http')) {
        locationMock.href = url;
        const urlObj = new URL(url);
        locationMock.pathname = urlObj.pathname;
      } else if (url.startsWith('/')) {
        locationMock.pathname = url;
        locationMock.href = `http://localhost${url}`;
      } else {
        locationMock.href = url;
      }
    }),
    assign: jest.fn((url) => {
      locationMock.replace(url);
    }),
    reload: jest.fn(),
  };
  
  // Replace window.location with our mock
  delete window.location;
  window.location = locationMock;
  
  // Return both the mock and a restore function
  return {
    locationMock,
    restoreLocation: () => {
      window.location = originalLocation;
    }
  };
}

/**
 * Sets up a consistent mock for fetch
 * Use this instead of directly mocking global.fetch
 */
export function setupFetchMock() {
  const originalFetch = global.fetch;
  
  // Create fetch mock
  const fetchMock = jest.fn();
  global.fetch = fetchMock;
  
  // Return both the mock and a restore function
  return {
    fetchMock,
    restoreFetch: () => {
      global.fetch = originalFetch;
    }
  };
}

/**
 * Suppress console output during tests
 * @returns {Object} Object with restoreConsole function to restore original behavior
 */
export function suppressConsoleOutput() {
  const originalConsole = {
    log: console.log,
    error: console.error,
    warn: console.warn,
    debug: console.debug,
    info: console.info,
  };
  
  // Mock all console methods
  console.log = jest.fn();
  console.error = jest.fn();
  console.warn = jest.fn();
  console.debug = jest.fn();
  console.info = jest.fn();
  
  // Return function to restore original console
  return {
    restoreConsole: () => {
      console.log = originalConsole.log;
      console.error = originalConsole.error;
      console.warn = originalConsole.warn;
      console.debug = originalConsole.debug;
      console.info = originalConsole.info;
    }
  };
}