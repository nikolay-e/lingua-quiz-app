// packages/e2e-tests/tests/auth/login.spec.js
import { expect } from '@playwright/test';

import { test } from '../../fixtures/index';
import { TIMEOUTS } from '../../utils/timeouts';

test.describe('User Login', () => {
  test('should login successfully with valid credentials', async ({ loginPage, page }) => {
    // First register a unique user for this test
    const uniqueEmail = `login_test_${Date.now()}@example.com`;
    const password = 'TestPassword123!';

    console.log(`Setting up test user with email: ${uniqueEmail}`);

    // Register a test user first via API
    const serverAddress = 'http://localhost:9000';
    const registerResponse = await page.request.post(`${serverAddress}/api/auth/register`, {
      data: {
        email: uniqueEmail,
        password,
      },
      headers: {
        'Content-Type': 'application/json',
      },
    });

    if (registerResponse.ok()) {
      console.log(`Successfully registered test user via API: ${uniqueEmail}`);
    } else {
      console.error(`Failed to register test user via API: ${uniqueEmail}`);
      // Create user via UI as fallback
      await loginPage.navigate();
      const registered = await loginPage.register(uniqueEmail, password);
      expect(registered, 'Failed to register test user for login test').toBeTruthy();
    }

    // Now test login with the created user
    await loginPage.navigate();

    // Fill login form
    await page.fill('#email', uniqueEmail);
    await page.fill('#password', password);

    // Take screenshot before submitting
    await loginPage.takeErrorScreenshot('before_login_submit');

    // Submit login form
    await page.click('#login-form button[type="submit"]');

    // Verify login success - should redirect to home page
    await page.waitForURL('/', { timeout: 10_000 });

    // Verify logout button is visible (indication of successful login)
    await expect(page.locator('#login-logout-btn')).toContainText('Logout', { timeout: 5000 });
  });

  test('should show error message on failed login', async ({ loginPage, page }) => {
    // Use an email that is unlikely to be registered
    const nonExistentEmail = `non_existent_${Date.now()}@example.com`;
    const invalidPassword = 'WrongPassword123!';

    // Navigate to login page
    await loginPage.navigate();

    // Fill login form with invalid credentials
    await page.fill('#email', nonExistentEmail);
    await page.fill('#password', invalidPassword);

    // Submit login form
    await page.click('#login-form button[type="submit"]');

    // Verify we're still on the login page
    await expect(page.url()).toContain('login.html');

    // Verify error message is shown (could be in login-message or error-container)
    await expect(page.locator('#login-message, #error-container')).toContainText(
      /invalid|incorrect|failed|not found/i,
      { timeout: 5000 }
    );
  });

  test('should persist login across page refreshes', async ({ loginPage, page }) => {
    // First register and login with a user
    const uniqueEmail = `persistent_${Date.now()}@example.com`;
    const password = 'TestPassword123!';

    // Register/setup the user
    await loginPage.navigate();
    const userExists = await loginPage.ensureUserRegistered(uniqueEmail, password);
    expect(userExists, 'Failed to ensure test user exists').toBeTruthy();

    // Login with the user
    await loginPage.login(uniqueEmail, password);

    // Verify we're on the home page
    await page.waitForURL('/', { timeout: 10_000 });

    // Refresh the page
    await page.reload();

    // Verify we're still logged in (logout button still visible)
    await expect(page.locator('#login-logout-btn')).toBeVisible({ timeout: 5000 });

    // Navigate away and back to test session persistence
    await page.goto('/login.html');
    await page.goto('/');

    // Verify still logged in
    await expect(page.locator('#login-logout-btn')).toBeVisible({ timeout: 5000 });
  });
});
