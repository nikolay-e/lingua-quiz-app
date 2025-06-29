import { test, expect } from '@playwright/test';
import { register, login } from './helpers';
import { MAX_FOCUS_POOL_SIZE } from '@linguaquiz/core';

test.describe.serial('Quiz Initialization', () => {
  const testUser = `init_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;
  const testPassword = 'testPassword123!';
  let userRegistered = false;

  test.beforeEach(async ({ page }) => {
    page.setDefaultTimeout(30000);
    
    // Use environment variable or fallback URL
    const baseURL = process.env.LINGUA_QUIZ_URL || 'http://localhost:8080';
    await page.goto(baseURL);
  });

  test('should register and login test user', async ({ page }) => {
    await register(page, testUser, testPassword, true);
    userRegistered = true;
  });

  test('should display available quizzes after login', async ({ page }) => {
    if (!userRegistered) {
      test.skip();
    }
    await login(page, testUser, testPassword);

    // Check that the quiz selector is visible
    await expect(page.locator('#quiz-select')).toBeVisible({ timeout: 5000 });

    // Wait for quiz options to be loaded (more than just the default option)
    await page.waitForFunction(() => {
      const select = document.querySelector('#quiz-select') as HTMLSelectElement;
      return select && select.options.length > 1;
    }, { timeout: 10000 });

    // Check that quiz options are available
    const quizOptions = await page.locator('#quiz-select option').allTextContents();
    expect(quizOptions.length).toBeGreaterThan(1); // At least the default option + one quiz
    
    // Verify specific quiz exists
    expect(quizOptions).toContain('German Russian A1');
  });

  test('should start a quiz and display word lists', async ({ page }) => {
    if (!userRegistered) {
      test.skip();
    }
    await login(page, testUser, testPassword);

    // Select a quiz
    await page.selectOption('#quiz-select', 'German Russian A1');
    
    // Wait for the quiz to load
    await page.waitForSelector('#word', { state: 'visible', timeout: 5000 });
    
    // Verify word display elements exist
    await expect(page.locator('#word')).toBeVisible();
    await expect(page.locator('#answer')).toBeVisible();
    
    // Wait for word lists to populate
    await page.waitForFunction(() => {
      const headers = document.querySelectorAll('.foldable-header');
      return headers.length >= 6 && Array.from(headers).some(h => h.textContent?.match(/\([1-9]\d*\)/));
    }, { timeout: 5000 });

    // Verify all level headers are present (check for descriptive text instead of exact level numbers)
    const levelHeaders = ['Learning', 'Translation Mastered One Way', 'Translation Mastered Both Ways', 'Examples Mastered One Way', 'Fully Mastered', 'New'];
    for (const header of levelHeaders) {
      await expect(page.locator(`.foldable-header:has-text("${header}")`)).toBeVisible();
    }
  });

  test('should correctly populate the focus pool (Level 1)', async ({ page }) => {
    if (!userRegistered) {
      test.skip();
    }
    await login(page, testUser, testPassword);

    // Select a quiz
    await page.selectOption('#quiz-select', 'German Russian A1');
    await page.waitForSelector('#word', { state: 'visible', timeout: 5000 });
    
    // Wait for word lists to populate
    await page.waitForFunction(() => {
      const headers = document.querySelectorAll('.foldable-header');
      return headers.length >= 6 && Array.from(headers).some(h => h.textContent?.match(/\([1-9]\d*\)/));
    }, { timeout: 5000 });

    // Get Level 1 count from header
    const level1HeaderText = await page.locator('#level-1 h3').innerText();
    const match = level1HeaderText.match(/\((\d+)\)/);
    const level1Count = match ? parseInt(match[1], 10) : 0;
    
    // Verify Level 1 has a reasonable initial count (not more than MAX_FOCUS_POOL_SIZE as per business logic)
    expect(level1Count).toBeGreaterThan(0);
    expect(level1Count).toBeLessThanOrEqual(MAX_FOCUS_POOL_SIZE);
    
    // Verify first question is shown
    const firstQuestion = await page.locator('#word').innerText();
    expect(firstQuestion.trim()).not.toBe('');
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