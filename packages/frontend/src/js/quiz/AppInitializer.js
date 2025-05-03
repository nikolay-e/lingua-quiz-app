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

// packages/frontend/src/js/quiz/AppInitializer.js
import { STATUS } from '../constants.js';
import { errorHandler } from '../utils/errorHandler.js';

/**
 * Handles initialization of the App with translation data.
 */
export class AppInitializer {
  /**
   * @param {import('./QuizState.js').QuizState} quizState
   * @param {import('./AppStateManager.js').AppStateManager} stateManager
   */
  constructor(quizState, stateManager) {
    this.quizState = quizState;
    this.stateManager = stateManager;
  }

  /**
   * Initializes App data with translation entries.
   * @param {Array<Object>} data - Array of translation entries.
   */
  initializeData(data) {
    console.debug(
      '[AppInitializer] Initializing data with:',
      Array.isArray(data) ? `${data.length} items` : 'non-array data'
    );

    if (!Array.isArray(data) || data.length === 0) {
      console.error('[AppInitializer] Invalid data format:', data);
      throw new Error('Invalid or insufficient data provided.');
    }

    try {
      // Log the first entry to check properties
      console.debug('[AppInitializer] First data entry:', JSON.stringify(data[0]));

      // More robust handling of language data with detailed logging
      try {
        const firstItem = data[0];

        // Safe access to properties with fallbacks
        this.quizState.sourceLanguage = firstItem.sourceLanguage || firstItem.source || 'Source';
        this.quizState.targetLanguage = firstItem.targetLanguage || firstItem.target || 'Target';

        console.debug(
          `[AppInitializer] Languages set: ${this.quizState.sourceLanguage} → ${this.quizState.targetLanguage}`
        );
      } catch (error) {
        console.error(`[AppInitializer] Error setting languages:`, error);
        this.quizState.sourceLanguage = 'Source';
        this.quizState.targetLanguage = 'Target';
      }

      for (const entry of data) {
        // Debug individual entry properties
        if (entry && typeof entry === 'object') {
          console.debug(
            `[AppInitializer] Processing entry: wordPairId=${entry.wordPairId}, source=${entry.sourceWord}, ` +
              `target=${entry.targetWord}, status=${entry.status}`
          );
        }

        if (
          typeof entry !== 'object' ||
          entry.wordPairId === undefined ||
          entry.wordPairId === null
        ) {
          console.warn('[AppInitializer] Invalid word entry (missing or null wordPairId):', entry);
          continue;
        }

        const { wordPairId } = entry;
        // Ensure status is valid, default to LEVEL_0 otherwise
        const status = Object.values(STATUS).includes(entry.status) ? entry.status : STATUS.LEVEL_0;

        // Store the full translation data in the map
        this.quizState.quizTranslations.set(wordPairId, { ...entry, status }); // Ensure status in map is correct
        // Add the word ID to the appropriate status set
        this.stateManager.addWordToStatusSet(wordPairId, status);
      }

      console.debug(
        `[AppInitializer] Added ${this.quizState.quizTranslations.size} valid translations`
      );

      if (this.quizState.quizTranslations.size === 0) {
        console.error('[AppInitializer] No valid entries found in data');
        throw new Error('No valid entries added to quizTranslations');
      }
    } catch (error) {
      console.error('[AppInitializer] Error initializing data:', error);
      throw error;
    }
  }

  /**
   * Factory function to validate data and create App instances.
   * @param {Array<Object>} data - Array of translation entries.
   * @param {Function} createAppCallback - Function to create an App instance with validated data.
   * @returns {Object} - Created App instance.
   */
  static validateDataAndCreateApp(data, createAppCallback) {
    console.debug(
      '[AppInitializer.validateDataAndCreateApp] Validating data:',
      data
        ? `${Array.isArray(data) ? data.length : 'non-array'} data item(s)`
        : 'null/undefined data'
    );

    // Check data validity before proceeding
    if (!data) {
      const error = new Error('[AppInitializer] No data provided to createApp');
      console.error(error.message);
      errorHandler.handleApiError(error);
      throw error;
    }

    if (!Array.isArray(data)) {
      const error = new Error(`[AppInitializer] Expected array but got ${typeof data}`);
      console.error(error.message, data);
      errorHandler.handleApiError(error);
      throw error;
    }

    if (data.length === 0) {
      const error = new Error('[AppInitializer] Empty array provided to createApp');
      console.error(error.message);
      errorHandler.handleApiError(error);
      throw error;
    }

    // Check for specific data issues that could cause the "source" property error
    const problemItems = [];
    for (const [index, item] of data.entries()) {
      if (!item) {
        console.error(`[AppInitializer] Item at index ${index} is null or undefined`);
        problemItems.push({ index, error: 'null or undefined', value: item });
      } else if (typeof item !== 'object') {
        console.error(`[AppInitializer] Item at index ${index} is not an object: ${typeof item}`);
        problemItems.push({ index, error: `not an object, but ${typeof item}`, value: item });
      } else if (!item.sourceWord) {
        console.error(`[AppInitializer] Item at index ${index} is missing sourceWord:`, item);
        problemItems.push({ index, error: 'missing sourceWord', value: item });
      } else if (!item.targetWord) {
        console.error(`[AppInitializer] Item at index ${index} is missing targetWord:`, item);
        problemItems.push({ index, error: 'missing targetWord', value: item });
      } else if (!item.wordPairId && item.wordPairId !== 0) {
        console.error(`[AppInitializer] Item at index ${index} is missing wordPairId:`, item);
        problemItems.push({ index, error: 'missing wordPairId', value: item });
      }
    }

    if (problemItems.length > 0) {
      console.warn(
        `[AppInitializer] Found ${problemItems.length} problem items in data:`,
        JSON.stringify(problemItems.slice(0, 3))
      );

      if (problemItems.length === data.length) {
        const error = new Error('[AppInitializer] All items in data are invalid');
        console.error(error.message);
        errorHandler.handleApiError(error);
        throw error;
      }

      // Print the first valid item as an example of proper format
      const validExample = data.find((item, index) => !problemItems.some((p) => p.index === index));
      if (validExample) {
        console.info(
          '[AppInitializer] Example of valid item format:',
          JSON.stringify(validExample)
        );
      }
    }

    try {
      const app = createAppCallback(data);
      console.debug('[AppInitializer] Successfully created App instance');
      return app;
    } catch (error) {
      console.error('[AppInitializer] Error creating App instance:', error);
      // Log call stack to help diagnose where the error is coming from
      console.error('[AppInitializer] Error stack:', error.stack);
      errorHandler.handleApiError(error);
      throw error; // Re-throw to indicate failure
    }
  }
}
