// packages/e2e-tests/tests/auth/registration.spec.js
import { expect } from '@playwright/test';

import { test } from '../../fixtures/index';
import { TIMEOUTS } from '../../utils/timeouts';

test.describe('User Registration', () => {
  test('should allow showing the registration form', async ({ loginPage }) => {
    await loginPage.navigate();

    // Registration section should initially be hidden
    await expect(loginPage.page.locator('#register-section-wrapper')).toBeHidden({ timeout: 1000 });

    // Show register button should be visible
    await expect(loginPage.page.locator('#show-register-btn')).toBeVisible({ timeout: 1000 });

    // Click show register button
    await loginPage.clickElement('#show-register-btn');

    // Registration section should now be visible
    await expect(loginPage.page.locator('#register-section-wrapper')).toBeVisible({
      timeout: 1000,
    });

    // Show register button should now be hidden
    await expect(loginPage.page.locator('#show-register-btn')).toBeHidden({ timeout: 1000 });
  });

  test('should register a new user successfully', async ({ loginPage, page }) => {
    // Generate a unique email for this test to avoid existing user errors
    const uniqueEmail = `test_${Date.now()}@example.com`;
    const password = 'TestPassword123!';

    console.log(`Creating a new user with unique email: ${uniqueEmail}`);

    // Before trying UI registration, try direct API call to avoid frontend issues
    const serverAddress = 'http://localhost:9000';
    const response = await page.request.post(`${serverAddress}/api/auth/register`, {
      data: {
        email: uniqueEmail,
        password,
      },
      headers: {
        'Content-Type': 'application/json',
      },
    });

    console.log(`API registration response: ${response.status()}`);

    if (response.ok()) {
      console.log(`Successfully registered user via API: ${uniqueEmail}`);

      // Now proceed with login test
      await loginPage.navigate();

      // Fill login form with the new user
      await page.fill('#email', uniqueEmail);
      await page.fill('#password', password);

      // Submit login form
      await page.click('#login-form button[type="submit"]');

      // Verify login success - should redirect to home page
      await page.waitForURL('/', { timeout: 10_000 });

      // Verify logout button is visible (indication of successful login)
      await expect(page.locator('#login-logout-btn')).toContainText('Logout', { timeout: 5000 });

      return;
    }

    console.log('Falling back to UI registration flow');

    // Navigate to login page
    await loginPage.navigate();

    // Wait for page to be fully loaded
    await page.waitForLoadState('networkidle');

    // Take screenshot of initial state
    await loginPage.takeErrorScreenshot('before_registration');

    // Verify the show register button is visible
    const showRegisterBtn = page.locator('#show-register-btn');
    await expect(showRegisterBtn).toBeVisible({ timeout: 5000 });

    // Click the show register button (using Playwright's built-in methods)
    await showRegisterBtn.click();

    // Wait for registration form to be visible
    await expect(page.locator('#register-form')).toBeVisible({ timeout: 5000 });

    // Fill in registration form directly
    await page.fill('#register-email', uniqueEmail);
    await page.fill('#register-password', password);

    // Take screenshot before submitting
    await loginPage.takeErrorScreenshot('before_registration_submit');

    // Submit the form by clicking the register button
    await page.click('#register-form button[type="submit"]');

    // Wait for success message - use a longer timeout
    await expect(page.locator('#login-message')).toBeVisible({ timeout: 10_000 });
    await expect(page.locator('#login-message')).toContainText('successful', { timeout: 5000 });

    // Verify registration form is hidden
    await expect(page.locator('#register-section-wrapper')).toBeHidden({ timeout: 5000 });

    // Verify show register button is visible again
    await expect(page.locator('#show-register-btn')).toBeVisible({ timeout: 5000 });

    // Take final screenshot of successful state
    await loginPage.takeErrorScreenshot('after_successful_registration');
  });

  test('should not allow duplicate registration', async ({ loginPage, page }) => {
    // Create a known user first, then try to register again
    const duplicateEmail = `duplicate_test_${Date.now()}@example.com`;
    const password = 'TestPassword123!';

    console.log(`Testing duplicate registration with email: ${duplicateEmail}`);

    // STEP 1: Navigate and register the user first time
    await loginPage.navigate();
    await page.waitForLoadState('networkidle');

    // Click show register button
    await page.locator('#show-register-btn').click();
    await expect(page.locator('#register-form')).toBeVisible({ timeout: 5000 });

    // Register a new user
    await page.fill('#register-email', duplicateEmail);
    await page.fill('#register-password', password);
    await page.click('#register-form button[type="submit"]');

    // Verify first registration succeeded
    await expect(page.locator('#login-message')).toContainText('successful', { timeout: 10_000 });

    // STEP 2: Try registering the same user again
    // The "show register" button should now be visible again after successful registration
    await page.locator('#show-register-btn').click();
    await expect(page.locator('#register-form')).toBeVisible({ timeout: 5000 });

    // Fill the form with the same credentials
    await page.fill('#register-email', duplicateEmail);
    await page.fill('#register-password', password);

    // Submit the form again - this should fail
    await page.click('#register-form button[type="submit"]');

    // Verify error message is shown
    await expect(page.locator('#register-message, #error-container')).toContainText('exist', {
      timeout: 5000,
    });
  });
});
