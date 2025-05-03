/*
 * LinguaQuiz – Copyright © 2025 Nikolay Eremeev
 *
 * Dual-licensed:
 *  – Non-Commercial Source-Available v2  →  see LICENSE-NONCOMMERCIAL.md
 *  – Commercial License v2              →  see LICENSE-COMMERCIAL.md
 *
 * Contact: lingua-quiz@nikolay-eremeev.com
 * Repository: https://github.com/nikolay-e/lingua-quiz
 */

// packages/e2e-tests/tests/auth/account.spec.js
import { expect } from '@playwright/test';

import { test } from '../../fixtures/index';
import { TIMEOUTS } from '../../utils/timeouts';

test.describe('Account Management', () => {
  test('should allow account deletion', async ({ loginPage, page }) => {
    // First register/login with a user
    const uniqueEmail = `delete_account_${Date.now()}@example.com`;
    const password = 'TestPassword123!';

    // Setup user and login
    await loginPage.navigate();
    await loginPage.ensureUserRegistered(uniqueEmail, password);
    await loginPage.login(uniqueEmail, password);

    // Verify delete account button is visible
    await expect(page.locator('#delete-account-btn')).toBeVisible({ timeout: 5000 });

    // Handle the confirmation dialog
    page.on('dialog', async (dialog) => {
      expect(dialog.type()).toBe('confirm');
      await dialog.accept();
    });

    // Click delete account button
    await page.click('#delete-account-btn');

    // Should redirect to login page
    await page.waitForURL('**/login.html', { timeout: 10_000 });

    // Verify login form is visible
    await expect(page.locator('#login-form')).toBeVisible({ timeout: 5000 });

    // Try to login with the deleted account
    await page.fill('#email', uniqueEmail);
    await page.fill('#password', password);
    await page.click('#login-form button[type="submit"]');

    // Should show error message (can't login with deleted account)
    await expect(page.locator('#login-message, #error-container')).toContainText(
      /invalid|incorrect|failed|not found/i,
      { timeout: 5000 }
    );
  });
});
