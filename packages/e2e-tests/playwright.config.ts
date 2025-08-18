import { defineConfig, devices } from '@playwright/test';

const baseURL = process.env.LINGUA_QUIZ_URL || 'http://localhost:8080';

export default defineConfig({
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
  },
  reporter: [['html', { open: 'never' }], ['list']],
  // Retry failed tests
  retries: process.env.CI ? 2 : 0,
  // Run tests in parallel - tests use unique usernames to avoid conflicts
  workers: process.env.CI ? 4 : undefined, // undefined = auto-detect based on CPU cores

  projects: [
    // Desktop configurations
    {
      name: 'Desktop Chromium',
      use: {
        browserName: 'chromium',
        viewport: { width: 1280, height: 720 },
      },
    },
    {
      name: 'Desktop Firefox',
      testIgnore: 'tests/002-quiz.spec.js.deprecated',
      use: { browserName: 'firefox', viewport: { width: 1280, height: 720 } },
    },
    {
      name: 'Desktop WebKit',
      testIgnore: 'tests/002-quiz.spec.js.deprecated',
      use: { browserName: 'webkit', viewport: { width: 1280, height: 720 } },
    },

    // Mobile configurations
    {
      name: 'Mobile Chrome',
      testIgnore: 'tests/002-quiz.spec.js.deprecated',
      use: {
        browserName: 'chromium',
        ...devices['Pixel 5'],
      },
    },
    {
      name: 'Mobile Safari',
      testIgnore: 'tests/002-quiz.spec.js.deprecated',
      use: {
        browserName: 'webkit',
        ...devices['iPhone 12'],
      },
    },
  ],
});
