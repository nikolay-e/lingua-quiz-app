module.exports = {
  testTimeout: 30_000,
  transform: {
    '^.+\\.js$': 'babel-jest',
  },
  transformIgnorePatterns: ['/node_modules/(?!chai)'],
  // Only use globalSetup/teardown for integration and e2e tests, not unit tests
  testEnvironment: 'node',
  setupFilesAfterEnv: ['<rootDir>/jest.setup.js'],
};
