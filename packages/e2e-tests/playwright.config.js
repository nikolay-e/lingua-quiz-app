// eslint-disable-next-line import/no-extraneous-dependencies
const { defineConfig } = require('@playwright/test');

module.exports = defineConfig({
  testDir: './tests',
  timeout: 30 * 1000,
  expect: {
    timeout: 5000,
  },
  use: {
    baseURL: process.env.LINGUA_QUIZ_URL || 'https://test-lingua-quiz.nikolay-eremeev.com/',
    trace: 'on-first-retry',
    screenshot: 'on',
    video: 'on-first-retry',
  },
  reporter: [['html'], ['list']],
});
