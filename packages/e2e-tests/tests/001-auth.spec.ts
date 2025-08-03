import { test, expect } from '@playwright/test';
import { register, login, logout } from './helpers';

test.describe.serial('User Authentication', () => {
  // Generate a unique user for this test suite with extra entropy
  const generateUniqueEmail = (): string => {
    const timestamp = Date.now();
    const random = Math.random().toString(36).substring(2, 8);
    // Keep username under 50 characters (backend limit)
    return `test_${timestamp}_${random}`;
  };

  const testUser = generateUniqueEmail();
  const testPassword = 'testPassword123!';

  // Track if user has been registered
  let userRegistered = false;
  let actualTestUser = testUser; // Track the actual user username used

  test.beforeEach(async ({ page }) => {
    // Use environment variable directly since baseURL is not being set
    const url = process.env.LINGUA_QUIZ_URL || 'http://localhost:8080';
    await page.goto(url);
  });

  test('should register a new user', async ({ page }) => {
    try {
      await register(page, testUser, testPassword, true);
      userRegistered = true;
      actualTestUser = testUser; // Store the successful username
    } catch (error) {
      if (error instanceof Error && error.message && error.message.includes('Conflict')) {
        // If there's still a conflict with our highly unique username, try once more
        const fallbackUser = generateUniqueEmail();
        console.log(`Registration conflict detected (unlikely), trying with new username: ${fallbackUser}`);
        await register(page, fallbackUser, testPassword, true);
        userRegistered = true;
        actualTestUser = fallbackUser;
      } else {
        throw error;
      }
    }
  });

  test('should not allow duplicate registration', async ({ page }) => {
    // Skip if previous test failed
    if (!userRegistered) {
      test.skip();
      return;
    }
    await register(page, actualTestUser, testPassword, false);
  });

  test('should login with valid credentials', async ({ page }) => {
    // Skip if registration failed
    if (!userRegistered) {
      test.skip();
      return;
    }
    // First logout if already logged in from registration
    try {
      await page.locator('#login-logout-btn').click({ timeout: 2000 });
      await expect(page.locator('section:has-text("Sign In")')).toBeVisible();
    } catch {
      // Not logged in, that's fine
    }

    await login(page, actualTestUser, testPassword);
    // In a SPA, we check for the quiz select element instead of URL
    await expect(page.locator('#quiz-select')).toBeVisible();
  });

  test('should not login with invalid credentials', async ({ page }) => {
    // Skip if registration failed
    if (!userRegistered) {
      test.skip();
      return;
    }
    // First logout if already logged in from registration
    try {
      await page.locator('#login-logout-btn').click({ timeout: 2000 });
      await expect(page.locator('section:has-text("Sign In")')).toBeVisible();
    } catch {
      // Not logged in, that's fine
    }

    await login(page, actualTestUser, 'wrongPassword');
    // Check for error message in the login message element
    const loginMessage = page.locator('#login-message');
    await expect(loginMessage).toBeVisible({ timeout: 2000 });
    // The message should not contain "successful"
    await expect(loginMessage).not.toContainText('successful');
  });

  test('should logout successfully', async ({ page }) => {
    // Skip if registration failed
    if (!userRegistered) {
      test.skip();
      return;
    }
    await login(page, actualTestUser, testPassword);
    await logout(page);
    // After logout, should see the login form
    await expect(page.locator('section:has-text("Sign In")')).toBeVisible();
  });

  test('should maintain session after page reload', async ({ page }) => {
    // Skip if registration failed
    if (!userRegistered) {
      test.skip();
      return;
    }
    await login(page, actualTestUser, testPassword);
    // Wait for login to complete and quiz view to load
    await expect(page.locator('#quiz-select')).toBeVisible({ timeout: 5000 });
    await page.reload();
    await expect(page.locator('#login-logout-btn')).toContainText(actualTestUser, { timeout: 5000 });
  });

  test('should clear user data after logout', async ({ page }) => {
    // Skip if registration failed
    if (!userRegistered) {
      test.skip();
      return;
    }
    // First ensure we're logged in successfully
    await login(page, actualTestUser, testPassword);

    // Wait for quiz view to be visible (indicates successful login)
    await expect(page.locator('#quiz-select')).toBeVisible({ timeout: 5000 });
    await page.waitForTimeout(500);

    // Verify initial storage state
    const initialStorage = await page.evaluate(() => {
      const token = localStorage.getItem('token');
      const username = localStorage.getItem('username');
      const tokenExpiration = localStorage.getItem('tokenExpiration');
      return {
        token,
        username,
        tokenExpiration,
        hasToken: !!token,
        hasUsername: !!username,
        hasExpiration: !!tokenExpiration,
      };
    });

    expect(initialStorage.hasToken, 'Token should be present after login').toBeTruthy();
    expect(initialStorage.hasUsername, 'Username should be present after login').toBeTruthy();
    expect(initialStorage.hasExpiration, 'Token expiration should be present after login').toBeTruthy();

    // Perform logout and wait for navigation
    await logout(page);
    // After logout, should see the login form
    await page.waitForSelector('section:has-text("Sign In")', { state: 'visible' });
    await page.waitForTimeout(1000); // Give time for storage to clear

    // Verify final storage state
    const finalStorage = await page.evaluate(() => ({
      token: localStorage.getItem('token'),
      username: localStorage.getItem('username'),
      tokenExpiration: localStorage.getItem('tokenExpiration'),
    }));

    // Verify storage is cleared
    expect(finalStorage.token, 'Token should be null after logout').toBeNull();
    expect(finalStorage.username, 'Username should be null after logout').toBeNull();
    expect(finalStorage.tokenExpiration, 'Token expiration should be null after logout').toBeNull();
  });

  test('should redirect to login page when accessing protected route', async ({ page, context }) => {
    await context.clearCookies();
    const url = process.env.LINGUA_QUIZ_URL || 'http://localhost:8080';
    await page.goto(`${url}/`);
    // Should see the login form when not authenticated
    await expect(page.locator('section:has-text("Sign In")')).toBeVisible();
  });

  test('should handle server errors gracefully', async ({ page }) => {
    await page.route('**/api/auth/login', (route) => {
      route.fulfill({
        status: 500,
        body: JSON.stringify({ message: 'Internal Server Error' }),
      });
    });

    // Wait for login section to be visible
    const loginSection = page.locator('section:has-text("Sign In")');
    await expect(loginSection).toBeVisible();

    // Fill form fields with explicit waits
    const usernameInput = loginSection.locator('input[placeholder="Username"]');
    await expect(usernameInput).toBeVisible();
    await usernameInput.fill(actualTestUser);

    const passwordInput = loginSection.locator('input[id="password"]');
    await expect(passwordInput).toBeVisible();
    await passwordInput.fill(testPassword);

    // Use a more specific button selector and wait for it to be actionable
    const submitButton = loginSection.locator('button[type="submit"]');
    await expect(submitButton).toBeVisible();
    await expect(submitButton).toBeEnabled();

    // Firefox-friendly click with force option
    await submitButton.click({ force: true });

    await expect(page.locator('text=Internal Server Error')).toBeVisible({ timeout: 2000 });
  });

  test('should not allow access to protected routes after logout', async ({ page }) => {
    // Skip if registration failed
    if (!userRegistered) {
      test.skip();
      return;
    }
    // Login first
    await login(page, actualTestUser, testPassword);

    // Wait for quiz view to be visible (indicates successful login)
    await expect(page.locator('#quiz-select')).toBeVisible({ timeout: 5000 });

    // Verify we're logged in
    await expect(page.locator('#login-logout-btn')).toContainText(actualTestUser);

    // Logout and wait for navigation
    await page.click('#login-logout-btn');
    // After logout, should see the login form
    await page.waitForSelector('section:has-text("Sign In")', { state: 'visible' });
    await page.waitForTimeout(1000); // Ensure storage is cleared

    // Try to access protected route and verify redirect
    const url = process.env.LINGUA_QUIZ_URL || 'http://localhost:8080';
    await page.goto(`${url}/`);
    // After logout, should see the login form
    await page.waitForSelector('section:has-text("Sign In")', { state: 'visible' });
    await expect(page.locator('section:has-text("Sign In")')).toBeVisible();
  });

  test('should redirect to login when token is invalid', async ({ page }) => {
    // Set invalid token
    await page.evaluate(() => {
      localStorage.setItem('token', 'invalid-token');
      localStorage.setItem('username', 'testuser');
    });

    const url = process.env.LINGUA_QUIZ_URL || 'http://localhost:8080';
    await page.goto(`${url}/`);
    // After logout, should see the login form
    await page.waitForSelector('section:has-text("Sign In")', { state: 'visible' });
    await expect(page.locator('section:has-text("Sign In")')).toBeVisible();
  });

  test('should redirect to login when token is expired', async ({ page }) => {
    // Set expired token (JWT with past expiration)
    const expiredToken = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJleHAiOjE1MTYyMzkwMjJ9.4MW7_-gqkqOvHhBwpLI9T0x3DFDpOozqQok9rev4XxY';

    await page.evaluate((token) => {
      localStorage.setItem('token', token);
      localStorage.setItem('username', 'testuser');
    }, expiredToken);

    const url = process.env.LINGUA_QUIZ_URL || 'http://localhost:8080';
    await page.goto(`${url}/`);
    // After logout, should see the login form
    await page.waitForSelector('section:has-text("Sign In")', { state: 'visible' });
    await expect(page.locator('section:has-text("Sign In")')).toBeVisible();
  });

  test('should redirect to login when token is missing', async ({ page }) => {
    // Clear any existing tokens
    await page.evaluate(() => {
      localStorage.clear();
    });

    const url = process.env.LINGUA_QUIZ_URL || 'http://localhost:8080';
    await page.goto(`${url}/`);
    // After logout, should see the login form
    await page.waitForSelector('section:has-text("Sign In")', { state: 'visible' });
    await expect(page.locator('section:has-text("Sign In")')).toBeVisible();
  });

  test('cleanup: delete test user', async ({ page }) => {
    // Skip if user was never registered
    if (!userRegistered) {
      test.skip();
      return;
    }

    // Login to the test account
    await login(page, actualTestUser, testPassword);
    await expect(page.locator('#quiz-select')).toBeVisible({ timeout: 5000 });

    // Delete the account via API call
    const token = await page.evaluate(() => localStorage.getItem('token'));
    const apiUrl = process.env.API_URL || 'http://localhost:9000/api';

    interface DeleteResponse {
      status: number;
      ok: boolean;
    }

    const response = await page.evaluate(
      async ({ token, apiUrl }): Promise<DeleteResponse> => {
        const response = await fetch(`${apiUrl}/auth/delete-account`, {
          method: 'DELETE',
          headers: {
            Authorization: `Bearer ${token}`,
            'Content-Type': 'application/json',
          },
        });
        return { status: response.status, ok: response.ok };
      },
      { token, apiUrl }
    );

    expect(response.ok).toBeTruthy();
  });
});
