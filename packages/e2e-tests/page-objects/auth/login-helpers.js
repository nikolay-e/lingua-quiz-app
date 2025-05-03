// packages/e2e-tests/page-objects/auth/login-helpers.js

/**
 * Helper functions for the login and registration page objects
 */

/**
 * Takes a diagnostic screenshot with a specific name
 * @param {import('@playwright/test').Page} page - Playwright page object
 * @param {string} name - Screenshot name
 * @param {Function} log - Logging function
 */
export async function takeErrorScreenshot(page, name, log) {
  try {
    const path = `./test-results/screenshots/${name}_${Date.now()}.png`;
    await page.screenshot({ path, fullPage: true });
    await log(`Saved error screenshot to ${path}`, 'debug');
  } catch (error) {
    await log(`Failed to take screenshot: ${error.message}`, 'warn');
  }
}

/**
 * Clear local storage and cookies
 * @param {import('@playwright/test').Page} page - Playwright page object
 * @param {Function} log - Logging function
 */
export async function clearStorageAndCookies(page, log) {
  await page.context().clearCookies();
  // Use page.evaluate for browser APIs
  await page.evaluate(() => {
    try {
      // Access localStorage through window object explicitly
      localStorage.clear();
    } catch (error) {
      console.error('Failed to clear localStorage:', error);
    }
  });
  await log('Cleared cookies and localStorage');
}

/**
 * Verifies storage is cleared after logout
 * @param {import('@playwright/test').Page} page - Playwright page object
 * @param {Function} log - Logging function
 * @returns {Promise<boolean>} True if storage is properly cleared
 */
export async function verifyStorageCleared(page, log) {
  // Verify storage is cleared - use page.evaluate for browser APIs
  const storage = await page.evaluate(() => {
    return {
      token: localStorage.getItem('token'),
      email: localStorage.getItem('email'),
      tokenExpiration: localStorage.getItem('tokenExpiration'),
    };
  });

  const isStorageCleared =
    storage.token === null && storage.email === null && storage.tokenExpiration === null;

  if (!isStorageCleared) {
    await log('WARNING: Storage not properly cleared after logout', 'warn');
  }

  return isStorageCleared;
}

/**
 * Get diagnostic form state information for debugging
 * @param {import('@playwright/test').Page} page - Playwright page object
 * @returns {Promise<Object>} Form state information
 */
export async function getFormDiagnostics(page) {
  return await page.evaluate(() => {
    return {
      registrationSuccess: window.registrationSuccess === true,
      formState: {
        registerWrapper: {
          exists: !!document.querySelector('#register-section-wrapper'),
          hidden:
            document.querySelector('#register-section-wrapper')?.classList.contains('hidden') ||
            false,
          display: document.querySelector('#register-section-wrapper')?.style.display || 'unknown',
        },
        showRegisterBtn: {
          exists: !!document.querySelector('#show-register-btn'),
          hidden:
            document.querySelector('#show-register-btn')?.classList.contains('hidden') || false,
          display: document.querySelector('#show-register-btn')?.style.display || 'unknown',
        },
      },
      messages: {
        loginMessage: document.querySelector('#login-message')?.textContent || '',
        registerMessage: document.querySelector('#register-message')?.textContent || '',
        errorContainer: document.querySelector('#error-container')?.textContent || '',
      },
    };
  });
}
