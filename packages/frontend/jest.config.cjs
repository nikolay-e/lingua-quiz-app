module.exports = {
  testEnvironment: 'jsdom',
  transform: {
    '^.+\\.js$': 'babel-jest',
  },
  moduleNameMapper: {},
  setupFiles: ['<rootDir>/jest.setup.js'],
};
