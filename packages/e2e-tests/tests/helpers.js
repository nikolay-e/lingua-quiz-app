/* eslint-disable no-useless-catch */
const { expect } = require('@playwright/test');

async function withRetry(fn, retries = 3) {
  for (let i = 0; i < retries; i++) {
    try {
      return await fn();
    } catch (error) {
      if (i === retries - 1) throw error;
      await new Promise(resolve => setTimeout(resolve, 1000));
    }
  }
}

async function register(page, email, password, success) {

  // Use environment variable or fallback URL
  const baseURL = process.env.LINGUA_QUIZ_URL || 'http://localhost:8080';
  
  try {
    await withRetry(async () => {
      await page.goto(baseURL, { waitUntil: 'domcontentloaded', timeout: 30000 });
    });
  } catch (error) {
    throw error;
  }
  
  // First check if we're on login page and need to navigate to register
  try {
    await page.waitForSelector('section:has-text("Sign In")', { state: 'visible', timeout: 2000 });
    // Click on "Register here" link
    await page.click('button:has-text("Register here")');
    // Wait for register page to load
    await page.waitForSelector('section:has-text("Create Account")', { state: 'visible', timeout: 2000 });
  } catch (error) {
    // Check if we're already on register page
    try {
      await page.waitForSelector('section:has-text("Create Account")', { state: 'visible', timeout: 2000 });
    } catch (error2) {
      throw error2;
    }
  }
  
  // Find the email and password inputs within the register section
  const registerSection = page.locator('section:has-text("Create Account")');
  
  // Wait for inputs to be ready
  await registerSection.locator('input[type="email"]').waitFor({ state: 'visible', timeout: 5000 });
  await registerSection.locator('input[id="register-password"]').waitFor({ state: 'visible', timeout: 5000 });
  
  await registerSection.locator('input[type="email"]').fill(email);
  await registerSection.locator('input[id="register-password"]').fill(password);
  // Wait for password validation to complete
  await page.waitForTimeout(500); // Give time for validation

  // Debug: Check if the button is enabled before clicking
  const submitButton = registerSection.locator('button[type="submit"]');

  // Wait for network idle before clicking
  await page.waitForLoadState('networkidle');
  
  // Click with retry for Firefox compatibility
  try {
    await submitButton.click({ timeout: 15000 });
  } catch (error) {
    // Retry with force click if normal click fails
    await submitButton.click({ force: true });
  }

  // Wait for response with longer timeout for slower networks
  await page.waitForTimeout(1500);

  if (success !== undefined) {
    if (success) {
      // Look for success message in the register section
      await expect(page.locator('#register-message')).toContainText('successful', { timeout: 5000 });
    } else {
      // Look for error message
      await expect(page.locator('#register-message')).toBeVisible({ timeout: 5000 });
      const messageText = await page.locator('#register-message').innerText();
      expect(messageText).not.toContain('successful');
    }
  }
}

async function login(page, email, password) {
  // Use environment variable or fallback URL
  const baseURL = process.env.LINGUA_QUIZ_URL || 'http://localhost:8080';
  
  try {
    await withRetry(async () => {
      await page.goto(baseURL, { waitUntil: 'domcontentloaded', timeout: 30000 });
    });
  } catch (error) {
    throw error;
  }
  
  // Wait for the login form to be visible
  await page.waitForSelector('section:has-text("Sign In")', { state: 'visible', timeout: 2000 });
  
  // Find the email and password inputs within the login section
  const loginSection = page.locator('section:has-text("Sign In")');
  
  // Wait for inputs to be ready
  await loginSection.locator('input[type="email"]').waitFor({ state: 'visible', timeout: 5000 });
  await loginSection.locator('input[id="password"]').waitFor({ state: 'visible', timeout: 5000 });
  
  await loginSection.locator('input[type="email"]').fill(email);
  await loginSection.locator('input[id="password"]').fill(password);
  
  // Wait for submit button to be ready and click with retry for Firefox compatibility
  const submitButton = loginSection.locator('button[type="submit"]');
  await submitButton.waitFor({ state: 'visible', timeout: 5000 });
  await page.waitForTimeout(100); // Small delay for Firefox
  
  try {
    await submitButton.click({ timeout: 15000 }); // Increased timeout for Firefox
  } catch (error) {
    // Retry with force click if normal click fails
    await submitButton.click({ force: true });
  }
  
  // Wait for either successful login (quiz select visible) or error message
  await Promise.race([
    page.waitForSelector('#quiz-select', { state: 'visible', timeout: 10000 }),
    page.waitForSelector('#login-message', { state: 'visible', timeout: 10000 }),
  ]);
}

async function logout(page) {
  // Make sure we're waiting for the button to be both visible and clickable
  const logoutButton = page.locator('#login-logout-btn');
  await logoutButton.waitFor({ state: 'visible', timeout: 5000 });
  // Add a small delay for button to be fully interactive
  await page.waitForTimeout(500);
  await logoutButton.click();
  // After logout, we should see the login form
  await expect(page.locator('section:has-text("Sign In")')).toBeVisible({ timeout: 5000 });
}

async function selectQuiz(page, quizName) {
  await page.selectOption('#quiz-select', quizName);
  // Wait for quiz to load - word should appear
  await page.waitForSelector('#word', { state: 'visible', timeout: 5000 });
  await expect(page.locator('#word')).not.toBeEmpty();
  // Wait for word lists to populate
  await page.waitForTimeout(1500);
}

module.exports = {
  register,
  login,
  logout,
  selectQuiz,
};
