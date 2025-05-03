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

// packages/e2e-tests/page-objects/auth/login-form-handlers.js
import { takeErrorScreenshot, verifyStorageCleared } from './login-helpers.js';

/**
 * Functions for handling login form actions
 */

/**
 * Attempts to log in with the provided credentials
 * @param {import('@playwright/test').Page} page - Playwright page object
 * @param {Object} selectors - Page object selectors
 * @param {Object} methods - BasePage methods (waitForElement, fillInput, etc.)
 * @param {Object} timeouts - Timeout constants
 * @param {Function} log - Logging function
 * @param {string} email - User email
 * @param {string} password - User password
 * @returns {Promise<boolean>} Success flag
 */
export async function handleLogin(page, selectors, methods, timeouts, log, email, password) {
  await log(`Attempting login with email: ${email}`, 'info');

  // Take a screenshot before we start
  await takeErrorScreenshot(page, 'login_before', log);

  // Wait to ensure page is fully loaded and stable
  await page.waitForLoadState('domcontentloaded');
  await page.waitForTimeout(500);

  // First make sure the form is fully visible
  const loginForm = await methods.waitForElement(selectors.loginForm, {
    timeout: timeouts.medium,
    errorMessage: 'Login form not visible before attempting to fill credentials',
  });

  // Use a direct approach first - click to focus form
  await loginForm.click();

  // Ensure inputs are present
  await methods.waitForElement(selectors.emailInput);
  await methods.waitForElement(selectors.passwordInput);

  // Fill email and password inputs
  await methods.fillInput(selectors.emailInput, email, {
    maxRetries: 3,
    timeout: timeouts.medium,
  });

  await methods.fillInput(selectors.passwordInput, password, {
    maxRetries: 3,
    timeout: timeouts.medium,
  });

  // Take a screenshot after filling but before submit
  await takeErrorScreenshot(page, 'login_after_fill', log);

  try {
    // Take screenshot before clicking login button
    await takeErrorScreenshot(page, 'login_before_click', log);

    // Set up listener for potential form submit events
    const formSubmitPromise = page
      .waitForEvent('framenavigated', {
        timeout: timeouts.long,
      })
      .catch((error) => console.log('framenavigated event timed out:', error.message));

    await log('Clicking login button and waiting for navigation', 'info');

    // Click the login button
    const loginButton = await methods.waitForElement(selectors.loginButton);

    // First attach a submit listener directly to the form
    await page.evaluate(() => {
      const form = document.querySelector('#login-form');
      if (form) {
        form.addEventListener('submit', () => {
          console.log('Form submit event detected');
          // Set a flag that we can detect
          window._formWasSubmitted = true;
        });
      }
    });

    // Click the button without waiting, since we'll handle navigation separately
    await loginButton.click({ timeout: timeouts.medium });

    // Specifically listen for form submission
    const wasFormSubmitted = await page
      .evaluate(() => {
        return window._formWasSubmitted === true;
      })
      .catch(() => false);

    await (wasFormSubmitted
      ? log('Form submission detected via DOM event', 'info')
      : log('No form submission detected via DOM, will wait for navigation', 'warn'));

    // Now wait for navigation - use a more reliable approach
    await Promise.race([
      page.waitForURL('/', {
        timeout: timeouts.long,
        waitUntil: 'domcontentloaded',
      }),
      formSubmitPromise,
    ]);

    // Wait additional time for any client-side processing
    await page.waitForTimeout(1000);

    // Take screenshot after navigation
    await takeErrorScreenshot(page, 'login_after_navigation', log);

    // Navigation successful, now verify we are truly logged in by checking a stable element
    await log('Login navigation successful, verifying logout button visibility', 'info');
    const logoutButtonLocator = page.locator(selectors.logoutButton);
    await logoutButtonLocator.waitFor({ state: 'visible', timeout: timeouts.medium });

    await log('Login successful and verified', 'info');
    return true; // Login succeeded
  } catch {
    // Try alternative approach
    return await tryAlternativeLogin(page, selectors, methods, timeouts, log);
  }
}

/**
 * Attempts alternative login approach when standard approach fails
 * @param {import('@playwright/test').Page} page - Playwright page object
 * @param {Object} selectors - Page object selectors
 * @param {Object} methods - BasePage methods
 * @param {Object} timeouts - Timeout constants
 * @param {Function} log - Logging function
 * @returns {Promise<boolean>} Success flag
 */
async function tryAlternativeLogin(page, selectors, methods, timeouts, log) {
  await log('Trying alternative approach: direct form submission', 'info');

  try {
    // Submit form directly as a fallback
    await page.evaluate(() => {
      const form = document.querySelector('#login-form');
      if (form) {
        form.submit();
        console.log('Form submitted directly via DOM');
      }
    });

    // Wait for navigation with longer timeout
    await page.waitForURL('/', {
      timeout: timeouts.long,
      waitUntil: 'domcontentloaded',
    });

    // Wait for any client-side processing
    await page.waitForTimeout(1000);

    // Check if we successfully navigated
    const isLogoutButtonVisible = await page
      .locator(selectors.logoutButton)
      .isVisible({ timeout: timeouts.medium });

    if (isLogoutButtonVisible) {
      await log('Login successful via direct form submission', 'info');
      return true;
    }
  } catch (fallbackError) {
    await log(`Fallback login approach also failed: ${fallbackError.message}`, 'warn');
  }

  // If we get here, gather diagnostics for the failure
  await collectLoginDiagnostics(page, selectors, methods, log);
  return false;
}

/**
 * Collects diagnostic information after login failure
 * @param {import('@playwright/test').Page} page - Playwright page object
 * @param {Object} selectors - Page object selectors
 * @param {Object} methods - BasePage methods
 * @param {Function} log - Logging function
 */
async function collectLoginDiagnostics(page, selectors, methods, log) {
  try {
    // Take failure screenshot
    await takeErrorScreenshot(page, 'login_failed_final', log);

    // Get current URL
    const currentUrl = page.url();
    await log(`Current URL after failed login: ${currentUrl}`, 'warn');

    // Check if we are still on login page
    const isStillOnLogin = await page.locator(selectors.loginForm).isVisible({ timeout: 500 });

    if (isStillOnLogin) {
      await log('Still on login page after login attempt', 'warn');

      // Check for error messages
      const errorMessageVisible = await page
        .locator(selectors.errorMessage)
        .isVisible({ timeout: 1000 });

      if (errorMessageVisible) {
        const errorText = await methods.getText(selectors.errorMessage);
        await log(`Login page error message: ${errorText}`, 'warn');
      } else {
        await log('No visible error message found on login page', 'warn');

        // Dump HTML for debugging (truncated to avoid excessive logs)
        const html = await page.content();
        const truncatedHtml = html.length > 1000 ? html.slice(0, 1000) + '...' : html;
        await log(`Page HTML (truncated): ${truncatedHtml}`, 'debug');
      }
    } else {
      await log('Login form not visible, but not successfully navigated either', 'warn');
    }
  } catch (diagnosticError) {
    await log(`Error while collecting diagnostic info: ${diagnosticError.message}`, 'error');
  }
}

/**
 * Handles user logout
 * @param {import('@playwright/test').Page} page - Playwright page object
 * @param {Object} selectors - Page object selectors
 * @param {Object} methods - BasePage methods
 * @param {Object} timeouts - Timeout constants
 * @param {Function} log - Logging function
 * @returns {Promise<boolean>} Success flag
 */
export async function handleLogout(page, selectors, methods, timeouts, log) {
  await log('Attempting to logout', 'info');

  try {
    await methods.clickElement(selectors.logoutButton);

    // Wait for redirection to login page
    await page.waitForURL('**/login.html', {
      waitUntil: 'domcontentloaded',
      timeout: timeouts.medium,
    });

    // Verify login form is visible
    await methods.waitForElement(selectors.loginForm, {
      errorMessage: 'Login form not visible after logout',
    });

    // Verify storage is cleared
    await verifyStorageCleared(page, log);

    await log('Logout successful', 'info');
    return true;
  } catch (error) {
    await log(`Logout error: ${error.message}`, 'error');
    await takeErrorScreenshot(page, 'logout_error', log);
    return false;
  }
}
