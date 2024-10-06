const { expect } = require('@playwright/test');

async function register(page, email, password) {
  await page.goto('/login.html');
  await page.fill('#register-email', email);
  await page.fill('#register-password', password);
  await page.click('#register-form button[type="submit"]');
}

async function login(page, email, password) {
  await page.goto('/login.html');
  await page.fill('#email', email);
  await page.fill('#password', password);
  await page.click('#login-form button[type="submit"]');
}

async function apiLogin(request, email, password) {
  const response = await request.post('/api/login', {
    data: { email, password },
  });
  expect(response.ok()).toBeTruthy();
  const body = await response.json();
  expect(body).toHaveProperty('token');
  // Note: In Playwright, you can't directly set localStorage.
  // You'll need to handle this in your application code or use a custom command.
}

async function logout(page) {
  const logoutButton = page.locator('#login-logout-btn');
  if (await logoutButton.textContent() === 'Logout') {
    await logoutButton.click();
    await expect(page).toHaveURL(/.*login.html/);
    await expect(page.locator('#login-form')).toBeVisible();
    // Note: In Playwright, you can't directly check localStorage.
    // You'll need to handle this in your application code or use a custom command.
  } else {
    console.log('User was not logged in, skipping logout process');
  }
}

async function selectQuiz(page, quizName) {
  await page.selectOption('#quiz-select', quizName);
  await expect(page.locator('#word')).not.toBeEmpty();
  await expect(page.locator('#focus-words-list')).not.toBeEmpty();
}

async function addWordPair(request, token, listName, sourceWord, targetWord) {
  const generateInt32 = () => Math.floor(Math.random() * 2147483647);
  const response = await request.post('/api/word-pair', {
    headers: {
      Authorization: `Bearer ${token}`,
    },
    data: {
      translationId: generateInt32(),
      sourceWordId: generateInt32(),
      targetWordId: generateInt32(),
      sourceWord,
      targetWord,
      sourceLanguageName: 'English',
      targetLanguageName: 'Spanish',
      wordListName: listName,
      sourceWordUsageExample: `This is an example with ${sourceWord}.`,
      targetWordUsageExample: `Este es un ejemplo con ${targetWord}.`,
    },
  });
  expect(response.status()).toBe(201);
}

module.exports = {
  register,
  login,
  apiLogin,
  logout,
  selectQuiz,
  addWordPair,
};