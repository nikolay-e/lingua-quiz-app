import { expect, Page } from '@playwright/test';

interface WordPair {
  sourceWord: string;
  targetWord: string;
}


async function withRetry<T>(fn: () => Promise<T>, retries = 3): Promise<T> {
  for (let i = 0; i < retries; i++) {
    try {
      return await fn();
    } catch (error) {
      if (i === retries - 1) throw error;
      await new Promise(resolve => setTimeout(resolve, 1000));
    }
  }
  throw new Error('withRetry failed'); // TypeScript needs this
}

export async function register(page: Page, username: string, password: string, success?: boolean): Promise<void> {
  // Use environment variable or fallback URL
  const baseURL = process.env.LINGUA_QUIZ_URL || 'http://localhost:8080';

  await withRetry(async () => {
    await page.goto(baseURL, { waitUntil: 'domcontentloaded', timeout: 30000 });
  });

  // First check if we're on login page and need to navigate to register
  try {
    await page.waitForSelector('section:has-text("Sign In")', { state: 'visible', timeout: 2000 });
    // Click on "Register here" link
    await page.click('button:has-text("Register here")');
    // Wait for register page to load
    await page.waitForSelector('section:has-text("Create Account")', { state: 'visible', timeout: 2000 });
  } catch {
    // Check if we're already on register page
    await page.waitForSelector('section:has-text("Create Account")', { state: 'visible', timeout: 2000 });
  }

  // Find the username and password inputs within the register section
  const registerSection = page.locator('section:has-text("Create Account")');

  // Wait for inputs to be ready - use more specific selectors for Tailwind layout
  await registerSection.locator('input[placeholder="Username"]').waitFor({ state: 'visible', timeout: 5000 });
  await registerSection.locator('input[id="register-password"]').waitFor({ state: 'visible', timeout: 5000 });

  await registerSection.locator('input[placeholder="Username"]').fill(username);
  await registerSection.locator('input[id="register-password"]').fill(password);
  // Wait for password validation to complete
  await page.waitForFunction(() => {
    const sections = Array.from(document.querySelectorAll('section'));
    for (const section of sections) {
      if (section.textContent?.includes("Create Account")) {
        const button = section.querySelector('button[type="submit"]') as HTMLButtonElement;
        return button && !button.disabled;
      }
    }
    return false;
  }, { timeout: 5000 });

  // Debug: Check if the button is enabled before clicking
  const submitButton = registerSection.locator('button[type="submit"]');

  // Wait for network idle before clicking
  await page.waitForLoadState('networkidle');

  // Click with retry for Firefox compatibility
  try {
    await submitButton.click({ timeout: 15000 });
  } catch {
    // Retry with force click if normal click fails
    await submitButton.click({ force: true });
  }

  // Wait for registration to complete
  await page.waitForLoadState('networkidle');

  if (success !== undefined) {
    if (success) {
      // For successful registration, either see success message OR automatic redirect to quiz
      // Auto-login works so fast that we might miss the success message
      try {
        // Try to catch the success message briefly
        await expect(page.locator('#register-message')).toContainText('successful', { timeout: 2000 });
        console.log('Caught success message');
      } catch {
        console.log('Success message too fast, checking for redirect');
      }

      // Either way, we should end up on the quiz page due to auto-login
      await expect(page.locator('#quiz-select')).toBeVisible({ timeout: 8000 });
    } else {
      // Look for error message
      await expect(page.locator('#register-message')).toBeVisible({ timeout: 5000 });
      const messageText = await page.locator('#register-message').innerText();
      expect(messageText).not.toContain('successful');
    }
  }
}

export async function login(page: Page, username: string, password: string): Promise<void> {
  // Use environment variable or fallback URL
  const baseURL = process.env.LINGUA_QUIZ_URL || 'http://localhost:8080';

  await withRetry(async () => {
    await page.goto(baseURL, { waitUntil: 'domcontentloaded', timeout: 30000 });
  });

  // Check if we're already logged in (quiz selector is visible)
  try {
    await page.waitForSelector('#quiz-select', { state: 'visible', timeout: 2000 });
    console.log('Already logged in, skipping login process');
    return; // Already logged in
  } catch {
    // Not logged in, continue with login process
  }

  // Wait for the login form to be visible
  await page.waitForSelector('section:has-text("Sign In")', { state: 'visible', timeout: 2000 });

  // Find the username and password inputs within the login section
  const loginSection = page.locator('section:has-text("Sign In")');

  // Wait for inputs to be ready - use more specific selectors for Tailwind layout
  await loginSection.locator('input[placeholder="Username"]').waitFor({ state: 'visible', timeout: 5000 });
  await loginSection.locator('input[id="password"]').waitFor({ state: 'visible', timeout: 5000 });

  await loginSection.locator('input[placeholder="Username"]').fill(username);
  await loginSection.locator('input[id="password"]').fill(password);

  // Wait for submit button to be ready and click with retry for Firefox compatibility
  const submitButton = loginSection.locator('button[type="submit"]');
  await submitButton.waitFor({ state: 'visible', timeout: 5000 });
  await page.waitForFunction(() => {
    const sections = Array.from(document.querySelectorAll('section'));
    for (const section of sections) {
      if (section.textContent?.includes("Sign In")) {
        const button = section.querySelector('button[type="submit"]') as HTMLButtonElement;
        return button && !button.disabled;
      }
    }
    return false;
  }, { timeout: 5000 });

  try {
    await submitButton.click({ timeout: 15000 }); // Increased timeout for Firefox
  } catch {
    // Retry with force click if normal click fails
    await submitButton.click({ force: true });
  }

  // Wait for either successful login (quiz select visible) or error message
  await Promise.race([
    page.waitForSelector('#quiz-select', { state: 'visible', timeout: 10000 }),
    page.waitForSelector('#login-message', { state: 'visible', timeout: 10000 }),
  ]);
}

export async function logout(page: Page): Promise<void> {
  // Make sure we're waiting for the button to be both visible and clickable
  const logoutButton = page.locator('#login-logout-btn');
  await logoutButton.waitFor({ state: 'visible', timeout: 5000 });
  // Wait for button to be interactive
  await page.waitForFunction(() => {
    const button = document.querySelector('#login-logout-btn') as HTMLButtonElement;
    return button && !button.disabled;
  }, { timeout: 5000 });
  await logoutButton.click();
  // After logout, we should see the login form
  await expect(page.locator('section:has-text("Sign In")')).toBeVisible({ timeout: 5000 });
}

export async function selectQuiz(page: Page, quizName: string): Promise<void> {
  await page.selectOption('#quiz-select', quizName);
  // Wait for quiz to load - word should appear
  await page.waitForSelector('#word', { state: 'visible', timeout: 5000 });
  await expect(page.locator('#word')).not.toBeEmpty();
  // Wait for word lists to populate
  await waitForQuizReady(page);
}

/**
 * Waits for the quiz to be fully loaded with word lists populated
 */
export async function waitForQuizReady(page: Page, timeout = 5000): Promise<void> {
  await page.waitForFunction(() => {
    const headers = document.querySelectorAll('.foldable-header');
    return headers.length >= 6 && Array.from(headers).some(h => h.textContent?.match(/\([1-9]\d*\)/));
  }, { timeout });
}

/**
 * Gets word count from a level header
 */
export async function getWordCountFromHeader(page: Page, levelId: string): Promise<number> {
  try {
    const headerText = await page.locator(`#${levelId} h3`).innerText();
    const match = headerText.match(/\((\d+)\)/);
    return match ? parseInt(match[1], 10) : 0;
  } catch {
    console.warn(`Could not get count from header ${levelId}`);
    return 0;
  }
}

/**
 * Gets words from a specific list
 */
export async function getWordsFromList(page: Page, listId: string): Promise<WordPair[]> {
  try {
    const listLocator = page.locator(`#${listId} li`);
    await page.locator(`#${listId}`).waitFor({ state: 'attached', timeout: 3000 }).catch(() => {});

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
      .filter((item): item is WordPair => item !== null);
  } catch {
    console.warn(`Could not access list ${listId}`);
    return [];
  }
}

/**
 * Checks if words match (handles formatted vs raw text)
 */
export function wordsMatch(displayWord: string, questionWord: string): boolean {
  if (displayWord === questionWord) return true;
  // If question has pipes, check if display word matches first alternative
  if (questionWord.includes('|')) {
    return displayWord === questionWord.split('|')[0].trim();
  }
  return false;
}

/**
 * Finds the correct answer for a given word by searching through all lists
 */
export async function findCorrectAnswer(page: Page, questionWord: string, isReverse = false): Promise<string | null> {
  const lists = ['level-0-list', 'level-1-list', 'level-2-list', 'level-3-list', 'level-4-list', 'level-5-list'];

  for (const listId of lists) {
    const words = await getWordsFromList(page, listId);
    for (const wordPair of words) {
      if (!isReverse && wordsMatch(wordPair.sourceWord, questionWord)) {
        return wordPair.targetWord;
      } else if (isReverse && wordsMatch(wordPair.targetWord, questionWord)) {
        return wordPair.sourceWord;
      }
    }
  }
  return null;
}

/**
 * Answers the current question correctly by finding the answer in the word lists
 */
export async function answerCorrectly(page: Page): Promise<boolean> {
  const questionWord = await page.locator('#word').innerText();
  // Since level selection is automatic, we'll determine direction by trying both
  let correctAnswer = await findCorrectAnswer(page, questionWord, false);
  if (!correctAnswer) {
    correctAnswer = await findCorrectAnswer(page, questionWord, true);
  }

  if (!correctAnswer) {
    console.warn(`Could not find correct answer for "${questionWord}"`);
    return false;
  }

  await page.fill('#answer', correctAnswer);
  await page.press('#answer', 'Enter');

  // Wait for feedback or new question
  await page.waitForFunction(() => {
    const answer = document.querySelector('#answer') as HTMLInputElement;
    return answer && answer.value === '';
  }, { timeout: 2000 });
  return true;
}

/**
 * Progresses a specific word to a target level by answering it correctly
 */
export async function progressWordToLevel(
  page: Page,
  sourceWord: string,
  targetLevel: string,
  maxAttempts = 50
): Promise<boolean> {
  const levelMap: Record<string, number> = {
    'LEVEL_0': 0,
    'LEVEL_1': 1,
    'LEVEL_2': 2,
    'LEVEL_3': 3,
    'LEVEL_4': 4,
    'LEVEL_5': 5
  };

  const targetLevelNum = levelMap[targetLevel];
  if (targetLevelNum === undefined) {
    throw new Error(`Invalid target level: ${targetLevel}`);
  }

  console.log(`Starting progression of word "${sourceWord}" to ${targetLevel}`);

  for (let attempt = 0; attempt < maxAttempts; attempt++) {
    // Check if word reached target level
    const listId = `level-${targetLevelNum}-list`;
    const words = await getWordsFromList(page, listId);
    if (words.some(w => w.sourceWord === sourceWord)) {
      console.log(`Word "${sourceWord}" reached ${targetLevel} after ${attempt} attempts`);
      return true;
    }

    // Get current question
    const currentWord = await page.locator('#word').innerText();

    // Check if it's our target word (check both directions since level switching is automatic)
    let isTargetWord = false;
    if (wordsMatch(sourceWord, currentWord)) {
      isTargetWord = true;
    } else {
      // Check if current question is the target translation in reverse
      const allWords = await getWordsFromList(page, 'level-0-list');
      const targetPair = allWords.find(w => w.sourceWord === sourceWord);
      if (targetPair && wordsMatch(targetPair.targetWord, currentWord)) {
        isTargetWord = true;
      }
    }

    if (isTargetWord) {
      // Answer correctly
      await answerCorrectly(page);
      console.log(`Answered "${sourceWord}" correctly at attempt ${attempt}`);
    } else {
      // Skip other words
      await page.fill('#answer', 'skip');
      await page.press('#answer', 'Enter');
    }

    await page.waitForFunction(() => {
      const answer = document.querySelector('#answer') as HTMLInputElement;
      return answer && answer.value === '';
    }, { timeout: 1000 });
  }

  console.warn(`Failed to progress word "${sourceWord}" to ${targetLevel} after ${maxAttempts} attempts`);
  return false;
}
