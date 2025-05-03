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

// packages/frontend/tests/unit/app.state.test.js
import {
  STATUS,
  DIRECTION,
  MAX_FOCUS_WORDS,
  MAX_MISTAKES_BEFORE_DEGRADATION,
} from '../../src/js/constants.js';
import { errorHandler } from '../../src/js/utils/errorHandler.js';
import { suppressConsoleOutput } from '../__mocks__/browserMocks.js';
import { createMockApp, createRealApp } from './test-utils/app-test-utils.js';
import { mockQuizData, smallTestSet, createDataWithStatuses } from './test-utils/quiz-test-data.js';

// Mock errorHandler - using centralized mock approach
jest.mock('../../src/js/utils/errorHandler.js', () => ({
  errorHandler: require('../__mocks__/utils/errorHandler').errorHandler,
}));

describe('App State Management', () => {
  let app;
  let mocks;
  let consoleWarnSpy;
  let consoleErrorSpy;

  beforeEach(() => {
    // Create mock app with components for isolated testing
    const mockAppData = createMockApp(mockQuizData);
    app = mockAppData.app;
    mocks = mockAppData.mocks;

    // Set up console spies
    consoleWarnSpy = jest.spyOn(console, 'warn');
    consoleErrorSpy = jest.spyOn(console, 'error');

    // Suppress console output for cleaner tests
    suppressConsoleOutput();

    // Reset error handler
    errorHandler._reset();
  });

  afterEach(() => {
    // Make sure to restore all spies
    if (consoleWarnSpy) consoleWarnSpy.mockRestore();
    if (consoleErrorSpy) consoleErrorSpy.mockRestore();
  });

  // Base getter tests
  describe('Base State Getters', () => {
    it('should provide access to word status sets', () => {
      const sets = app.currentWordStatusSets;
      expect(sets).toBe(app.quizState.wordStatusSets);
      expect(sets[STATUS.LEVEL_0]).toBeDefined();
      expect(sets[STATUS.LEVEL_1]).toBeDefined();
      expect(sets[STATUS.LEVEL_2]).toBeDefined();
      expect(sets[STATUS.LEVEL_3]).toBeDefined();
    });

    it('should provide access to quiz translations', () => {
      const translations = app.currentQuizTranslations;
      expect(translations).toBe(app.quizState.quizTranslations);
      expect(translations.size).toBeGreaterThan(0);
    });

    it('should return correct direction label', () => {
      app.quizState.direction = DIRECTION.NORMAL;
      expect(app.currentDirectionLabel).toBe('Normal');

      app.quizState.direction = DIRECTION.REVERSE;
      expect(app.currentDirectionLabel).toBe('Reverse');
    });
  });

  // State manager tests
  describe('State Manager Functionality', () => {
    it('should delegate populateFocusWords to stateManager', () => {
      // Set mocks and test delegation
      mocks.stateManager.populateFocusWords.mockReturnValue(true);

      // Test by calling App's public API
      const result = app.stateManager.populateFocusWords(MAX_FOCUS_WORDS);

      expect(mocks.stateManager.populateFocusWords).toHaveBeenCalledWith(MAX_FOCUS_WORDS);
      expect(result).toBe(true);
    });

    it('should delegate moveWordToStatus to stateManager', () => {
      // Set mocks and test delegation
      mocks.stateManager.moveWordToStatus.mockReturnValue(true);

      // Test by calling the method through the App's stateManager
      const wordId = 1;
      const newStatus = STATUS.LEVEL_1;
      const result = app.stateManager.moveWordToStatus(wordId, newStatus);

      expect(mocks.stateManager.moveWordToStatus).toHaveBeenCalledWith(wordId, newStatus);
      expect(result).toBe(true);
    });

    it('should delegate degradeWordLevel to stateManager', () => {
      // Set mocks and test delegation
      mocks.stateManager.degradeWordLevel.mockReturnValue(true);

      // Test by calling the method through the App's stateManager
      const wordId = 2;
      const result = app.stateManager.degradeWordLevel(wordId);

      expect(mocks.stateManager.degradeWordLevel).toHaveBeenCalledWith(wordId);
      expect(result).toBe(true);
    });
  });

  // Integration tests with real components
  describe('State Management Integration', () => {
    let realApp;

    beforeEach(() => {
      // Create a real app with actual components for integration testing
      const customData = createDataWithStatuses({
        1: STATUS.LEVEL_0,
        2: STATUS.LEVEL_1,
        3: STATUS.LEVEL_2,
        4: STATUS.LEVEL_3,
      });

      realApp = createRealApp(customData);
    });

    it('should properly initialize word status sets', () => {
      // Check that words are in the correct status sets
      expect(realApp.quizState.wordStatusSets[STATUS.LEVEL_0].has(1)).toBe(true);
      expect(realApp.quizState.wordStatusSets[STATUS.LEVEL_1].has(2)).toBe(true);
      expect(realApp.quizState.wordStatusSets[STATUS.LEVEL_2].has(3)).toBe(true);
      expect(realApp.quizState.wordStatusSets[STATUS.LEVEL_3].has(4)).toBe(true);
    });

    it('should move words between status sets', () => {
      // Test moving a word from L1 to L2
      realApp.stateManager.moveWordToStatus(2, STATUS.LEVEL_2);

      // Verify the word moved
      expect(realApp.quizState.wordStatusSets[STATUS.LEVEL_1].has(2)).toBe(false);
      expect(realApp.quizState.wordStatusSets[STATUS.LEVEL_2].has(2)).toBe(true);
      expect(realApp.quizState.quizTranslations.get(2).status).toBe(STATUS.LEVEL_2);
    });

    it('should handle degrade word level', () => {
      // Test degrading a word from L3 to L2
      const result = realApp.stateManager.degradeWordLevel(4);

      // Verify the word was degraded
      expect(result).toBe(true);
      expect(realApp.quizState.wordStatusSets[STATUS.LEVEL_3].has(4)).toBe(false);
      expect(realApp.quizState.wordStatusSets[STATUS.LEVEL_2].has(4)).toBe(true);
      expect(realApp.quizState.quizTranslations.get(4).status).toBe(STATUS.LEVEL_2);
    });

    it('should populate focus words when needed', () => {
      // Clear L1 and set up L0 with words
      realApp.quizState.wordStatusSets[STATUS.LEVEL_1].clear();

      // Update the status in the translations map to match
      realApp.quizState.quizTranslations.get(2).status = STATUS.LEVEL_0;
      realApp.quizState.wordStatusSets[STATUS.LEVEL_0].add(2);

      // Populate focus words
      const result = realApp.stateManager.populateFocusWords(MAX_FOCUS_WORDS);

      // Verify words were moved to focus
      expect(result).toBe(true);
      expect(realApp.quizState.wordStatusSets[STATUS.LEVEL_1].size).toBeGreaterThan(0);
    });
  });
});
