// packages/e2e-tests/playwright.config.mjs
import { join } from 'node:path';

import { defineConfig, devices } from '@playwright/test';

// Shared configuration for all projects - reduced timeouts for faster testing
const sharedConfig = {
  // Timeout values - reduced
  timeout: 10 * 1000,
  expect: { timeout: 500 },

  // Console logging setup
  console: 'verbose',

  // Screenshot and video recording - only on failures to reduce output
  screenshot: 'only-on-failure',
  video: 'on-first-retry',
};

// Browser-specific configurations
const browserConfigs = {
  chromium: {
    web: { browserName: 'chromium', viewport: { width: 1280, height: 720 } },
    mobile: { browserName: 'chromium', ...devices['Pixel 5'] },
  },
  firefox: {
    web: { browserName: 'firefox', viewport: { width: 1280, height: 720 } },
    testIgnore: 'tests/002-quiz.spec.js',
  },
  webkit: {
    web: { browserName: 'webkit', viewport: { width: 1280, height: 720 } },
    mobile: { browserName: 'webkit', ...devices['iPhone 12'] },
    testIgnore: 'tests/002-quiz.spec.js',
  },
};

// Main configuration
export default defineConfig({
  testDir: './tests',

  // Common settings for all tests
  use: {
    baseURL: process.env.LINGUA_QUIZ_URL || 'http://localhost:8080',
    ...sharedConfig,

    // Add logger configuration to show browser logs directly in the console
    logger: {
      isEnabled: (name, severity) => true, // Enable all logs
      log: (name, severity, message, args) => console.log(`[${severity}] ${message}`),
    },
  },

  // Artifact folder for screenshots and videos
  // Updated path to avoid conflict with HTML reporter
  outputDir: join(process.env.PLAYWRIGHT_OUTPUT_DIR || 'test-results', 'artifacts'),

  // Use HTML reporter but with open:never to prevent browser opening
  reporter: [['html', { open: 'never' }], ['dot']],

  // Project-specific configurations
  projects: process.env.CI
    ? [
        // When running in CI, use all browsers
        // Desktop Chromium - Main browser, runs all tests
        {
          name: 'Desktop Chromium',
          use: browserConfigs.chromium.web,
        },
        // Desktop Firefox
        {
          name: 'Desktop Firefox',
          use: browserConfigs.firefox.web,
          testIgnore: browserConfigs.firefox.testIgnore,
        },
        // Desktop WebKit
        {
          name: 'Desktop WebKit',
          use: browserConfigs.webkit.web,
          testIgnore: browserConfigs.webkit.testIgnore,
        },
        // Mobile Chrome
        {
          name: 'Mobile Chrome',
          use: browserConfigs.chromium.mobile,
          testIgnore: browserConfigs.firefox.testIgnore,
        },
        // Mobile Safari
        {
          name: 'Mobile Safari',
          use: browserConfigs.webkit.mobile,
          testIgnore: browserConfigs.webkit.testIgnore,
        },
      ]
    : [
        // For local development, only use Chromium desktop for faster testing
        {
          name: 'Desktop Chromium',
          use: browserConfigs.chromium.web,
        },
      ],

  // Advanced options
  retries: process.env.CI ? 2 : 0, // Retry failed tests on CI
  workers: process.env.CI ? 1 : undefined, // Use single worker on CI for more stable execution
  fullyParallel: false, // Disable full parallelism to avoid race conditions
  globalSetup: './global-setup.js', // Still reference global setup but now with correct implementation

  // Avoid parallel tests for authentication
  forbidOnly: !!process.env.CI, // Error on focused tests in CI
  preserveOutput: 'failures-only', // Preserve output files only for failed tests
});
