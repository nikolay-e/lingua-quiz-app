// packages/e2e-tests/tests/auth/logout.spec.js
import { expect } from '@playwright/test';

import { test } from '../../fixtures/index';
import { TIMEOUTS } from '../../utils/timeouts';

test.describe('User Logout', () => {
  test('should logout successfully', async ({ loginPage, page }) => {
    // First register/login with a user
    const uniqueEmail = `logout_test_${Date.now()}@example.com`;
    const password = 'TestPassword123!';

    // Setup user and login
    await loginPage.navigate();
    await loginPage.ensureUserRegistered(uniqueEmail, password);
    const loginSuccess = await loginPage.login(uniqueEmail, password);
    expect(loginSuccess, 'Failed to login for logout test').toBeTruthy();

    // Verify logout button is visible
    await expect(page.locator('#login-logout-btn')).toBeVisible({ timeout: 5000 });

    // Click logout button
    await page.click('#login-logout-btn');

    // Should redirect to login page
    await page.waitForURL('**/login.html', { timeout: 10_000 });

    // Verify login form is visible (indication of successful logout)
    await expect(page.locator('#login-form')).toBeVisible({ timeout: 5000 });

    // Verify localStorage is cleared
    const token = await page.evaluate(() => localStorage.getItem('token'));
    expect(token).toBeNull();
  });

  test('should require login after logging out', async ({ loginPage, page }) => {
    // First register/login with a user
    const uniqueEmail = `logout_redirect_${Date.now()}@example.com`;
    const password = 'TestPassword123!';

    // Setup user and login
    await loginPage.navigate();
    await loginPage.ensureUserRegistered(uniqueEmail, password);
    await loginPage.login(uniqueEmail, password);

    // Verify we're on the quiz page
    await page.waitForURL('/', { timeout: 10_000 });

    // Logout
    await page.click('#login-logout-btn');
    await page.waitForURL('**/login.html', { timeout: 10_000 });

    // Try to navigate to protected page
    await page.goto('/');

    // Should redirect back to login
    await page.waitForURL('**/login.html', { timeout: 10_000 });
  });
});
