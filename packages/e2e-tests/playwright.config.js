// eslint-disable-next-line import/no-extraneous-dependencies
const { defineConfig, devices } = require('@playwright/test');

const baseURL = process.env.LINGUA_QUIZ_URL || 'http://localhost:8080';
// Debug logging for CI - remove after fixing the issue
// eslint-disable-next-line no-console
console.log('Playwright config - baseURL:', baseURL);
// eslint-disable-next-line no-console
console.log(
  'All env vars:',
  Object.keys(process.env).filter((k) => k.includes('LINGUA') || k.includes('API'))
);

module.exports = defineConfig({
  testDir: './tests',
  timeout: 60 * 1000,
  expect: {
    timeout: 10000,
  },
  use: {
    baseURL,
    trace: 'on-first-retry',
    screenshot: 'only-on-failure',
    video: 'retain-on-failure',
    // Enable debug mode for more verbose logging
    headless: true,
    // Log all network activity
    launchOptions: {
      // Enable verbose logging
      args: ['--enable-logging', '--v=1'],
    },
    // Add action timeout
    actionTimeout: 10000,
    // Add navigation timeout
    navigationTimeout: 30000,
  },
  reporter: [['html', { open: 'never' }], ['list']],
  // Retry failed tests
  retries: process.env.CI ? 2 : 0,
  // Run tests in parallel
  workers: process.env.CI ? 1 : undefined,

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
