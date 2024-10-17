const { expect } = require('@playwright/test');

async function register(page, email, password, success) {
  await page.goto('/login.html');
  await page.fill('#register-email', email);
  await page.fill('#register-password', password);
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
}

async function logout(page) {
  const logoutButton = page.locator('#login-logout-btn');
  await logoutButton.click();
  await expect(page).toHaveURL(/.*login.html/);
  await expect(page.locator('#login-form')).toBeVisible();
}

async function selectQuiz(page, quizName) {
  await page.selectOption('#quiz-select', quizName);
  await expect(page.locator('#word')).not.toBeEmpty();
  await expect(page.locator('#focus-words-list')).not.toBeEmpty();
}

module.exports = {
  register,
  login,
  logout,
  selectQuiz,
};
