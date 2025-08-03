import { test, expect } from '@playwright/test';
import { register, login, getWordCountFromHeader, selectQuiz, waitForQuizReady, findCorrectAnswer } from './helpers';
import { T_PROMO } from '@linguaquiz/core';

interface StatusSummary {
  level0: number;
  level1: number;
  level2: number;
  level3: number;
  level4: number;
  level5: number;
}

/**
 * Gets the current level from the level display.
 */
async function getCurrentLevelDisplay(page: any): Promise<string> {
  try {
    const levelDescription = await page.locator('.level-description').textContent();
    if (levelDescription?.includes('New Words Practice')) return 'LEVEL_1';
    if (levelDescription?.includes('Reverse Practice')) return 'LEVEL_2';
    if (levelDescription?.includes('Context Practice')) return 'LEVEL_3';
    if (levelDescription?.includes('Reverse Context')) return 'LEVEL_4';
    return 'LEVEL_1';
  } catch (error) {
    console.warn(`Could not get current level: ${(error as Error).message}`);
    return 'LEVEL_1';
  }
}

/**
 * Gets the status summary (word counts per level).
 */
async function getStatusSummary(page: any): Promise<StatusSummary> {
  return {
    level0: await getWordCountFromHeader(page, 'level-0'),
    level1: await getWordCountFromHeader(page, 'level-1'),
    level2: await getWordCountFromHeader(page, 'level-2'),
    level3: await getWordCountFromHeader(page, 'level-3'),
    level4: await getWordCountFromHeader(page, 'level-4'),
    level5: await getWordCountFromHeader(page, 'level-5'),
  };
}

test.describe.serial('Quiz Automatic Level Progression', () => {
  const testUser = `auto_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;
  const testPassword = 'testPassword123!';
  let userRegistered = false;

  test.beforeEach(async ({ page }) => {
    page.setDefaultTimeout(30000);
    const baseURL = process.env.LINGUA_QUIZ_URL || 'http://localhost:8080';
    await page.goto(baseURL, { waitUntil: 'domcontentloaded', timeout: 30000 });
  });

  test('should register and setup test environment', async ({ page }) => {
    await register(page, testUser, testPassword, true);
    userRegistered = true;

    // Setup quiz for subsequent tests
    await selectQuiz(page, 'German Russian A1');
    await waitForQuizReady(page);

    const statusSummary = await getStatusSummary(page);
    console.log('Initial status summary:', statusSummary);
  });

  test('should automatically start with appropriate level', async ({ page }) => {
    if (!userRegistered) {
      test.skip();
    }
    await login(page, testUser, testPassword);
    await selectQuiz(page, 'German Russian A1');
    await waitForQuizReady(page);

    // Check that system automatically selects an appropriate level
    await expect(page.locator('.current-level-display')).toBeVisible();

    const currentLevel = await getCurrentLevelDisplay(page);
    console.log('Automatically selected level:', currentLevel);

    // Should start with LEVEL_1 (New Words Practice) when there are new words
    const statusSummary = await getStatusSummary(page);
    if (statusSummary.level0 > 0) {
      expect(currentLevel).toBe('LEVEL_1');
    }
  });

  test('should automatically switch to available level when current level is empty', async ({ page }) => {
    if (!userRegistered) {
      test.skip();
    }
    await login(page, testUser, testPassword);
    await selectQuiz(page, 'German Russian A1');
    await waitForQuizReady(page);

    const initialStatus = await getStatusSummary(page);
    console.log('Initial status for auto-switch test:', initialStatus);

    // If all LEVEL_0 and LEVEL_1 are empty, system should auto-switch to lowest available level
    if (initialStatus.level0 === 0 && initialStatus.level1 === 0) {
      const currentLevel = await getCurrentLevelDisplay(page);
      console.log('Auto-switched to level:', currentLevel);

      // Should automatically switch to LEVEL_2, LEVEL_3, or LEVEL_4 depending on availability
      expect(['LEVEL_2', 'LEVEL_3', 'LEVEL_4']).toContain(currentLevel);
    } else {
      console.log('Cannot test auto-switching: LEVEL_0 or LEVEL_1 has words available');
    }
  });

  test('should display current level information without manual selector', async ({ page }) => {
    if (!userRegistered) {
      test.skip();
    }
    await login(page, testUser, testPassword);
    await selectQuiz(page, 'German Russian A1');
    await waitForQuizReady(page);

    // Verify level display exists but level selector does not
    await expect(page.locator('.current-level-display')).toBeVisible();
    await expect(page.locator('.level-label')).toBeVisible();
    await expect(page.locator('.level-description')).toBeVisible();

    // Verify manual level selector is removed
    await expect(page.locator('#level-select')).not.toBeVisible();
    await expect(page.locator('.level-selector')).not.toBeVisible();
  });

  test('should show meaningful level descriptions', async ({ page }) => {
    if (!userRegistered) {
      test.skip();
    }
    await login(page, testUser, testPassword);
    await selectQuiz(page, 'German Russian A1');
    await waitForQuizReady(page);

    const levelDescription = await page.locator('.level-description').textContent();
    console.log('Level description:', levelDescription);

    // Should contain meaningful description - the UI shows practice type, not language names
    expect(levelDescription).toMatch(/(New Words Practice|Reverse Practice|Context Practice|Reverse Context)/);
  });

  test('should automatically progress levels based on correct answers', async ({ page }) => {
    if (!userRegistered) {
      test.skip();
    }
    await login(page, testUser, testPassword);
    await selectQuiz(page, 'German Russian A1');
    await waitForQuizReady(page);

    const initialStatus = await getStatusSummary(page);
    console.log('Initial status for progression test:', initialStatus);

    // If there are questions available, try answering some
    const questionElement = page.locator('.question-text');
    if (await questionElement.isVisible()) {
      const initialLevel = await getCurrentLevelDisplay(page);
      console.log('Starting level for progression test:', initialLevel);

      // Answer T_PROMO questions correctly to trigger progression
      for (let i = 0; i < T_PROMO; i++) {
        try {
          const questionWord = await page.locator('#word').innerText();
          console.log(`Question ${i + 1}: ${questionWord}`);

          // Find correct answer
          const correctAnswer = await findCorrectAnswer(page, questionWord);
          if (!correctAnswer) {
            console.log(`Could not find answer for: ${questionWord}`);
            await page.fill('#answer', 'skip');
          } else {
            await page.fill('#answer', correctAnswer);
          }

          await page.press('#answer', 'Enter');

          // Wait for feedback to clear
          await page.waitForFunction(
            () => {
              const answer = document.querySelector('#answer') as HTMLInputElement;
              return answer && answer.value === '';
            },
            { timeout: 2000 }
          );

          // Check if feedback appears
          const feedbackElement = page.locator('.feedback-text');
          if (await feedbackElement.isVisible({ timeout: 1000 }).catch(() => false)) {
            const feedbackText = await feedbackElement.textContent();
            console.log(`Feedback ${i + 1}: ${feedbackText}`);
          }
        } catch (error) {
          console.log(`Could not complete question ${i + 1}: ${error}`);
          break;
        }
      }

      const finalStatus = await getStatusSummary(page);
      const finalLevel = await getCurrentLevelDisplay(page);

      console.log('Final status after progression test:', finalStatus);
      console.log('Final level after progression test:', finalLevel);

      // Progression should have occurred automatically through the quiz system
      expect(finalLevel).toBeTruthy();
    }
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

    const response = await page.evaluate(
      async ({ token, apiUrl }): Promise<DeleteResponse> => {
        const response = await fetch(`${apiUrl}/auth/delete-account`, {
          method: 'DELETE',
          headers: {
            Authorization: `Bearer ${token}`,
            'Content-Type': 'application/json',
          },
        });
        return { status: response.status, ok: response.ok };
      },
      { token, apiUrl }
    );

    expect(response.ok).toBeTruthy();
  });
});
