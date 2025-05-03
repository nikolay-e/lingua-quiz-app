// packages/e2e-tests/fixtures/index.js
import { test as base } from '@playwright/test';

import usersModule from './users';
const { createTestUser, createQuizUser } = usersModule;
import { QUIZ_CONSTANTS } from '../utils/constants';

/**
 * Custom test fixture that provides page objects and test data
 */
const test = base.extend({
  /**
   * Override the page fixture to add console logging
   */
  page: async ({ page }, use) => {
    // Listen to all console events and log them
    page.on('console', (msg) => {
      const type = msg.type();
      const text = msg.text();
      try {
        const location = msg.location();
        const timestamp = new Date().toISOString();

        console.log(
          `[${timestamp}] [BROWSER ${type.toUpperCase()}] ${text} (${location.url}:${location.lineNumber})`
        );
      } catch {
        console.log(`[${new Date().toISOString()}] [BROWSER ${type.toUpperCase()}] ${text}`);
      }
    });

    // Listen to page errors
    page.on('pageerror', (error) => {
      console.error(`[PAGE ERROR] ${error.message}`);
    });

    // Listen to request failures
    page.on('requestfailed', (request) => {
      try {
        console.error(`[REQUEST FAILED] ${request.url()}: ${request.failure().errorText}`);
      } catch {
        console.error(`[REQUEST FAILED] ${request.url()}`);
      }
    });

    // Listen to ALL network requests for debugging
    page.on('request', (request) => {
      if (request.url().includes('/api/word-sets')) {
        console.log(`[REQUEST] ${request.method()} ${request.url()}`);
        console.log(`[REQUEST HEADERS] ${JSON.stringify(request.headers())}`);
      }
    });

    // Listen to ALL network responses for debugging
    page.on('response', async (response) => {
      if (response.url().includes('/api/word-sets')) {
        console.log(`[RESPONSE] ${response.status()} ${response.url()}`);

        try {
          const responseBody = await response.text();
          console.log(
            `[RESPONSE BODY] ${responseBody.slice(0, 300)}${responseBody.length > 300 ? '...' : ''}`
          );
        } catch (error) {
          console.log(`[RESPONSE BODY ERROR] Failed to get response body: ${error.message}`);
        }
      }
    });

    await use(page);
  },

  /**
   * Generates a unique test user for the current test
   */
  testUser: async ({}, use) => {
    const user = createTestUser();
    await use(user);
  },

  /**
   * Generate a user specific to a quiz
   */
  quizUser: async ({}, use) => {
    const quizName = process.env.E2E_QUIZ_NAME;
    const user = createQuizUser(quizName);
    await use(user);
  },

  /**
   * Provides a LoginPage instance
   */
  loginPage: async ({ page }, use) => {
    const pageObjects = await import('../page-objects/index');
    const { LoginPage } = pageObjects.default;
    const loginPage = new LoginPage(page);
    await use(loginPage);
  },

  /**
   * Provides a QuizPage instance
   */
  quizPage: async ({ page }, use) => {
    const pageObjects = await import('../page-objects/index');
    const { QuizPage } = pageObjects.default;
    const quizPage = new QuizPage(page);
    await use(quizPage);
  },

  /**
   * Sets up a registered user for tests that need authentication
   */
  authenticatedUser: async ({ testUser, loginPage }, use) => {
    // Navigate to login page
    await loginPage.navigate();

    // Clear any existing session
    await loginPage.clearStorageAndCookies();

    // Register the user if needed
    await loginPage.register(testUser.email, testUser.password);
    testUser.isRegistered = true;

    // Login
    await loginPage.login(testUser.email, testUser.password);

    // Make the authenticated user available for the test
    await use(testUser);

    // Clean up: logout after test
    await loginPage.logout();
  },

  /**
   * Sets up a registered quiz user with longer test timeout
   */
  authenticatedQuizUser: async ({ quizUser, loginPage }, use, testInfo) => {
    // Increase test timeout for quiz tests
    testInfo.setTimeout(QUIZ_CONSTANTS.TEST_TIMEOUT_MS);

    // Navigate to login page
    await loginPage.navigate();

    // Clear any existing session
    await loginPage.clearStorageAndCookies();

    // Register the user if needed
    await loginPage.register(quizUser.email, quizUser.password);
    quizUser.isRegistered = true;

    // Login
    await loginPage.login(quizUser.email, quizUser.password);

    // Make the authenticated user available for the test
    await use(quizUser);

    // Clean up: logout after test
    await loginPage.logout();
  },
});

export { test };
