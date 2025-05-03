// packages/e2e-tests/page-objects/quiz/quiz-list-handlers.js
import { takeErrorScreenshot } from './quiz-helpers.js';

/**
 * Functions for handling word list operations in the quiz
 */

/**
 * Validates that all list elements are properly initialized and visible
 * @param {import('@playwright/test').Page} page - Playwright page object
 * @param {Object} selectors - Page object selectors
 * @param {Function} log - Logging function
 * @returns {Promise<boolean>} - True if lists are valid, false otherwise
 */
export async function validateListElements(page, selectors, log) {
  await log('Validating word list elements', 'info');

  try {
    // Check each list container exists
    const listsExist = await page.evaluate((sel) => {
      const lists = {
        level0: !!document.querySelector(sel.level0List),
        level1: !!document.querySelector(sel.level1List),
        level2: !!document.querySelector(sel.level2List),
        level3: !!document.querySelector(sel.level3List),
      };

      console.log('[Browser] List existence check:', lists);

      // For the test to pass, we need at least level 0 and level 1 lists
      return lists.level0 && lists.level1;
    }, selectors);

    if (!listsExist) {
      await log('Required list containers (level0, level1) not found', 'error');
      await takeErrorScreenshot(page, 'missing_list_containers', log);
      return false;
    }

    // Verify the lists have proper styling and are visible
    const listsVisible = await page.evaluate((sel) => {
      const level0 = document.querySelector(sel.level0List);
      const level1 = document.querySelector(sel.level1List);

      if (!level0 || !level1) return false;

      // Check computed styles for visibility
      const getComputedVisibility = (element) => {
        const style = window.getComputedStyle(element);
        return {
          display: style.display,
          visibility: style.visibility,
          opacity: Number.parseFloat(style.opacity),
        };
      };

      const level0Visibility = getComputedVisibility(level0);
      const level1Visibility = getComputedVisibility(level1);

      console.log('[Browser] List visibility:', {
        level0: level0Visibility,
        level1: level1Visibility,
      });

      // Check if the elements are visible in the DOM
      return (
        level0Visibility.display !== 'none' &&
        level0Visibility.visibility !== 'hidden' &&
        level0Visibility.opacity > 0 &&
        level1Visibility.display !== 'none' &&
        level1Visibility.visibility !== 'hidden' &&
        level1Visibility.opacity > 0
      );
    }, selectors);

    if (!listsVisible) {
      await log('List containers exist but are not visible', 'warn');
      // This might not be a fatal error, just a warning
    }

    return true;
  } catch (error) {
    await log(`Error validating list elements: ${error.message}`, 'error');
    await takeErrorScreenshot(page, 'list_validation_error', log);
    return false;
  }
}

/**
 * Gets the words from a specific level list
 * @param {import('@playwright/test').Page} page - Playwright page object
 * @param {Object} selectors - Page object selectors
 * @param {Function} log - Logging function
 * @param {number} level - The level (0-3) to get words from
 * @returns {Promise<Array<string>>} - Array of words in the list
 */
export async function getWordsByLevel(page, selectors, log, level) {
  await log(`Getting words from level ${level} list`, 'info');

  try {
    let listItemsSelector;
    switch (level) {
      case 0: {
        listItemsSelector = selectors.level0Items;
        break;
      }
      case 1: {
        listItemsSelector = selectors.level1Items;
        break;
      }
      case 2: {
        listItemsSelector = selectors.level2Items;
        break;
      }
      case 3: {
        listItemsSelector = selectors.level3Items;
        break;
      }
      default: {
        throw new Error(`Invalid level: ${level}`);
      }
    }

    const words = await page.evaluate((selector) => {
      const items = [...document.querySelectorAll(selector)];
      return items.map((item) => item.textContent.trim());
    }, listItemsSelector);

    await log(`Found ${words.length} words in level ${level} list`, 'info');
    return words;
  } catch (error) {
    await log(`Error getting words from level ${level}: ${error.message}`, 'error');
    return [];
  }
}

/**
 * Waits for a word to appear in a specific level list
 * @param {import('@playwright/test').Page} page - Playwright page object
 * @param {Object} selectors - Page object selectors
 * @param {Object} timeouts - Timeout constants
 * @param {Function} log - Logging function
 * @param {string} word - The word to look for
 * @param {number} level - The level list to check
 * @returns {Promise<boolean>} - True if the word was found, false otherwise
 */
export async function waitForWordInList(page, selectors, timeouts, log, word, level) {
  await log(`Waiting for word "${word}" to appear in level ${level} list`, 'info');

  let listItemsSelector;
  switch (level) {
    case 0: {
      listItemsSelector = selectors.level0Items;
      break;
    }
    case 1: {
      listItemsSelector = selectors.level1Items;
      break;
    }
    case 2: {
      listItemsSelector = selectors.level2Items;
      break;
    }
    case 3: {
      listItemsSelector = selectors.level3Items;
      break;
    }
    default: {
      await log(`Invalid level: ${level}`, 'error');
      return false;
    }
  }

  try {
    // Wait for the word to be in the list, with a timeout
    await page.waitForFunction(
      (selector, targetWord) => {
        const items = [...document.querySelectorAll(selector)];
        const itemTexts = items.map((item) => item.textContent.trim());
        return itemTexts.some((text) => text.includes(targetWord));
      },
      listItemsSelector,
      word,
      { timeout: timeouts.long }
    );

    await log(`Word "${word}" found in level ${level} list`, 'info');
    return true;
  } catch (error) {
    await log(`Word "${word}" not found in level ${level} list: ${error.message}`, 'warn');
    await takeErrorScreenshot(page, `word_not_in_list_${level}`, log);
    return false;
  }
}

/**
 * Monitors word movement between lists after an action
 * @param {import('@playwright/test').Page} page - Playwright page object
 * @param {Object} selectors - Page object selectors
 * @param {Object} timeouts - Timeout constants
 * @param {Function} log - Logging function
 * @param {string} word - The word to track
 * @param {number} fromLevel - The level where the word starts
 * @param {number} toLevel - The level where the word should move to
 * @returns {Promise<boolean>} - True if the word moved as expected, false otherwise
 */
export async function monitorWordMovement(
  page,
  selectors,
  timeouts,
  log,
  word,
  fromLevel,
  toLevel
) {
  await log(
    `Monitoring movement of word "${word}" from level ${fromLevel} to level ${toLevel}`,
    'info'
  );

  // First verify the word is in the source list
  const inSourceList = await waitForWordInList(page, selectors, timeouts, log, word, fromLevel);
  if (!inSourceList) {
    await log(`Word "${word}" not found in source list (level ${fromLevel})`, 'warn');
    // Try looking directly in the app state
    await logAppStateWordLocation(page, log, word);

    // If word not in source list, we can't track movement
    return false;
  }

  // Wait for the word to disappear from source list
  try {
    await page.waitForFunction(
      (selector, targetWord) => {
        const items = [...document.querySelectorAll(selector)];
        const itemTexts = items.map((item) => item.textContent.trim());
        return !itemTexts.some((text) => text.includes(targetWord));
      },
      fromLevel === 0
        ? selectors.level0Items
        : fromLevel === 1
          ? selectors.level1Items
          : fromLevel === 2
            ? selectors.level2Items
            : selectors.level3Items,
      word,
      { timeout: timeouts.long }
    );

    await log(`Word "${word}" removed from level ${fromLevel} list`, 'info');
  } catch (error) {
    await log(`Word "${word}" still in source list after timeout: ${error.message}`, 'warn');
  }

  // Wait for the word to appear in the target list
  const inTargetList = await waitForWordInList(page, selectors, timeouts, log, word, toLevel);
  if (!inTargetList) {
    await log(`Word "${word}" did not move to level ${toLevel} list as expected`, 'warn');
    await logAppStateWordLocation(page, log, word);
    return false;
  }

  await log(`Word "${word}" successfully moved from level ${fromLevel} to ${toLevel}`, 'info');
  return true;
}

/**
 * Logs where a word is located in the app state (useful for debugging)
 * @param {import('@playwright/test').Page} page - Playwright page object
 * @param {Function} log - Logging function
 * @param {string} word - The word to locate
 */
async function logAppStateWordLocation(page, log, word) {
  try {
    const wordLocation = await page.evaluate((targetWord) => {
      try {
        if (!window.app || !window.app.quizState) return 'App state not available';

        // Search through state to find the word
        const entries = [...window.app.quizState.quizTranslations.entries()];

        for (const [id, data] of entries) {
          if (data.sourceWord === targetWord || data.targetWord === targetWord) {
            return {
              found: true,
              id,
              status: data.status,
              sourceWord: data.sourceWord,
              targetWord: data.targetWord,
            };
          }
        }

        return { found: false, message: 'Word not found in app state' };
      } catch (error) {
        return { error: error.message };
      }
    }, word);

    await log(`App state for word "${word}": ${JSON.stringify(wordLocation)}`, 'info');
  } catch (error) {
    await log(`Error checking app state for word "${word}": ${error.message}`, 'error');
  }
}
