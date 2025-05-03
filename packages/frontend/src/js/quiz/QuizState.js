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

// packages/frontend/src/js/quiz/QuizState.js
import { STATUS, DIRECTION } from '../constants.js';

/**
 * Holds the core state of the quiz application.
 */
export class QuizState {
  quizTranslations = new Map(); // Map<wordPairId, TranslationEntry>
  wordStatusSets = {
    [STATUS.LEVEL_1]: new Set(), // Set<wordPairId>
    [STATUS.LEVEL_2]: new Set(), // Set<wordPairId>
    [STATUS.LEVEL_3]: new Set(), // Set<wordPairId>
    [STATUS.LEVEL_0]: new Set(), // Set<wordPairId>
  };
  currentTranslationId = null; // The ID of the word currently being asked
  sourceLanguage = '';
  targetLanguage = '';
  direction = DIRECTION.NORMAL; // Current quiz direction
  lastAskedWords = []; // Array<wordPairId> of recently asked words
  consecutiveMistakes = new Map(); // Map<mistakeKey, count>

  /**
   * @typedef {object} TranslationEntry
   * @property {number} wordPairId
   * @property {string} sourceWord
   * @property {string} targetWord
   * @property {string} sourceLanguage
   * @property {string} targetLanguage
   * @property {string} status - Current learning status (e.g., STATUS.LEVEL_1)
   * @property {string|null} sourceWordUsageExample
   * @property {string|null} targetWordUsageExample
   */

  constructor() {
    // Initial state is set up by the App class during initializeData
  }

  // Optional: Add basic getter methods if needed later
  getWordPair(id) {
    return this.quizTranslations.get(id);
  }

  getWordSet(status) {
    return this.wordStatusSets[status];
  }

  getTotalWordCount() {
    return this.quizTranslations.size;
  }
}
