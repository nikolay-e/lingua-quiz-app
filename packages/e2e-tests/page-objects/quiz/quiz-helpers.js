/*
 * LinguaQuiz – Copyright © 2025 Nikolay Eremeev
 *
 * Dual-licensed:
 *  – Non-Commercial Source-Available v2  →  see LICENSE-NONCOMMERCIAL.md
 *  – Commercial License v2              →  see LICENSE-COMMERCIAL.md
 *
 * Contact: lingua-quiz@nikolay-eremeev.com
 * Repository: https://github.com/nikolay-e/lingua-quiz
 */

// packages/e2e-tests/page-objects/quiz/quiz-helpers.js

/**
 * Helper functions for the quiz page objects
 */

/**
 * Takes a diagnostic screenshot with a specific name
 * @param {import('@playwright/test').Page} page - Playwright page object
 * @param {string} name - Screenshot name
 * @param {Function} log - Logging function
 */
export async function takeErrorScreenshot(page, name, log) {
  try {
    const path = `./test-results/screenshots/${name}_${Date.now()}.png`;
    await page.screenshot({ path, fullPage: true });
    await log(`Saved error screenshot to ${path}`, 'debug');
  } catch (error) {
    await log(`Failed to take screenshot: ${error.message}`, 'warn');
  }
}

/**
 * Disables animations for better test stability
 * @param {import('@playwright/test').Page} page - Playwright page object
 * @param {Function} log - Logging function
 */
export async function disableAnimations(page, log) {
  await page.addStyleTag({
    content: `*, *::before, *::after {
      transition: none !important;
      animation: none !important;
      scroll-behavior: auto !important;
    }`,
  });
  await log('Animations disabled for stability');
}

/**
 * Gets word counts from lists in the UI
 * @param {import('@playwright/test').Page} page - Playwright page object
 * @param {Object} selectors - Page object selectors
 * @param {Function} log - Logging function
 * @returns {Promise<Object>} - Word counts for each level
 */
export async function getWordCounts(page, selectors, log) {
  try {
    const counts = await page.evaluate((sel) => {
      return {
        level0: document.querySelectorAll(sel.level0Items).length || 0,
        level1: document.querySelectorAll(sel.level1Items).length || 0,
        level2: document.querySelectorAll(sel.level2Items).length || 0,
        level3: document.querySelectorAll(sel.level3Items).length || 0,
        total:
          document.querySelectorAll(sel.level0Items).length +
          document.querySelectorAll(sel.level1Items).length +
          document.querySelectorAll(sel.level2Items).length +
          document.querySelectorAll(sel.level3Items).length,
      };
    }, selectors);

    await log(
      `Word counts - L0: ${counts.level0}, L1: ${counts.level1}, L2: ${counts.level2}, L3: ${counts.level3}`,
      'info'
    );
    return counts;
  } catch (error) {
    await log(`Error getting word counts: ${error.message}`, 'error');
    return { level0: 0, level1: 0, level2: 0, level3: 0, total: 0 };
  }
}

/**
 * Gets word counts from application state directly
 * @param {import('@playwright/test').Page} page - Playwright page object
 * @param {Function} log - Logging function
 * @returns {Promise<Object>} - Word counts for each level from app state
 */
export async function getWordCountsFromAppState(page, log) {
  try {
    const counts = await page.evaluate(() => {
      try {
        if (window.app && window.app.quizState && window.app.quizState.wordStatusSets) {
          return {
            level0: window.app.quizState.wordStatusSets['LEVEL_0']?.size || 0,
            level1: window.app.quizState.wordStatusSets['LEVEL_1']?.size || 0,
            level2: window.app.quizState.wordStatusSets['LEVEL_2']?.size || 0,
            level3: window.app.quizState.wordStatusSets['LEVEL_3']?.size || 0,
            total:
              (window.app.quizState.wordStatusSets['LEVEL_0']?.size || 0) +
              (window.app.quizState.wordStatusSets['LEVEL_1']?.size || 0) +
              (window.app.quizState.wordStatusSets['LEVEL_2']?.size || 0) +
              (window.app.quizState.wordStatusSets['LEVEL_3']?.size || 0),
          };
        }
        return null;
      } catch (error) {
        console.error('[Browser] Error accessing word counts from app state:', error);
        return null;
      }
    });

    if (counts) {
      await log(
        `App state word counts - L0: ${counts.level0}, L1: ${counts.level1}, L2: ${counts.level2}, L3: ${counts.level3}`,
        'info'
      );
      return counts;
    } else {
      await log('App state not available or word counts could not be retrieved', 'warn');
      return null;
    }
  } catch (error) {
    await log(`Error getting word counts from app state: ${error.message}`, 'error');
    return null;
  }
}

/**
 * Gets the current word from the display
 * @param {import('@playwright/test').Page} page - Playwright page object
 * @param {Object} selectors - Page object selectors
 * @param {Function} log - Logging function
 * @returns {Promise<string|null>} - The current word or null if not found
 */
export async function getCurrentWord(page, selectors, log) {
  try {
    const wordElement = page.locator(selectors.wordDisplay);
    const exists = (await wordElement.count()) > 0;

    if (!exists) {
      await log('Word display element not found', 'warn');
      return null;
    }

    const word = await wordElement.textContent();
    await log(`Current word: "${word}"`, 'info');
    return word.trim();
  } catch (error) {
    await log(`Error getting current word: ${error.message}`, 'error');
    return null;
  }
}

/**
 * Gets the current quiz direction (normal or reverse)
 * @param {import('@playwright/test').Page} page - Playwright page object
 * @param {Object} selectors - Page object selectors
 * @param {Function} log - Logging function
 * @returns {Promise<string>} - The current direction ("normal" or "reverse")
 */
export async function getCurrentDirection(page, selectors, log) {
  try {
    const directionButton = page.locator(selectors.directionToggle);
    const buttonText = await directionButton.textContent();

    // Button shows the direction that will be switched to, so we need to invert it
    const currentDirection = buttonText.toLowerCase().includes('reverse') ? 'normal' : 'reverse';

    await log(`Current direction: ${currentDirection}`, 'info');
    return currentDirection;
  } catch (error) {
    await log(`Error getting current direction: ${error.message}`, 'error');
    return 'normal'; // Default to normal if can't determine
  }
}
