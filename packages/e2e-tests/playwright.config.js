// eslint-disable-next-line import/no-extraneous-dependencies
const { defineConfig, devices } = require('@playwright/test');

module.exports = defineConfig({
  testDir: './tests',
  timeout: 30 * 1000,
  expect: {
    timeout: 5000,
  },
  use: {
    baseURL: process.env.LINGUA_QUIZ_URL,
    trace: 'off',
    screenshot: 'on',
    video: 'on', // set to 'on' for detailed debugging
  },
  reporter: [['html'], ['list']],

  projects: [
    // Desktop configurations
    {
      name: 'Desktop Chromium',
      use: { browserName: 'chromium', viewport: { width: 1280, height: 720 } },
    },
    {
      name: 'Desktop Firefox',
      testIgnore: 'tests/002-quiz.spec.js',
      use: { browserName: 'firefox', viewport: { width: 1280, height: 720 } },
    },
    {
      name: 'Desktop WebKit',
      testIgnore: 'tests/002-quiz.spec.js',
      use: { browserName: 'webkit', viewport: { width: 1280, height: 720 } },
    },

    // Mobile configurations
    {
      name: 'Mobile Chrome',
      testIgnore: 'tests/002-quiz.spec.js',
      use: {
        browserName: 'chromium',
        ...devices['Pixel 5'],
      },
    },
    {
      name: 'Mobile Safari',
      testIgnore: 'tests/002-quiz.spec.js',
      use: {
        browserName: 'webkit',
        ...devices['iPhone 12'],
      },
    },
  ],
});
