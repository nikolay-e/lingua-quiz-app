const { test, expect } = require('@playwright/test');
const { register, login, logout } = require('./helpers');

test.describe.serial('User Authentication', () => {
  // Generate a unique user for this test suite
  const timestamp = Date.now();
  const testUser = `test${timestamp}@example.com`;
  const testPassword = 'testPassword123!';

  // Track if user has been registered
  let userRegistered = false;

  test.beforeEach(async ({ page }) => {
    // Use environment variable directly since baseURL is not being set
    const url = process.env.LINGUA_QUIZ_URL || 'http://localhost:8080';
    // eslint-disable-next-line no-console
    console.log('Using URL:', url);
    await page.goto(url);
  });

  test('should register a new user', async ({ page }) => {
    await register(page, testUser, testPassword, true);
    userRegistered = true;
  });

  test('should not allow duplicate registration', async ({ page }) => {
    // Skip if previous test failed
    if (!userRegistered) {
      test.skip();
      return;
    }
    await register(page, testUser, testPassword, false);
  });

  test('should login with valid credentials', async ({ page }) => {
    // Skip if registration failed
    if (!userRegistered) {
      test.skip();
      return;
    }
    await login(page, testUser, testPassword);
    // In a SPA, we check for the quiz select element instead of URL
    await expect(page.locator('#quiz-select')).toBeVisible();
  });

  test('should not login with invalid credentials', async ({ page }) => {
    // Skip if registration failed
    if (!userRegistered) {
      test.skip();
      return;
    }
    await login(page, testUser, 'wrongPassword');
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
    await login(page, testUser, testPassword);
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
    await login(page, testUser, testPassword);
    // Wait for login to complete and quiz view to load
    await expect(page.locator('#quiz-select')).toBeVisible({ timeout: 5000 });
    await page.reload();
    await expect(page.locator('#login-logout-btn')).toContainText(testUser, { timeout: 5000 });
  });

  test('should clear user data after logout', async ({ page }) => {
    // Skip if registration failed
    if (!userRegistered) {
      test.skip();
      return;
    }
    // First ensure we're logged in successfully
    await login(page, testUser, testPassword);

    // Wait for quiz view to be visible (indicates successful login)
    await expect(page.locator('#quiz-select')).toBeVisible({ timeout: 5000 });
    await page.waitForTimeout(500);

    // Verify initial storage state
    const initialStorage = await page.evaluate(() => {
      const token = localStorage.getItem('token');
      const email = localStorage.getItem('email');
      const tokenExpiration = localStorage.getItem('tokenExpiration');
      return {
        token,
        email,
        tokenExpiration,
        hasToken: !!token,
        hasEmail: !!email,
        hasExpiration: !!tokenExpiration,
      };
    });

    expect(initialStorage.hasToken, 'Token should be present after login').toBeTruthy();
    expect(initialStorage.hasEmail, 'Email should be present after login').toBeTruthy();
    expect(initialStorage.hasExpiration, 'Token expiration should be present after login').toBeTruthy();

    // Perform logout and wait for navigation
    await logout(page);
    // After logout, should see the login form
    await page.waitForSelector('section:has-text("Sign In")', { state: 'visible' });
    await page.waitForTimeout(1000); // Give time for storage to clear

    // Verify final storage state
    const finalStorage = await page.evaluate(() => ({
      token: localStorage.getItem('token'),
      email: localStorage.getItem('email'),
      tokenExpiration: localStorage.getItem('tokenExpiration'),
    }));

    // Verify storage is cleared
    expect(finalStorage.token, 'Token should be null after logout').toBeNull();
    expect(finalStorage.email, 'Email should be null after logout').toBeNull();
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
    const loginSection = page.locator('section:has-text("Sign In")');
    await loginSection.locator('input[type="email"]').fill(testUser);
    await loginSection.locator('input[id="password"]').fill(testPassword);
    await loginSection.locator('button[type="submit"]').click();
    await expect(page.locator('text=Internal Server Error')).toBeVisible({ timeout: 2000 });
  });

  test('should not allow access to protected routes after logout', async ({ page }) => {
    // Skip if registration failed
    if (!userRegistered) {
      test.skip();
      return;
    }
    // Login first
    await login(page, testUser, testPassword);

    // Wait for quiz view to be visible (indicates successful login)
    await expect(page.locator('#quiz-select')).toBeVisible({ timeout: 5000 });

    // Verify we're logged in
    await expect(page.locator('#login-logout-btn')).toContainText(testUser);

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
      localStorage.setItem('email', 'test@example.com');
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
      localStorage.setItem('email', 'test@example.com');
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
});
