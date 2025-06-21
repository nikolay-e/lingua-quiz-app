const { defineConfig, devices } = require('@playwright/test');

const baseURL = process.env.LINGUA_QUIZ_URL || 'http://localhost:8080';

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
    headless: true,
    actionTimeout: 10000,
    navigationTimeout: 30000,
    // Enable console logging
    launchOptions: {
      logger: {
        isEnabled: (name, severity) => true,
        log: (name, severity, message, args) => console.log(`${name} ${severity}: ${message}`)
      }
    }
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
      use: { 
        browserName: 'chromium', 
        viewport: { width: 1280, height: 720 },
        launchOptions: {
          args: ['--enable-logging', '--v=1'],
        },
      },
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
        launchOptions: {
          args: ['--enable-logging', '--v=1'],
        },
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
