/**
 * Jest configuration for frontend package
 */
module.exports = {
  testEnvironment: 'jsdom',
  transform: {
    '^.+\\.js$': 'babel-jest',
  },
  moduleNameMapper: {
    // Map for consistent imports
    '^@/(.*)$': '<rootDir>/src/$1',
  },
  // The individual setup files are now imported in integrationTestSetup.js and unitTestSetup.js
  // No need to use jest-localstorage-mock directly anymore
  setupFiles: [],
  // Using our own setup file instead
  setupFilesAfterEnv: ['<rootDir>/tests/__mocks__/jestSetup.js'],
  testEnvironmentOptions: {
    url: 'http://localhost/',
  },
  // The test directory structure
  testMatch: [
    '<rootDir>/tests/unit/**/*.test.js',
    '<rootDir>/tests/integration/**/*.test.js',
    '<rootDir>/tests/e2e-jest/**/*.test.js',
  ],
  resetMocks: false, // This is important for localStorage mock to work
  clearMocks: true,
  // Automatically restore mock state between every test
  restoreMocks: true,
};
