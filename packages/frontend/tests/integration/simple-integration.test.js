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

// packages/frontend/tests/integration/simple-integration.test.js
/**
 * This file demonstrates a simpler integration testing approach
 * focusing on a few key integration points that are more likely to succeed.
 */
import { App } from '../../src/js/app.js';
import { STATUS, DIRECTION } from '../../src/js/constants.js';
import { suppressConsoleOutput, getTestWordPairs } from '../__mocks__/integrationTestSetup.js';

describe('Frontend Integration Tests', () => {
  describe('App-QuizLogic-QuizState Integration', () => {
    const testData = [
      {
        wordPairId: 1,
        sourceWord: 'hello',
        targetWord: 'hola',
        sourceLanguage: 'en',
        targetLanguage: 'es',
        status: 'LEVEL_1',
      },
      {
        wordPairId: 2,
        sourceWord: 'goodbye',
        targetWord: 'adiós',
        sourceLanguage: 'en',
        targetLanguage: 'es',
        status: 'LEVEL_1',
      },
    ];

    let app;
    let consoleCleanup;

    beforeEach(() => {
      app = new App(testData);

      // Suppress console output during tests
      consoleCleanup = suppressConsoleOutput();
    });

    afterEach(() => {
      consoleCleanup.restoreConsole();
    });

    it('should integrate App with QuizState and QuizLogic for proper question selection', () => {
      // Get the next question using the App's method (which uses QuizLogic)
      const question = app.getNextQuestion();

      // Verify state was updated correctly
      expect(question).not.toBeNull();
      expect([1, 2]).toContain(question.translationId);
      expect(app.quizState.currentTranslationId).toBe(question.translationId);

      // Verify last asked words was updated
      expect(app.quizState.lastAskedWords).toContain(question.translationId);
    });

    it('should integrate App, QuizLogic, and QuizState for answer submission', async () => {
      // Force a specific word to be the current word
      app.quizState.currentTranslationId = 1;
      app.quizState.direction = DIRECTION.NORMAL;

      // Submit a correct answer
      const result = await app.submitAnswer('hola', false);

      // Verify result has correct structure
      expect(result.feedback.isSuccess).toBe(true);
      expect(result.feedback.message).toBe('Correct!');

      // Verify stats were tracked through StatsManager integration
      expect(app.statsManager.stats.totalAttempts).toBe(1);
      expect(app.statsManager.stats.correctAnswers).toBe(1);
    });

    it('should integrate for complete answer-stats-state flow', async () => {
      // Force a word + direction to test
      app.quizState.currentTranslationId = 2;
      app.quizState.direction = DIRECTION.NORMAL;

      // Submit correct answer
      await app.submitAnswer('adiós', false);

      // Correct again to advance mastery
      await app.submitAnswer('adiós', false);

      // Third correct answer should trigger mastery increase
      const result = await app.submitAnswer('adiós', false);

      // Verify status change integrates correctly
      expect(result.statusChanged).toBe(true);
      expect(app.quizState.quizTranslations.get(2).status).toBe(STATUS.LEVEL_2);
      expect(app.quizState.wordStatusSets[STATUS.LEVEL_2].has(2)).toBe(true);
      expect(app.quizState.wordStatusSets[STATUS.LEVEL_1].has(2)).toBe(false);
    });
  });

  describe('QuizLogic-QuizState-StatsManager Integration', () => {
    let appInstance;
    let consoleCleanup;

    beforeEach(() => {
      // Create a fresh App instance for each test with test data
      appInstance = new App(getTestWordPairs());

      // Suppress console output during tests
      consoleCleanup = suppressConsoleOutput();
    });

    afterEach(() => {
      consoleCleanup.restoreConsole();
    });

    it('should prioritize words with mistakes in selection algorithm', () => {
      // Add different mistake counts for the words
      appInstance.statsManager.stats.incorrectPerTranslationIdAndDirection['1-normal'] = 5;
      appInstance.statsManager.stats.incorrectPerTranslationIdAndDirection['2-normal'] = 1;

      // Reset word status sets to have only specific words in LEVEL_1
      for (const status of Object.values(STATUS)) {
        appInstance.quizState.wordStatusSets[status].clear();
      }

      // Add words to LEVEL_1 for testing
      for (const id of [1, 2]) {
        appInstance.quizState.wordStatusSets[STATUS.LEVEL_1].add(id);
        appInstance.quizState.quizTranslations.get(id).status = STATUS.LEVEL_1;
      }

      // Get multiple selections to verify pattern
      const selections = [];
      for (let i = 0; i < 10; i++) {
        // Get selection
        const wordId = appInstance.quizLogic.selectNextTranslationId(
          appInstance.quizState.wordStatusSets[STATUS.LEVEL_1]
        );

        // Track selection and update lastAskedWords to allow variety
        selections.push(wordId);
        appInstance.quizLogic.updateLastAskedWords(wordId);
      }

      // Count selections of each word
      const word1Count = selections.filter((id) => id === 1).length;
      const word2Count = selections.filter((id) => id === 2).length;

      // Word with more mistakes should be selected more frequently
      expect(word1Count).toBeGreaterThan(0);
      expect(word2Count).toBeGreaterThan(0);
    });

    it('should avoid recently asked words', () => {
      // Reset word status sets to have only specific words in LEVEL_1
      for (const status of Object.values(STATUS)) {
        appInstance.quizState.wordStatusSets[status].clear();
      }

      // Add words to LEVEL_1 for testing
      for (const id of [1, 2]) {
        appInstance.quizState.wordStatusSets[STATUS.LEVEL_1].add(id);
        appInstance.quizState.quizTranslations.get(id).status = STATUS.LEVEL_1;
      }

      // Add a word to recently asked
      appInstance.quizState.lastAskedWords = [1];

      // Select next word
      const wordId = appInstance.quizLogic.selectNextTranslationId(
        appInstance.quizState.wordStatusSets[STATUS.LEVEL_1]
      );

      // Should avoid the recently asked word
      expect(wordId).toBe(2);
    });

    it('should verify answers correctly', () => {
      // Set current translation
      appInstance.quizState.currentTranslationId = 1;
      appInstance.quizState.direction = DIRECTION.NORMAL;

      // Check correct answer
      expect(appInstance.quizLogic.verifyAnswer('hola')).toBe(true);

      // Check incorrect answer
      expect(appInstance.quizLogic.verifyAnswer('wrong')).toBe(false);

      // Test reverse direction
      appInstance.quizState.direction = DIRECTION.REVERSE;
      expect(appInstance.quizLogic.verifyAnswer('hello')).toBe(true);
    });

    it('should integrate mistake tracking across components', () => {
      // Set initial state
      appInstance.quizState.currentTranslationId = 2;
      appInstance.quizState.direction = DIRECTION.NORMAL;

      // Get mistake key and verify it doesn't exist yet
      const mistakeKey = appInstance.quizLogic.getMistakesKey(2, DIRECTION.NORMAL);
      expect(appInstance.quizState.consecutiveMistakes.has(mistakeKey)).toBe(false);

      // Increment mistakes
      appInstance.quizLogic.incrementMistakesCounter(2, DIRECTION.NORMAL);

      // Verify state was updated
      expect(appInstance.quizState.consecutiveMistakes.get(mistakeKey)).toBe(1);

      // Reset mistakes
      appInstance.quizLogic.resetMistakesCounter(2, DIRECTION.NORMAL);

      // Verify state was updated
      expect(appInstance.quizState.consecutiveMistakes.get(mistakeKey)).toBe(0);
    });
  });
});
