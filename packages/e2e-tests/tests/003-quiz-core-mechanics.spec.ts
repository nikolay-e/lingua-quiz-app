import { test, expect } from '@playwright/test';
import { register, login } from './helpers';

test.describe.serial('Quiz Core Mechanics', () => {
  const testUser = `core_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;
  const testPassword = 'testPassword123!';
  let userRegistered = false;

  test.beforeEach(async ({ page }) => {
    page.setDefaultTimeout(30000);

    // Use environment variable or fallback URL
    const baseURL = process.env.LINGUA_QUIZ_URL || 'http://localhost:8080';
    await page.goto(baseURL);
  });

  test('should register and setup test environment', async ({ page }) => {
    await register(page, testUser, testPassword, true);
    userRegistered = true;

    // Setup quiz for subsequent tests
    await page.selectOption('#quiz-select', 'German Russian A1');
    await page.waitForSelector('#word', { state: 'visible', timeout: 5000 });

    // Wait for quiz to be fully loaded
    await page.waitForFunction(() => {
      const headers = document.querySelectorAll('.foldable-header');
      return headers.length >= 6 && Array.from(headers).some(h => h.textContent?.match(/\([1-9]\d*\)/));
    }, { timeout: 5000 });
  });


  test('should display "Incorrect" feedback for a wrong answer', async ({ page }) => {
    if (!userRegistered) {
      test.skip();
    }
    await login(page, testUser, testPassword);
    await page.selectOption('#quiz-select', 'German Russian A1');
    await page.waitForSelector('#word', { state: 'visible' });

    // Submit wrong answer
    const wrongAnswer = 'wronganswer123';
    await page.fill('#answer', wrongAnswer);
    await page.press('#answer', 'Enter');

    // Wait for feedback
    await page.waitForSelector('.feedback-text', { state: 'visible', timeout: 5000 });

    // Verify incorrect feedback shows cross/X icon
    await expect(page.locator('.feedback-text.error .feedback-icon')).toBeVisible();

    // Verify feedback has error styling (red)
    const feedbackClass = await page.locator('.feedback-text').getAttribute('class');
    expect(feedbackClass).toContain('error');
  });




  test('cleanup: delete test user', async ({ page }) => {
    if (!userRegistered) {
      test.skip();
    }

    // Login to the test account
    await login(page, testUser, testPassword);
    await expect(page.locator('#quiz-select')).toBeVisible({ timeout: 5000 });

    // Delete the account via API call
    const token = await page.evaluate(() => localStorage.getItem('token'));
    const apiUrl = process.env.API_URL || 'http://localhost:9000/api';

    interface DeleteResponse {
      status: number;
      ok: boolean;
    }

    const response = await page.evaluate(async ({ token, apiUrl }): Promise<DeleteResponse> => {
      const response = await fetch(`${apiUrl}/auth/delete-account`, {
        method: 'DELETE',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        }
      });
      return { status: response.status, ok: response.ok };
    }, { token, apiUrl });

    expect(response.ok).toBeTruthy();
  });
});
