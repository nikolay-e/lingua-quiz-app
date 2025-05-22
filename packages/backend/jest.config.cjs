// For a detailed explanation regarding each configuration property, visit:
// https://jestjs.io/docs/configuration
/** @type {import('jest').Config} */
const config = {
  testTimeout: 30000,
  testEnvironment: 'node',
  testMatch: ['**/tests/**/*.test.js'],
  moduleNameMapper: {
    '^(\\.{1,2}/.*)\\.js$': '$1',
  },
  transform: {
    '^.+\\.jsx?$': 'babel-jest',
  },
  transformIgnorePatterns: ['/node_modules/(?!chai)'],
  globalSetup: './tests/globalSetup.js',
  globalTeardown: './tests/globalTeardown.js',
};

module.exports = config;
