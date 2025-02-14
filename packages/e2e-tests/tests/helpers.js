const { expect } = require('@playwright/test');

async function register(page, email, password, success) {
  await page.goto('/login.html');
  await page.fill('#register-email', email);
  await page.fill('#register-password', password);
  // Wait for password validation to complete
  await page.waitForTimeout(500); // Give time for validation
  await page.click('#register-form button[type="submit"]');
  if (success !== undefined) {
    const message = success ? 'Registration successful' : 'Error';
    await expect(page.locator(`text=${message}`)).toBeVisible({ timeout: 10000 });
  }
}

async function login(page, email, password) {
  await page.goto('/login.html');
  await page.fill('#email', email);
  await page.fill('#password', password);
  await page.click('#login-form button[type="submit"]');
  // Wait for either successful login or error message
  await Promise.race([
    page.waitForURL('/'),
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
