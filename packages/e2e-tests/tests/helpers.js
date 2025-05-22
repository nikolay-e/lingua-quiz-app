const { expect } = require('@playwright/test');

async function register(page, email, password, success) {
  // Log all network requests
  page.on('request', (request) => {
    // eslint-disable-next-line no-console
    console.log('>>>', request.method(), request.url());
  });

  page.on('response', (response) => {
    // eslint-disable-next-line no-console
    console.log('<<<', response.status(), response.url());
  });

  // Log console messages from the page
  page.on('console', (msg) => {
    // eslint-disable-next-line no-console
    console.log('PAGE LOG:', msg.text());
  });

  // Use environment variable or fallback URL
  const baseURL = process.env.LINGUA_QUIZ_URL || 'http://localhost:8080';
  await page.goto(`${baseURL}/login.html`);
  await page.fill('#register-email', email);
  await page.fill('#register-password', password);
  // Wait for password validation to complete
  await page.waitForTimeout(500); // Give time for validation

  // Debug: Check if the button is enabled before clicking
  const submitButton = page.locator('#register-form button[type="submit"]');
  const isDisabled = await submitButton.isDisabled();
  // eslint-disable-next-line no-console
  console.log(`Register button disabled: ${isDisabled}`);

  // Wait for network idle before clicking
  await page.waitForLoadState('networkidle');
  await submitButton.click();

  // Wait for response
  await page.waitForTimeout(1000);

  if (success !== undefined) {
    const message = success ? 'Registration successful' : 'Error';
    // Debug: Take screenshot before checking for message
    await page.screenshot({ path: `register-${success ? 'success' : 'error'}-${Date.now()}.png` });

    // Get page content for debugging
    const content = await page.content();
    // eslint-disable-next-line no-console
    console.log('Page contains "Registration":', content.includes('Registration'));
    // eslint-disable-next-line no-console
    console.log('Page contains "successful":', content.includes('successful'));

    await expect(page.locator(`text=${message}`)).toBeVisible({ timeout: 10000 });
  }
}

async function login(page, email, password) {
  // Use environment variable or fallback URL
  const baseURL = process.env.LINGUA_QUIZ_URL || 'http://localhost:8080';
  await page.goto(`${baseURL}/login.html`);
  await page.fill('#email', email);
  await page.fill('#password', password);
  await page.click('#login-form button[type="submit"]');
  // Wait for either successful login or error message
  // Use a more flexible URL pattern that works with different base URLs
  await Promise.race([
    page.waitForURL((url) => !url.pathname.includes('login'), { timeout: 10000 }),
    page.waitForSelector('text=Error', { timeout: 10000 }),
  ]);
}

async function logout(page) {
  // Make sure we're waiting for the button to be both visible and clickable
  const logoutButton = page.locator('#login-logout-btn');
  await logoutButton.waitFor({ state: 'visible', timeout: 10000 });
  await Promise.all([page.waitForURL(/.*login.html/), logoutButton.click()]);
  await expect(page.locator('#login-form')).toBeVisible();
}

async function selectQuiz(page, quizName) {
  await page.selectOption('#quiz-select', quizName);
  await expect(page.locator('#word')).not.toBeEmpty();
  await expect(page.locator('#level-1-list')).not.toBeEmpty();
}

module.exports = {
  register,
  login,
  logout,
  selectQuiz,
};
