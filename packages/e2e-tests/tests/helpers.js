const { expect } = require('@playwright/test');

async function withRetry(fn, retries = 3) {
  for (let i = 0; i < retries; i++) {
    try {
      return await fn();
    } catch (error) {
      if (i === retries - 1) throw error;
      // eslint-disable-next-line no-console
      console.log(`Retry ${i + 1}/${retries} after error:`, error.message);
      await new Promise(resolve => setTimeout(resolve, 1000));
    }
  }
}

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
  
  try {
    await withRetry(async () => {
      await page.goto(baseURL, { waitUntil: 'domcontentloaded', timeout: 30000 });
    });
  } catch (error) {
    // eslint-disable-next-line no-console
    console.error('Failed to navigate to:', baseURL, error.message);
    throw error;
  }
  
  // Wait for the registration form to be visible
  try {
    await page.waitForSelector('section:has-text("Register")', { state: 'visible', timeout: 2000 });
  } catch (error) {
    // eslint-disable-next-line no-console
    console.error('Registration form not found. Page content:', await page.content().then(c => c.substring(0, 500)));
    throw error;
  }
  
  // Find the email and password inputs within the register section
  const registerSection = page.locator('section:has-text("Register")');
  
  // Wait for inputs to be ready
  await registerSection.locator('input[type="email"]').waitFor({ state: 'visible', timeout: 5000 });
  await registerSection.locator('input[id="register-password"]').waitFor({ state: 'visible', timeout: 5000 });
  
  await registerSection.locator('input[type="email"]').fill(email);
  await registerSection.locator('input[id="register-password"]').fill(password);
  // Wait for password validation to complete
  await page.waitForTimeout(500); // Give time for validation

  // Debug: Check if the button is enabled before clicking
  const submitButton = registerSection.locator('button[type="submit"]');
  const isDisabled = await submitButton.isDisabled();
  // eslint-disable-next-line no-console
  console.log(`Register button disabled: ${isDisabled}`);

  // Wait for network idle before clicking
  await page.waitForLoadState('networkidle');
  await submitButton.click();

  // Wait for response
  await page.waitForTimeout(1000);

  if (success !== undefined) {
    if (success) {
      // Look for success message in the register section
      await expect(page.locator('#register-message')).toContainText('successful', { timeout: 2000 });
    } else {
      // Look for error message
      await expect(page.locator('#register-message')).toBeVisible({ timeout: 2000 });
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
    // eslint-disable-next-line no-console
    console.error('Failed to navigate to:', baseURL, error.message);
    throw error;
  }
  
  // Wait for the login form to be visible
  await page.waitForSelector('section:has-text("Login")', { state: 'visible', timeout: 2000 });
  
  // Find the email and password inputs within the login section
  const loginSection = page.locator('section:has-text("Login")');
  
  // Wait for inputs to be ready
  await loginSection.locator('input[type="email"]').waitFor({ state: 'visible', timeout: 5000 });
  await loginSection.locator('input[id="password"]').waitFor({ state: 'visible', timeout: 5000 });
  
  await loginSection.locator('input[type="email"]').fill(email);
  await loginSection.locator('input[id="password"]').fill(password);
  await loginSection.locator('button[type="submit"]').click();
  // Wait for either successful login (quiz select visible) or error message
  await Promise.race([
    page.waitForSelector('#quiz-select', { state: 'visible', timeout: 5000 }),
    page.waitForSelector('#login-message', { state: 'visible', timeout: 5000 }),
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
  await expect(page.locator('section:has-text("Login")')).toBeVisible({ timeout: 5000 });
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
