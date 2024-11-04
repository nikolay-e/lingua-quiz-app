const { test, expect } = require('@playwright/test');
const { register, login, logout } = require('./helpers');

test.describe('User Authentication', () => {
  const testUser = `test${Date.now()}@example.com`;
  const testPassword = 'testPassword123!';

  test.beforeEach(async ({ page }) => {
    await page.goto('/login.html');
  });

  test('should register a new user', async ({ page }) => {
    await register(page, testUser, testPassword, true);
  });

  test('should not allow duplicate registration', async ({ page }) => {
    await register(page, testUser, testPassword, false);
  });

  test('should login with valid credentials', async ({ page }) => {
    await login(page, testUser, testPassword);
    await page.waitForURL('/', { waitUntil: 'networkidle' });
    await expect(page).toHaveURL('/');
  });

  test('should not login with invalid credentials', async ({ page }) => {
    await login(page, testUser, 'wrongPassword');
    await expect(page.locator('text=Error')).toBeVisible({ timeout: 10000 });
  });

  test('should logout successfully', async ({ page }) => {
    await login(page, testUser, testPassword);
    await logout(page);
    await expect(page).toHaveURL(/.*login.html/);
    await expect(page.locator('#login-form')).toBeVisible();
  });

  test('should maintain session after page reload', async ({ page }) => {
    await login(page, testUser, testPassword);
    await expect(page).toHaveURL('/');
    await page.reload();
    await expect(page.locator('#login-logout-btn')).toContainText(testUser, { timeout: 10000 });
  });

  test('should clear user data after logout', async ({ page }) => {
    // First ensure we're logged in successfully
    await login(page, testUser, testPassword);

    // Wait for navigation and storage to be set
    await page.waitForURL('/', { waitUntil: 'networkidle' });
    await page.waitForTimeout(1000);

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
    expect(
      initialStorage.hasExpiration,
      'Token expiration should be present after login'
    ).toBeTruthy();

    // Perform logout and wait for navigation
    await logout(page);
    await page.waitForURL(/.*login.html/, { waitUntil: 'networkidle' });
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

  test('should redirect to login page when accessing protected route', async ({
    page,
    context,
  }) => {
    await context.clearCookies();
    await page.goto('/');
    await expect(page).toHaveURL(/.*login.html/);
  });

  test('should handle server errors gracefully', async ({ page }) => {
    await page.route('**/login', (route) => {
      route.fulfill({
        status: 500,
        body: JSON.stringify({ message: 'Internal Server Error' }),
      });
    });
    await page.fill('#email', testUser);
    await page.fill('#password', testPassword);
    await page.click('#login-form button[type="submit"]');
    await expect(page.locator('text=Internal Server Error')).toBeVisible({ timeout: 10000 });
  });

  test('should not allow access to protected routes after logout', async ({ page }) => {
    // Login first
    await login(page, testUser, testPassword);

    // Wait for navigation and verify we're on the home page
    await page.waitForURL('/', { waitUntil: 'networkidle' });

    // Verify we're logged in
    await expect(page.locator('#login-logout-btn')).toContainText(testUser);

    // Logout and wait for navigation
    await page.click('#login-logout-btn');
    await page.waitForURL(/.*login.html/, { waitUntil: 'networkidle' });
    await page.waitForTimeout(1000); // Ensure storage is cleared

    // Try to access protected route and verify redirect
    await page.goto('/');
    await page.waitForURL(/.*login.html/, { waitUntil: 'networkidle' });
    await expect(page.locator('#login-form')).toBeVisible();
  });

  test('should redirect to login when token is invalid', async ({ page }) => {
    // Set invalid token
    await page.evaluate(() => {
      localStorage.setItem('token', 'invalid-token');
      localStorage.setItem('email', 'test@example.com');
    });

    await page.goto('/');
    await page.waitForURL(/.*login.html/, { waitUntil: 'networkidle' });
    await expect(page.locator('#login-form')).toBeVisible();
  });

  test('should redirect to login when token is expired', async ({ page }) => {
    // Set expired token (JWT with past expiration)
    const expiredToken =
      'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJleHAiOjE1MTYyMzkwMjJ9.4MW7_-gqkqOvHhBwpLI9T0x3DFDpOozqQok9rev4XxY';

    await page.evaluate((token) => {
      localStorage.setItem('token', token);
      localStorage.setItem('email', 'test@example.com');
    }, expiredToken);

    await page.goto('/');
    await page.waitForURL(/.*login.html/, { waitUntil: 'networkidle' });
    await expect(page.locator('#login-form')).toBeVisible();
  });

  test('should redirect to login when token is missing', async ({ page }) => {
    // Clear any existing tokens
    await page.evaluate(() => {
      localStorage.clear();
    });

    await page.goto('/');
    await page.waitForURL(/.*login.html/, { waitUntil: 'networkidle' });
    await expect(page.locator('#login-form')).toBeVisible();
  });
});
