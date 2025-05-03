/**
 * Jest configuration for frontend package
 */
// eslint-disable-next-line strict
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
    '<rootDir>/tests/component/**/*.test.js',
  ],
  resetMocks: false, // This is important for localStorage mock to work
  clearMocks: true,
  // Automatically restore mock state between every test
  restoreMocks: true,

  // Configure specific test types
  projects: [
    {
      displayName: 'unit',
      testEnvironment: 'jsdom',
      testMatch: ['<rootDir>/tests/unit/**/*.test.js'],
      setupFilesAfterEnv: ['<rootDir>/tests/__mocks__/jestSetup.js'],
    },
    {
      displayName: 'integration',
      testEnvironment: 'jsdom',
      testMatch: ['<rootDir>/tests/integration/**/*.test.js'],
      setupFilesAfterEnv: ['<rootDir>/tests/__mocks__/jestSetup.js'],
    },
    {
      displayName: 'component',
      testEnvironment: 'jsdom',
      testMatch: ['<rootDir>/tests/component/**/*.test.js'],
      setupFilesAfterEnv: [
        '<rootDir>/tests/__mocks__/jestSetup.js',
        '<rootDir>/tests/__mocks__/componentTestSetup.js',
      ],
      globalSetup: '<rootDir>/tests/__mocks__/globalSetup.cjs',
      globalTeardown: '<rootDir>/tests/__mocks__/globalTeardown.cjs',
    },
  ],
};
