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

// packages/e2e-tests/page-objects/quiz/quiz-form-handlers.js
import { expect } from '@playwright/test';

import { takeErrorScreenshot } from './quiz-helpers.js';

/**
 * Functions for handling quiz form actions
 */

/**
 * Selects a quiz from the dropdown
 * @param {import('@playwright/test').Page} page - Playwright page object
 * @param {Object} selectors - Page object selectors
 * @param {Object} methods - BasePage methods
 * @param {Object} timeouts - Timeout constants
 * @param {Object} constants - Quiz constants
 * @param {Function} log - Logging function
 * @param {string} quizName - The name of the quiz to select
 * @returns {Promise<string|null>} - The value of the selected option or null if failed
 */
export async function selectQuiz(page, selectors, methods, timeouts, constants, log, quizName) {
  await log(`Attempting to select quiz: "${quizName}"`, 'info');

  // Wait for quiz select to have options
  await methods.waitForElement(selectors.quizSelect);

  // Wait for dropdown to be populated
  await page.evaluate(() => {
    return new Promise((resolve) => {
      if (document.querySelector('#quiz-select').options.length > 1) {
        resolve();
      } else {
        // Set a timeout to prevent infinite wait
        const checkInterval = setInterval(() => {
          if (document.querySelector('#quiz-select').options.length > 1) {
            clearInterval(checkInterval);
            resolve();
          }
        }, 100);
        setTimeout(() => {
          clearInterval(checkInterval);
          resolve();
        }, 5000);
      }
    });
  });

  try {
    // Find the option by text content (case-insensitive)
    const quizSelect = page.locator(selectors.quizSelect);
    const safeQuizNamePattern = quizName.replaceAll(/[$()*+./?[\\\]^{|}-]/g, String.raw`\$&`);
    const optionElement = quizSelect.locator('option', {
      hasText: new RegExp(`^\\s*${safeQuizNamePattern}\\s*$`, 'i'),
    });

    await expect(optionElement, `Option with text "${quizName}" not found in dropdown`).toHaveCount(
      1,
      { timeout: timeouts.short }
    );

    const optionValue = await optionElement.getAttribute('value');
    if (!optionValue) {
      throw new Error(`Found option for "${quizName}" but it has no value`);
    }

    await log(`Found value "${optionValue}" for quiz "${quizName}". Selecting...`, 'info');
    await quizSelect.selectOption({ value: optionValue });

    // Verify selection was successful
    await expect(quizSelect).toHaveValue(optionValue, { timeout: timeouts.short });
    await log(`Successfully selected quiz "${quizName}"`, 'info');

    // Wait for quiz content to load
    await expect(page.locator(selectors.wordDisplay)).not.toBeEmpty({
      timeout: timeouts.medium,
    });

    await waitForListsAfterQuizSelection(page, selectors, constants, log);

    return optionValue;
  } catch (error) {
    await log(`Failed to select quiz "${quizName}": ${error.message}`, 'error');
    await takeErrorScreenshot(page, `quiz_select_${quizName.replaceAll(/[^\dA-Za-z]/g, '_')}`, log);
    return null;
  }
}

/**
 * Waits for word lists to load after quiz selection
 * @param {import('@playwright/test').Page} page - Playwright page object
 * @param {Object} selectors - Page object selectors
 * @param {Object} constants - Quiz constants
 * @param {Function} log - Logging function
 */
async function waitForListsAfterQuizSelection(page, selectors, constants, log) {
  // Use waitForSelector to bypass strict mode for multiple elements
  await log('Waiting for word lists to become visible...', 'info');
  try {
    await page.waitForSelector(`${selectors.level0List}, ${selectors.level1List}`, {
      state: 'visible',
      timeout: constants.WAIT_FOR_LIST_TIMEOUT,
    });
    await log('Word lists visible', 'info');
  } catch (error) {
    await log(`Warning: Waiting for word lists timed out: ${error.message}`, 'warn');
    // Take a screenshot for debugging
    await takeErrorScreenshot(page, `quiz_list_timeout_${Date.now()}`, log);
    // Continue anyway since we already have word display
  }

  // Wait for at least one list item
  try {
    await log('Waiting for list items to load...', 'info');
    await page.waitForFunction(
      () => {
        const l0Items = document.querySelectorAll('#level-0-list li');
        const l1Items = document.querySelectorAll('#level-1-list li');
        console.log(`[Browser] Found ${l0Items.length} L0 items and ${l1Items.length} L1 items`);
        return l0Items.length > 0 || l1Items.length > 0;
      },
      { timeout: constants.WAIT_FOR_LIST_TIMEOUT }
    );
    await log('List items are loaded and attached', 'info');
  } catch (error) {
    await log(`Warning: No list items found: ${error.message}`, 'warn');
    await takeErrorScreenshot(page, `quiz_list_items_timeout_${Date.now()}`, log);

    // Try pulling list items directly from app state when DOM lists are not ready yet
    try {
      await log('Attempting to check app state for words...', 'info');
      const wordCount = await page.evaluate(() => {
        try {
          if (window.app && window.app.quizState) {
            // Count words in app state
            const l0Count = window.app.quizState.wordStatusSets['LEVEL_0']?.size || 0;
            const l1Count = window.app.quizState.wordStatusSets['LEVEL_1']?.size || 0;
            console.log(`[Browser] App internal word counts - L0: ${l0Count}, L1: ${l1Count}`);
            return l0Count + l1Count;
          }
          return 0;
        } catch (error_) {
          console.error('[Browser] Error checking app state:', error_.message);
          return 0;
        }
      });
      await log(`Found ${wordCount} words in app state`, 'info');
    } catch (stateError) {
      await log(`Error checking app state: ${stateError.message}`, 'error');
    }
  }
}

/**
 * Toggles the quiz direction between normal and reverse
 * @param {import('@playwright/test').Page} page - Playwright page object
 * @param {Object} selectors - Page object selectors
 * @param {Object} methods - BasePage methods
 * @param {Function} log - Logging function
 * @returns {Promise<string>} - The new direction after toggling
 */
export async function toggleDirection(page, selectors, methods, log) {
  await log('Toggling quiz direction', 'info');

  // Store the current button text before clicking (to verify change)
  const directionButton = page.locator(selectors.directionToggle);
  const buttonTextBefore = await directionButton.textContent();

  // Click the toggle button
  await methods.clickElement(selectors.directionToggle);

  // Verify the button text has changed
  try {
    await page.waitForFunction(
      (oldText, buttonSelector) => {
        const button = document.querySelector(buttonSelector);
        return button && button.textContent !== oldText;
      },
      buttonTextBefore,
      selectors.directionToggle
    );

    // Get the new button text and return the current direction
    const buttonTextAfter = await directionButton.textContent();
    const currentDirection = buttonTextAfter.toLowerCase().includes('reverse')
      ? 'normal'
      : 'reverse';
    await log(`Direction toggled to: ${currentDirection}`, 'info');
    return currentDirection;
  } catch (error) {
    await log(`Error toggling direction: ${error.message}`, 'error');
    await takeErrorScreenshot(page, 'toggle_direction_error', log);
    // Return based on initial state if we can't determine new state
    return buttonTextBefore.toLowerCase().includes('reverse') ? 'reverse' : 'normal';
  }
}

/**
 * Submits an answer in the quiz
 * @param {import('@playwright/test').Page} page - Playwright page object
 * @param {Object} selectors - Page object selectors
 * @param {Object} methods - BasePage methods
 * @param {Object} timeouts - Timeout constants
 * @param {Object} constants - Quiz constants
 * @param {Function} log - Logging function
 * @param {string} answer - The answer to submit
 * @returns {Promise<Object>} - Success flag and feedback message
 */
export async function submitAnswer(page, selectors, methods, timeouts, constants, log, answer) {
  await log(`Submitting answer: "${answer}"`, 'info');

  try {
    // Fill the answer input
    await methods.fillInput(selectors.answerInput, answer);

    // Take a screenshot before submission
    await takeErrorScreenshot(page, `before_submit_${Date.now()}`, log);

    // Get the current word for reference before we submit
    const currentWord = await page.locator(selectors.wordDisplay).textContent();

    // Submit the answer
    await methods.clickElement(selectors.submitButton);

    // Wait for feedback
    await page.waitForSelector(selectors.feedbackMessage, {
      state: 'visible',
      timeout: timeouts.medium,
    });

    // Get feedback message
    const feedbackMessage = await page.locator(selectors.feedbackMessage).textContent();
    await log(`Feedback: ${feedbackMessage}`, 'info');

    // Determine if answer was correct
    const isCorrect = feedbackMessage.toLowerCase().includes('correct');

    // Take a screenshot after submission
    await takeErrorScreenshot(page, `after_submit_${Date.now()}`, log);

    return {
      success: true,
      isCorrect,
      feedback: feedbackMessage,
      previousWord: currentWord,
    };
  } catch (error) {
    await log(`Error submitting answer: ${error.message}`, 'error');
    await takeErrorScreenshot(page, `answer_error_${Date.now()}`, log);
    return {
      success: false,
      isCorrect: false,
      feedback: `Error: ${error.message}`,
      previousWord: null,
    };
  }
}
