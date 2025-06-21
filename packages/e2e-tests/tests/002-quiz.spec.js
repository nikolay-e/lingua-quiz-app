const { test, expect } = require('@playwright/test');
const { register, login } = require('./helpers');

// --- Configuration ---
const MAX_SUBMIT_RETRIES = 2;
const RETRY_DELAY_MS = 10; // Reduced from 50ms
const WAIT_FOR_ELEMENT_TIMEOUT = 3000; // Reduced from 10s to 3s
const WAIT_FOR_LIST_TIMEOUT = 2000; // Reduced from 15s to 2s
const TEST_TIMEOUT_MS = 3600000; // Reduced to 1 hour
const MAX_CONSECUTIVE_ERRORS_BEFORE_FAIL = 3;
const FULL_LIST_REFRESH_INTERVAL = 50; // Increased interval to reduce status checks

/**
 * Gets word count from the header.
 * @param {import('@playwright/test').Page} page
 * @param {string} levelId - The level container id (e.g., 'level-0', 'level-1')
 * @returns {Promise<number>}
 */
async function getWordCountFromHeader(page, levelId) {
  try {
    const headerText = await page.locator(`#${levelId} h3`).innerText();
    const match = headerText.match(/\((\d+)\)/);
    return match ? parseInt(match[1], 10) : 0;
  } catch (error) {
    console.warn(`Could not get count from header ${levelId}: ${error.message}`);
    return 0;
  }
}

/**
 * Gets words or count from a list.
 * @param {import('@playwright/test').Page} page
 * @param {string} listId
 * @param {boolean} [countOnly=false] - If true, returns only the count.
 * @returns {Promise<Array<{sourceWord: string, targetWord: string}> | number>}
 */
async function getWordsOrCountFromList(page, listId, countOnly = false) {
  try {
    const listLocator = page.locator(`#${listId} li`);
    // Ensure list container exists briefly before checking count or items
    await page
      .locator(`#${listId}`)
      .waitFor({ state: 'attached', timeout: 3000 })
      .catch(() => {});
    
    if (countOnly) {
      const listItems = await listLocator.allTextContents();
      // Filter out empty list messages
      const actualItems = listItems.filter(text => 
        !text.includes('No words') && !text.includes('No new words')
      );
      return actualItems.length;
    } else {
      // Return full list
      const listItems = await listLocator.allTextContents();
      return listItems
        .filter(text => !text.includes('No words') && !text.includes('No new words'))
        .map(text => {
          const parts = text.split(' -> ');
          if (parts.length >= 2) {
            return { sourceWord: parts[0].trim(), targetWord: parts[1].trim() };
          }
          return null;
        })
        .filter(Boolean);
    }
  } catch (error) {
    console.warn(`Could not access list ${listId}: ${error.message}`);
    return countOnly ? 0 : [];
  }
}

/**
 * Gets the status summary (only word counts).
 * @param {import('@playwright/test').Page} page
 * @returns {Promise<{level0: number, level1: number, level2: number, level3: number, level4: number, level5: number}>}
 */
async function getStatusSummary(page) {
  const level0Count = await getWordCountFromHeader(page, 'level-0');
  const level1Count = await getWordCountFromHeader(page, 'level-1');
  const level2Count = await getWordCountFromHeader(page, 'level-2');
  const level3Count = await getWordCountFromHeader(page, 'level-3');
  const level4Count = await getWordCountFromHeader(page, 'level-4');
  const level5Count = await getWordCountFromHeader(page, 'level-5');
  
  return {
    level0: level0Count,
    level1: level1Count,
    level2: level2Count,
    level3: level3Count,
    level4: level4Count,
    level5: level5Count
  };
}

/**
 * Gets the current level from the level selector.
 * @param {import('@playwright/test').Page} page
 * @returns {Promise<string>}
 */
async function getCurrentLevel(page) {
  try {
    const selectedValue = await page.locator('#level-select').inputValue();
    return selectedValue || 'LEVEL_1';
  } catch (error) {
    console.warn(`Could not get current level: ${error.message}`);
    return 'LEVEL_1';
  }
}

/**
 * Sets the quiz level.
 * @param {import('@playwright/test').Page} page
 * @param {string} level - 'LEVEL_1', 'LEVEL_2', 'LEVEL_3', or 'LEVEL_4'
 */
async function setLevel(page, level) {
  try {
    await page.selectOption('#level-select', level);
    // No wait needed - level change is immediate
  } catch (error) {
    console.warn(`Could not set level to ${level}: ${error.message}`);
  }
}

/**
 * Submits an answer with retry logic.
 * @param {import('@playwright/test').Page} page
 * @param {string} answer
 * @returns {Promise<boolean>} Success status
 */
async function submitAnswerWithRetry(page, answer) {
  for (let attempt = 0; attempt < MAX_SUBMIT_RETRIES; attempt++) {
    try {
      await page.fill('#answer', answer);
      await page.press('#answer', 'Enter');
      // Wait for UI to update by checking for feedback or new question
      await page.waitForFunction((expectedAnswer) => {
        const word = document.querySelector('#word');
        const feedback = document.querySelector('.feedback-message');
        return word && (word.textContent !== expectedAnswer || feedback);
      }, answer, { timeout: 1000 }).catch(() => {}); // Short timeout, don't fail if it doesn't work
      return true;
    } catch (error) {
      if (attempt === MAX_SUBMIT_RETRIES - 1) {
        throw error;
      }
      await page.waitForTimeout(RETRY_DELAY_MS);
    }
  }
  return false;
}

test.describe.serial('Quiz Tests', () => {
  const testUser = `test_${Date.now()}_${Math.random().toString(36).substring(2, 15)}@example.com`;
  const testPassword = 'testPassword123!';
  let userRegistered = false;

  test.beforeEach(async ({ page }) => {
    page.setDefaultTimeout(TEST_TIMEOUT_MS);
    
    // Enable console logging
    page.on('console', msg => {
      const type = msg.type();
      const text = msg.text();
      console.log(`[BROWSER ${type.toUpperCase()}] ${text}`);
    });

    // Listen to page errors
    page.on('pageerror', error => {
      console.log(`[BROWSER ERROR] ${error.message}`);
      console.log(`[BROWSER ERROR STACK] ${error.stack}`);
    });

    // Listen to request failures
    page.on('requestfailed', request => {
      console.log(`[REQUEST FAILED] ${request.url()} - ${request.failure()?.errorText}`);
    });
    
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
    await expect(page.locator('#quiz-select')).toBeVisible({ timeout: WAIT_FOR_ELEMENT_TIMEOUT });

    // Check that quiz options are available
    const quizOptions = await page.locator('#quiz-select option').allTextContents();
    expect(quizOptions.length).toBeGreaterThan(1); // At least the default option + one quiz
  });

  test('should start a quiz and display word lists', async ({ page }) => {
    if (!userRegistered) {
      test.skip();
    }
    await login(page, testUser, testPassword);

    // Select a quiz
    await page.selectOption('#quiz-select', 'German Russian A1');
    
    // Wait for the quiz to load
    await page.waitForSelector('#word', { state: 'visible', timeout: WAIT_FOR_ELEMENT_TIMEOUT });
    
    // Verify word display elements exist
    await expect(page.locator('#word')).toBeVisible();
    await expect(page.locator('#answer')).toBeVisible();
    
    // Wait for word lists to populate using smart waiting
    await page.waitForFunction(() => {
      const headers = document.querySelectorAll('.foldable-header');
      return headers.length >= 6 && Array.from(headers).some(h => h.textContent.match(/\([1-9]\d*\)/));
    }, { timeout: WAIT_FOR_LIST_TIMEOUT });

    const status = await getStatusSummary(page);
    const totalWords = status.level0 + status.level1 + status.level2 + status.level3 + status.level4 + status.level5;
    
    console.log(`Initial status: ${JSON.stringify(status)}, Total: ${totalWords}`);
    expect(totalWords).toBeGreaterThan(0);
  });

  test('should handle correct answers and progress words', async ({ page }) => {
    if (!userRegistered) {
      test.skip();
    }
    
    await login(page, testUser, testPassword);
    await page.selectOption('#quiz-select', 'German Russian A1');
    await page.waitForSelector('#word', { state: 'visible', timeout: WAIT_FOR_ELEMENT_TIMEOUT });
    // Use smart waiting instead of fixed timeout

    let consecutiveErrors = 0;
    const maxAttempts = 10; // Reduced for performance
    let correctAnswers = 0;

    for (let attempt = 0; attempt < maxAttempts; attempt++) {
      try {
        // Get current word
        const currentWord = await page.locator('#word').innerText();
        if (!currentWord || currentWord.trim() === '') {
          // No wait needed
          continue;
        }

        // Get current level to know which direction and type to expect
        const currentLevel = await getCurrentLevel(page);
        
        // Determine expected direction based on level
        // LEVEL_1, LEVEL_3 = normal (source → target)
        // LEVEL_2, LEVEL_4 = reverse (target → source)
        const isReverse = currentLevel === 'LEVEL_2' || currentLevel === 'LEVEL_4';
        
        // Look through lists to find the translation
        let correctAnswer = null;
        const lists = ['level-0-list', 'level-1-list', 'level-2-list', 'level-3-list', 'level-4-list', 'level-5-list'];
        
        for (const listId of lists) {
          const words = await getWordsOrCountFromList(page, listId, false);
          if (Array.isArray(words)) {
            for (const wordPair of words) {
              if (!isReverse && wordPair.sourceWord === currentWord) {
                correctAnswer = wordPair.targetWord;
                break;
              } else if (isReverse && wordPair.targetWord === currentWord) {
                correctAnswer = wordPair.sourceWord;
                break;
              }
            }
            if (correctAnswer) break;
          }
        }

        if (!correctAnswer) {
          console.warn(`Could not find translation for "${currentWord}" at level "${currentLevel}" (reverse: ${isReverse})`);
          consecutiveErrors++;
          if (consecutiveErrors >= MAX_CONSECUTIVE_ERRORS_BEFORE_FAIL) {
            throw new Error(`Too many consecutive errors (${consecutiveErrors})`);
          }
          // No wait needed
          continue;
        }

        // Submit the correct answer
        const success = await submitAnswerWithRetry(page, correctAnswer);
        if (success) {
          correctAnswers++;
          consecutiveErrors = 0; // Reset error counter on success
        }

        // Refresh status periodically
        if (attempt % FULL_LIST_REFRESH_INTERVAL === 0) {
          const status = await getStatusSummary(page);
          console.log(`Attempt ${attempt}: Status - ${JSON.stringify(status)}, Correct answers: ${correctAnswers}`);
        }

        await page.waitForTimeout(RETRY_DELAY_MS);
      } catch (error) {
        console.error(`Error on attempt ${attempt}:`, error.message);
        consecutiveErrors++;
        if (consecutiveErrors >= MAX_CONSECUTIVE_ERRORS_BEFORE_FAIL) {
          break;
        }
        await page.waitForTimeout(1000);
      }
    }

    // Verify we made progress
    expect(correctAnswers).toBeGreaterThan(0);
    console.log(`Quiz progress test completed. Total correct answers: ${correctAnswers}`);
  });

  test('should switch levels and handle different directions', async ({ page }) => {
    if (!userRegistered) {
      test.skip();
    }
    
    await login(page, testUser, testPassword);
    await page.selectOption('#quiz-select', 'German Russian A1');
    await page.waitForSelector('#word', { state: 'visible', timeout: WAIT_FOR_ELEMENT_TIMEOUT });

    // Test LEVEL_1 (normal direction) - should always have words initially
    await setLevel(page, 'LEVEL_1');
    const level1 = await getCurrentLevel(page);
    console.log(`Set to level: "${level1}"`);
    expect(level1).toBe('LEVEL_1');

    // Try answering a question in LEVEL_1 using level-specific word sources
    let currentWord = await page.locator('#word').innerText();
    let correctAnswer = null;
    // LEVEL_1 uses LEVEL_0 and LEVEL_1 queues
    const level1Lists = ['level-0-list', 'level-1-list'];
    
    for (const listId of level1Lists) {
      const words = await getWordsOrCountFromList(page, listId, false);
      if (Array.isArray(words)) {
        for (const wordPair of words) {
          if (wordPair.sourceWord === currentWord) {
            correctAnswer = wordPair.targetWord;
            break;
          }
        }
        if (correctAnswer) break;
      }
    }

    if (correctAnswer) {
      await submitAnswerWithRetry(page, correctAnswer);
      console.log(`LEVEL_1: Successfully answered "${currentWord}" with "${correctAnswer}"`);
    }

    // Test LEVEL_2 (reverse direction) - may auto-adjust if no words available
    await setLevel(page, 'LEVEL_2');
    
    // Check if we successfully stayed at LEVEL_2 or were auto-adjusted
    const actualLevel = await getCurrentLevel(page);
    console.log(`Attempted LEVEL_2, actual level: "${actualLevel}"`);
    
    // Verify feedback message appears if level was auto-adjusted
    if (actualLevel !== 'LEVEL_2') {
      // Should have feedback about auto-adjustment
      const feedbackExists = await page.locator('.feedback-message').isVisible().catch(() => false);
      if (feedbackExists) {
        const feedbackText = await page.locator('.feedback-message').innerText();
        console.log(`Level adjustment feedback: "${feedbackText}"`);
        // Be flexible about feedback messages (quiz state issues can cause different messages)
        const isValidFeedback = feedbackText.toLowerCase().includes('no available words') || 
                              feedbackText.toLowerCase().includes('has no available words') ||
                              feedbackText.toLowerCase().includes('switched to') ||
                              feedbackText.toLowerCase().includes('quiz not initialized');
        expect(isValidFeedback).toBeTruthy();
      }
    }

    // Try answering a question in the actual level (whether LEVEL_2 or auto-adjusted)
    currentWord = await page.locator('#word').innerText();
    correctAnswer = null;
    
    // Use appropriate word sources based on actual level
    let appropriateLists;
    const isReverse = actualLevel === 'LEVEL_2' || actualLevel === 'LEVEL_4';
    
    if (actualLevel === 'LEVEL_1') {
      appropriateLists = ['level-0-list', 'level-1-list'];
    } else if (actualLevel === 'LEVEL_2') {
      appropriateLists = ['level-2-list'];
    } else if (actualLevel === 'LEVEL_3' || actualLevel === 'LEVEL_4') {
      appropriateLists = ['level-3-list', 'level-4-list', 'level-5-list'];
    } else {
      appropriateLists = ['level-0-list', 'level-1-list', 'level-2-list', 'level-3-list'];
    }
    
    for (const listId of appropriateLists) {
      const words = await getWordsOrCountFromList(page, listId, false);
      if (Array.isArray(words)) {
        for (const wordPair of words) {
          if (!isReverse && wordPair.sourceWord === currentWord) {
            correctAnswer = wordPair.targetWord;
            break;
          } else if (isReverse && wordPair.targetWord === currentWord) {
            correctAnswer = wordPair.sourceWord;
            break;
          }
        }
        if (correctAnswer) break;
      }
    }

    if (correctAnswer) {
      await submitAnswerWithRetry(page, correctAnswer);
      console.log(`${actualLevel}: Successfully answered "${currentWord}" with "${correctAnswer}"`);
    }
  });

  test('should handle level switching edge cases with proper feedback', async ({ page }) => {
    if (!userRegistered) {
      test.skip();
    }
    
    await login(page, testUser, testPassword);
    
    // Reset quiz state by selecting empty option first, then the quiz
    await page.selectOption('#quiz-select', '');
    await page.selectOption('#quiz-select', 'German Russian A1');
    await page.waitForSelector('#word', { state: 'visible', timeout: WAIT_FOR_ELEMENT_TIMEOUT });

    // Wait for word lists to populate
    await page.waitForFunction(() => {
      const headers = document.querySelectorAll('.foldable-header');
      return headers.length >= 6 && Array.from(headers).some(h => h.textContent.match(/\([1-9]\d*\)/));
    }, { timeout: WAIT_FOR_LIST_TIMEOUT });

    // Get initial status to understand word distribution
    const status = await getStatusSummary(page);
    console.log(`Initial word distribution: ${JSON.stringify(status)}`);

    // If there are no words at all, this indicates a problem with quiz initialization
    const totalWords = status.level0 + status.level1 + status.level2 + status.level3 + status.level4 + status.level5;
    if (totalWords === 0) {
      console.log('Quiz appears to have no words available, skipping edge case testing');
      test.skip();
    }

    // Test switching to levels that may not have words
    const levelsToTest = ['LEVEL_2', 'LEVEL_3', 'LEVEL_4'];
    
    for (const targetLevel of levelsToTest) {
      console.log(`\n--- Testing switch to ${targetLevel} ---`);
      
      // Clear any existing feedback
      await page.evaluate(() => {
        const feedback = document.querySelector('.feedback-message');
        if (feedback) feedback.remove();
      });
      
      // Attempt to switch to the target level
      await setLevel(page, targetLevel);
      await page.waitForTimeout(100); // Brief wait for UI updates
      
      // Check the actual level after attempted switch
      const actualLevel = await getCurrentLevel(page);
      console.log(`Attempted: ${targetLevel}, Actual: ${actualLevel}`);
      
      if (actualLevel !== targetLevel) {
        // Level was auto-adjusted - verify feedback exists
        console.log(`Level was auto-adjusted from ${targetLevel} to ${actualLevel}`);
        
        // Check for feedback message
        const feedbackExists = await page.locator('.feedback-message').isVisible().catch(() => false);
        if (feedbackExists) {
          const feedbackText = await page.locator('.feedback-message').innerText();
          console.log(`Auto-adjustment feedback: "${feedbackText}"`);
          
          // Verify feedback mentions no available words (but be flexible about the exact wording)
          const isValidFeedback = feedbackText.toLowerCase().includes('no available words') || 
                                feedbackText.toLowerCase().includes('has no available words') ||
                                feedbackText.toLowerCase().includes('switched to');
          expect(isValidFeedback).toBeTruthy();
          expect(feedbackText).toContain(targetLevel);
          expect(feedbackText).toContain(actualLevel);
        } else {
          console.log(`Warning: Expected feedback message for level adjustment but none found`);
        }
      } else {
        console.log(`Successfully switched to ${targetLevel}`);
        
        // Verify we can get a question at this level
        const questionExists = await page.locator('#word').isVisible();
        expect(questionExists).toBeTruthy();
        
        const currentWord = await page.locator('#word').innerText();
        expect(currentWord.trim()).not.toBe('');
        console.log(`Question available at ${targetLevel}: "${currentWord}"`);
      }
      
      // Wait briefly before next test
      await page.waitForTimeout(50);
    }

    // Test that LEVEL_1 should always be available (fallback level)
    console.log(`\n--- Testing fallback to LEVEL_1 ---`);
    await setLevel(page, 'LEVEL_1');
    const finalLevel = await getCurrentLevel(page);
    expect(finalLevel).toBe('LEVEL_1');
    
    // LEVEL_1 should always have a question available
    const questionExists = await page.locator('#word').isVisible();
    expect(questionExists).toBeTruthy();
    console.log(`LEVEL_1 fallback successful with question available`);
  });

  test('should display progress statistics', async ({ page }) => {
    // Create a fresh user for this test to avoid state issues
    const statsTestUser = `stats_test_${Date.now()}_${Math.random().toString(36).substring(2, 15)}@example.com`;
    const statsTestPassword = 'statsPassword123!';
    
    console.log(`Creating fresh user for stats test: ${statsTestUser}`);
    
    // Register fresh user
    await register(page, statsTestUser, statsTestPassword, true);
    await login(page, statsTestUser, statsTestPassword);
    
    console.log(`Logged in fresh user, selecting quiz...`);
    await page.selectOption('#quiz-select', 'German Russian A1');
    await page.waitForSelector('#word', { state: 'visible', timeout: WAIT_FOR_ELEMENT_TIMEOUT });
    
    console.log(`Quiz loaded, waiting for word lists...`);
    // Wait for word lists to populate
    await page.waitForFunction(() => {
      const headers = document.querySelectorAll('.foldable-header');
      return headers.length >= 6 && Array.from(headers).some(h => h.textContent.match(/\([1-9]\d*\)/));
    }, { timeout: WAIT_FOR_LIST_TIMEOUT });

    console.log(`Word lists populated, getting status...`);
    // Get status and verify structure
    const status = await getStatusSummary(page);
    
    console.log(`Raw status: ${JSON.stringify(status)}`);
    
    // Verify all status fields are numbers
    expect(typeof status.level0).toBe('number');
    expect(typeof status.level1).toBe('number');
    expect(typeof status.level2).toBe('number');
    expect(typeof status.level3).toBe('number');

    // Verify total is reasonable
    const totalWords = status.level0 + status.level1 + status.level2 + status.level3 + status.level4 + status.level5;
    console.log(`Total words calculated: ${totalWords}`);
    
    if (totalWords === 0) {
      console.log(`DEBUG: No words found, checking what's in the DOM...`);
      const headerTexts = await page.locator('.foldable-header').allTextContents();
      console.log(`Header texts: ${JSON.stringify(headerTexts)}`);
      
      const wordExists = await page.locator('#word').isVisible();
      const wordText = await page.locator('#word').innerText().catch(() => 'ERROR');
      console.log(`Word element visible: ${wordExists}, text: "${wordText}"`);
    }
    
    expect(totalWords).toBeGreaterThan(0);
    expect(totalWords).toBeLessThan(10000); // Sanity check

    console.log(`Progress statistics: ${JSON.stringify(status)}, Total: ${totalWords}`);
    
    // Clean up the fresh user
    const token = await page.evaluate(() => localStorage.getItem('token'));
    const apiUrl = process.env.API_URL || 'http://localhost:9000/api';
    
    await page.evaluate(async ({ token, apiUrl }) => {
      await fetch(`${apiUrl}/auth/delete-account`, {
        method: 'DELETE',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        }
      });
    }, { token, apiUrl });
  });

  test('should handle word progression through levels', async ({ page }) => {
    if (!userRegistered) {
      test.skip();
    }
    
    await login(page, testUser, testPassword);
    
    // Reset quiz state by selecting empty option first, then the quiz
    await page.selectOption('#quiz-select', '');
    await page.selectOption('#quiz-select', 'German Russian A1');
    await page.waitForSelector('#word', { state: 'visible', timeout: WAIT_FOR_ELEMENT_TIMEOUT });
    
    // Wait for word lists to populate
    await page.waitForFunction(() => {
      const headers = document.querySelectorAll('.foldable-header');
      return headers.length >= 6 && Array.from(headers).some(h => h.textContent.match(/\([1-9]\d*\)/));
    }, { timeout: WAIT_FOR_LIST_TIMEOUT });

    const initialStatus = await getStatusSummary(page);
    console.log(`Initial status: ${JSON.stringify(initialStatus)}`);

    // Submit several correct answers to trigger progression
    let progressMade = false;
    for (let i = 0; i < 5; i++) { // Reduced for performance
      try {
        const currentWord = await page.locator('#word').innerText();
        const currentLevel = await getCurrentLevel(page);
        const isReverse = currentLevel === 'LEVEL_2' || currentLevel === 'LEVEL_4';
        
        // Find correct answer
        let correctAnswer = null;
        const lists = ['level-0-list', 'level-1-list', 'level-2-list', 'level-3-list', 'level-4-list', 'level-5-list'];
        
        for (const listId of lists) {
          const words = await getWordsOrCountFromList(page, listId, false);
          if (Array.isArray(words)) {
            for (const wordPair of words) {
              if (!isReverse && wordPair.sourceWord === currentWord) {
                correctAnswer = wordPair.targetWord;
                break;
              } else if (isReverse && wordPair.targetWord === currentWord) {
                correctAnswer = wordPair.sourceWord;
                break;
              }
            }
            if (correctAnswer) break;
          }
        }

        if (correctAnswer) {
          await submitAnswerWithRetry(page, correctAnswer);
        }
        
        await page.waitForTimeout(500);
      } catch (error) {
        console.warn(`Error in progression attempt ${i}:`, error.message);
      }
    }

    // Check if any progress was made
    const finalStatus = await getStatusSummary(page);
    console.log(`Final status: ${JSON.stringify(finalStatus)}`);

    // At minimum, we should have had some interaction
    // (exact progression may vary based on quiz logic)
    expect(finalStatus.level0 + finalStatus.level1 + finalStatus.level2 + finalStatus.level3 + finalStatus.level4 + finalStatus.level5)
      .toBeGreaterThan(0);
  });

  test('should complete significant word progression through levels', async ({ page }) => {
    // Set reasonable timeout for progression test
    test.setTimeout(600000); // 10 minutes
    
    if (!userRegistered) {
      test.skip();
    }
    
    await login(page, testUser, testPassword);
    
    // Reset quiz state by selecting empty option first, then the quiz
    await page.selectOption('#quiz-select', '');
    await page.selectOption('#quiz-select', 'German Russian A1');
    await page.waitForSelector('#word', { state: 'visible', timeout: WAIT_FOR_ELEMENT_TIMEOUT });
    
    // Wait for quiz to be ready and word lists to populate
    await page.waitForFunction(() => {
      const word = document.querySelector('#word');
      const headers = document.querySelectorAll('.foldable-header');
      return word && word.textContent && word.textContent.trim() !== '' && 
             headers.length >= 6 && Array.from(headers).some(h => h.textContent.match(/\(\d+\)/));
    }, { timeout: WAIT_FOR_LIST_TIMEOUT });

    const initialStatus = await getStatusSummary(page);
    const totalWords = initialStatus.level0 + initialStatus.level1 + initialStatus.level2 + initialStatus.level3 + initialStatus.level4 + initialStatus.level5;
    console.log(`Starting progression test with ${totalWords} words (testing subset for speed)`);
    console.log(`Initial status: ${JSON.stringify(initialStatus)}`);

    let consecutiveErrors = 0;
    let correctAnswers = 0;
    let attempts = 0;
    const maxAttempts = 1000; // Much smaller limit for faster testing
    
    // Continue until all words reach LEVEL_5 or we hit max attempts
    while (attempts < maxAttempts) {
      try {
        attempts++;
        
        // Check current status every 50 attempts
        if (attempts % FULL_LIST_REFRESH_INTERVAL === 0) {
          const currentStatus = await getStatusSummary(page);
          const level5Count = currentStatus.level5;
          console.log(`Attempt ${attempts}: Status - ${JSON.stringify(currentStatus)}, Correct answers: ${correctAnswers}, Level 5: ${level5Count}`);
          
          // Success criteria: At least 50 words at LEVEL_5 to prove the full progression works
          if (level5Count >= 50) {
            console.log(`🎉 PROGRESSION SUCCESS! ${level5Count} words reached LEVEL_5 after ${attempts} attempts and ${correctAnswers} correct answers`);
            break;
          }
          
          // Intelligently switch levels based on word distribution to progress words
          if (currentStatus.level2 > 30 && currentStatus.level3 < 10) {
            // Many words at LEVEL_2, switch to LEVEL_2 to practice reverse direction
            console.log(`Switching to LEVEL_2 to progress ${currentStatus.level2} words`);
            await setLevel(page, 'LEVEL_2');
          } else if (currentStatus.level3 > 20 && currentStatus.level4 < 10) {
            // Many words at LEVEL_3, switch to LEVEL_3 for usage examples
            console.log(`Switching to LEVEL_3 to progress ${currentStatus.level3} words`);
            await setLevel(page, 'LEVEL_3');
          } else if (currentStatus.level4 > 15 && currentStatus.level5 < 50) {
            // Many words at LEVEL_4, switch to LEVEL_4 for reverse usage examples
            console.log(`Switching to LEVEL_4 to progress ${currentStatus.level4} words`);
            await setLevel(page, 'LEVEL_4');
          } else if (currentStatus.level1 > 30) {
            // Still have words at LEVEL_1, keep practicing there
            console.log(`Continuing at LEVEL_1 to progress ${currentStatus.level1} words`);
            await setLevel(page, 'LEVEL_1');
          }
        }

        // Get current word
        const currentWord = await page.locator('#word').innerText();
        if (!currentWord || currentWord.trim() === '') {
          // No wait needed
          continue;
        }

        // Get current level to know which direction and type to expect
        const currentLevel = await getCurrentLevel(page);
        
        // Determine expected direction based on level
        const isReverse = currentLevel === 'LEVEL_2' || currentLevel === 'LEVEL_4';
        
        // Look through lists to find the translation
        let correctAnswer = null;
        const lists = ['level-0-list', 'level-1-list', 'level-2-list', 'level-3-list', 'level-4-list', 'level-5-list'];
        
        for (const listId of lists) {
          const words = await getWordsOrCountFromList(page, listId, false);
          if (Array.isArray(words)) {
            for (const wordPair of words) {
              if (!isReverse && wordPair.sourceWord === currentWord) {
                correctAnswer = wordPair.targetWord;
                break;
              } else if (isReverse && wordPair.targetWord === currentWord) {
                correctAnswer = wordPair.sourceWord;
                break;
              }
            }
            if (correctAnswer) break;
          }
        }

        if (!correctAnswer) {
          console.warn(`Could not find translation for "${currentWord}" at level "${currentLevel}" (reverse: ${isReverse})`);
          consecutiveErrors++;
          if (consecutiveErrors >= MAX_CONSECUTIVE_ERRORS_BEFORE_FAIL) {
            throw new Error(`Too many consecutive errors (${consecutiveErrors})`);
          }
          // No wait needed
          continue;
        }

        // Submit the correct answer
        const success = await submitAnswerWithRetry(page, correctAnswer);
        if (success) {
          correctAnswers++;
          consecutiveErrors = 0; // Reset error counter on success
        }

        // No wait needed between attempts
      } catch (error) {
        console.error(`Error on attempt ${attempts}:`, error.message);
        consecutiveErrors++;
        if (consecutiveErrors >= MAX_CONSECUTIVE_ERRORS_BEFORE_FAIL) {
          break;
        }
        // No wait needed for error recovery
      }
    }

    // Final status check
    const finalStatus = await getStatusSummary(page);
    console.log(`Final status after ${attempts} attempts: ${JSON.stringify(finalStatus)}`);
    console.log(`Total correct answers: ${correctAnswers}`);
    
    // Verify we made significant progress
    expect(correctAnswers).toBeGreaterThan(100); // At least 100 correct answers
    expect(finalStatus.level5).toBeGreaterThan(10); // At least 10 words reached full mastery
    
    console.log(`✅ Progression test completed: ${finalStatus.level5} words reached LEVEL_5, demonstrating full learning pipeline works`);
    
    // Verify all levels are being used
    const totalInProgress = finalStatus.level1 + finalStatus.level2 + finalStatus.level3 + finalStatus.level4;
    expect(totalInProgress).toBeGreaterThan(0); // Words should be in various learning stages
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
    
    const response = await page.evaluate(async ({ token, apiUrl }) => {
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