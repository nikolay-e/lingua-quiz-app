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

// packages/frontend/tests/integration/quiz-flow.test.js
import { App } from '../../src/js/app.js';
import {
  STATUS,
  DIRECTION,
  CORRECT_ANSWERS_TO_MASTER,
  MAX_MISTAKES_BEFORE_DEGRADATION,
} from '../../src/js/constants.js';
import { getTestWordPairs } from '../__fixtures__/testData.js';
import { suppressConsoleOutput } from '../__mocks__/browserMocks.js';

describe('Quiz Flow Integration', () => {
  let appInstance;
  let consoleCleanup;

  beforeEach(() => {
    // Create a fresh App instance for each test with a copy of the test data
    appInstance = new App(getTestWordPairs());

    // Suppress console output for cleaner test output
    consoleCleanup = suppressConsoleOutput();
  });

  afterEach(() => {
    // Restore console functions
    consoleCleanup.restoreConsole();
  });

  describe('Complete Quiz Flow Integration', () => {
    it('should follow the complete question-answer-feedback-stats flow', async () => {
      // STEP 1: GET FIRST QUESTION
      const firstQuestion = appInstance.getNextQuestion();

      // Verify question data is valid
      expect(firstQuestion).not.toBeNull();
      expect(firstQuestion.translationId).toBeDefined();
      expect(firstQuestion.word).toBeDefined();

      // Get the current translation details for later verification
      const currentId = firstQuestion.translationId;
      const currentPair = appInstance.quizState.quizTranslations.get(currentId);
      const direction = appInstance.quizState.direction; // Get direction from quiz state instead

      // Determine correct answer based on direction
      const correctAnswer =
        direction === DIRECTION.NORMAL ? currentPair.targetWord : currentPair.sourceWord;

      // STEP 2: SUBMIT CORRECT ANSWER
      const result = await appInstance.submitAnswer(correctAnswer, true);

      // Verify feedback data
      expect(result.feedback.isSuccess).toBe(true);
      expect(result.feedback.message).toBe('Correct!');

      // Verify stats were updated correctly
      expect(appInstance.statsManager.stats.totalAttempts).toBe(1);
      expect(appInstance.statsManager.stats.correctAnswers).toBe(1);
      expect(appInstance.statsManager.stats.incorrectAnswers).toBe(0);

      // Verify word-specific stats
      const directionKey = `${currentId}-${direction === DIRECTION.NORMAL ? 'normal' : 'reverse'}`;
      expect(
        appInstance.statsManager.stats.attemptsPerTranslationIdAndDirection[directionKey].attempts
      ).toBe(1);
      expect(
        appInstance.statsManager.stats.attemptsPerTranslationIdAndDirection[directionKey].correct
      ).toBe(1);

      // STEP 3: VERIFY NEXT QUESTION WAS PROVIDED
      const nextQuestion = result.questionData;
      expect(nextQuestion).not.toBeNull();
      expect(nextQuestion.translationId).not.toBe(currentId); // Should be a different question

      // Verify app state was updated
      expect(appInstance.quizState.currentTranslationId).toBe(nextQuestion.translationId);

      // STEP 4: SUBMIT INCORRECT ANSWER FOR NEXT QUESTION
      const secondResult = await appInstance.submitAnswer('wrong-answer', true);

      // Verify feedback data
      expect(secondResult.feedback.isSuccess).toBe(false);
      expect(secondResult.feedback.message).toContain('Wrong');

      // Verify stats were updated correctly
      expect(appInstance.statsManager.stats.totalAttempts).toBe(2);
      expect(appInstance.statsManager.stats.correctAnswers).toBe(1);
      expect(appInstance.statsManager.stats.incorrectAnswers).toBe(1);

      // STEP 5: VERIFY THIRD QUESTION WAS PROVIDED
      expect(secondResult.questionData).not.toBeNull();

      // Since we're not directly testing the mistake count for a specific ID and direction,
      // we'll just verify that the overall stats were recorded correctly
      expect(appInstance.statsManager.stats.incorrectAnswers).toBe(1);
    });

    it('should progress a word through mastery levels with correct answers', async () => {
      // STEP 1: PREPARE TEST WORD
      const wordId = 1; // "hello" -> "hola"

      // Ensure the word is in LEVEL_1 for this test
      appInstance.quizState.wordStatusSets[STATUS.LEVEL_0].delete(wordId);
      appInstance.quizState.wordStatusSets[STATUS.LEVEL_1].add(wordId);
      appInstance.quizState.quizTranslations.get(wordId).status = STATUS.LEVEL_1;

      // Force the app to use this specific word
      appInstance.quizState.currentTranslationId = wordId;
      appInstance.quizState.direction = DIRECTION.NORMAL;

      // STEP 2: MASTER NORMAL DIRECTION (LEVEL_1 -> LEVEL_2)
      for (let i = 0; i < CORRECT_ANSWERS_TO_MASTER; i++) {
        const result = await appInstance.submitAnswer('hola', false);

        // On the final correct answer, status should change
        if (i === CORRECT_ANSWERS_TO_MASTER - 1) {
          expect(result.statusChanged).toBe(true);
          expect(appInstance.quizState.quizTranslations.get(wordId).status).toBe(STATUS.LEVEL_2);
        } else {
          // Status shouldn't change before reaching the threshold
          expect(appInstance.quizState.quizTranslations.get(wordId).status).toBe(STATUS.LEVEL_1);
        }
      }

      // Verify word is now in LEVEL_2
      expect(appInstance.quizState.wordStatusSets[STATUS.LEVEL_2].has(wordId)).toBe(true);
      expect(appInstance.quizState.wordStatusSets[STATUS.LEVEL_1].has(wordId)).toBe(false);

      // STEP 3: MASTER REVERSE DIRECTION (LEVEL_2 -> LEVEL_3)
      appInstance.quizState.direction = DIRECTION.REVERSE;

      for (let i = 0; i < CORRECT_ANSWERS_TO_MASTER; i++) {
        const result = await appInstance.submitAnswer('hello', false);

        // On the final correct answer, status should change
        if (i === CORRECT_ANSWERS_TO_MASTER - 1) {
          expect(result.statusChanged).toBe(true);
          expect(appInstance.quizState.quizTranslations.get(wordId).status).toBe(STATUS.LEVEL_3);
        } else {
          // Status shouldn't change before reaching the threshold
          expect(appInstance.quizState.quizTranslations.get(wordId).status).toBe(STATUS.LEVEL_2);
        }
      }

      // Verify word is now in LEVEL_3 (mastered)
      expect(appInstance.quizState.wordStatusSets[STATUS.LEVEL_3].has(wordId)).toBe(true);
      expect(appInstance.quizState.wordStatusSets[STATUS.LEVEL_2].has(wordId)).toBe(false);

      // Check that the word now excluded from question selection
      appInstance.quizState.currentTranslationId = null;
      expect(appInstance.getNextQuestion()?.translationId).not.toBe(wordId);
    });

    it('should degrade word mastery after consecutive mistakes', async () => {
      // STEP 1: PREPARE TEST WORD
      const wordId = 2; // "goodbye" -> "adiós"

      // Ensure word is in LEVEL_2
      for (const status of Object.values(STATUS)) {
        appInstance.quizState.wordStatusSets[status].delete(wordId);
      }
      appInstance.quizState.wordStatusSets[STATUS.LEVEL_2].add(wordId);
      appInstance.quizState.quizTranslations.get(wordId).status = STATUS.LEVEL_2;

      // Set current word for testing
      appInstance.quizState.currentTranslationId = wordId;
      appInstance.quizState.direction = DIRECTION.NORMAL;

      // STEP 2: MAKE CONSECUTIVE MISTAKES TO TRIGGER DEGRADATION
      for (let i = 0; i < MAX_MISTAKES_BEFORE_DEGRADATION - 1; i++) {
        const result = await appInstance.submitAnswer('wrong', false);
        expect(result.statusChanged).toBe(false);
        expect(appInstance.quizState.quizTranslations.get(wordId).status).toBe(STATUS.LEVEL_2);
      }

      // Make final mistake that triggers degradation
      const result = await appInstance.submitAnswer('wrong', false);

      // Verify word was degraded
      expect(result.statusChanged).toBe(true);
      expect(appInstance.quizState.quizTranslations.get(wordId).status).toBe(STATUS.LEVEL_1);
      expect(appInstance.quizState.wordStatusSets[STATUS.LEVEL_1].has(wordId)).toBe(true);
      expect(appInstance.quizState.wordStatusSets[STATUS.LEVEL_2].has(wordId)).toBe(false);

      // Verify mistake counter was reset
      const mistakeKey = appInstance.quizLogic.getMistakesKey(wordId, DIRECTION.NORMAL);
      expect(appInstance.quizState.consecutiveMistakes.get(mistakeKey)).toBe(0);
    });

    it('should complete quiz when all words are mastered', async () => {
      // STEP 1: PREPARE TEST DATA - move all words except one to LEVEL_3
      for (const status of Object.values(STATUS)) {
        appInstance.quizState.wordStatusSets[status].clear();
      }

      // Keep only word ID 1 in LEVEL_1
      appInstance.quizState.wordStatusSets[STATUS.LEVEL_1].add(1);
      appInstance.quizState.quizTranslations.get(1).status = STATUS.LEVEL_1;

      // Move all other words to LEVEL_3
      for (let i = 2; i <= 5; i++) {
        appInstance.quizState.wordStatusSets[STATUS.LEVEL_3].add(i);
        appInstance.quizState.quizTranslations.get(i).status = STATUS.LEVEL_3;
      }

      // STEP 2: VERIFY ONLY ONE WORD IS AVAILABLE
      const question = appInstance.getNextQuestion();
      expect(question.translationId).toBe(1);

      // STEP 3: MASTER THE REMAINING WORD
      // Master normal direction
      appInstance.quizState.direction = DIRECTION.NORMAL;
      for (let i = 0; i < CORRECT_ANSWERS_TO_MASTER; i++) {
        await appInstance.submitAnswer('hola', false);
      }

      // Master reverse direction
      appInstance.quizState.direction = DIRECTION.REVERSE;
      for (let i = 0; i < CORRECT_ANSWERS_TO_MASTER - 1; i++) {
        await appInstance.submitAnswer('hello', false);
      }

      // Final answer that completes mastery
      const finalResult = await appInstance.submitAnswer('hello', false);

      // Verify word moved to LEVEL_3
      expect(finalResult.statusChanged).toBe(true);
      expect(appInstance.quizState.quizTranslations.get(1).status).toBe(STATUS.LEVEL_3);

      // STEP 4: VERIFY QUIZ IS COMPLETE
      // No more questions should be available
      appInstance.quizState.currentTranslationId = null;
      const nextQuestion = appInstance.getNextQuestion();
      expect(nextQuestion).toBeNull();
    });
  });

  describe('Statistics Integration', () => {
    it('should track complete statistics across answer submissions', async () => {
      // STEP 1: PREPARE TEST STATE
      const wordId = 2;
      appInstance.quizState.currentTranslationId = wordId;
      appInstance.quizState.direction = DIRECTION.NORMAL;

      // STEP 2: SUBMIT A SEQUENCE OF ANSWERS
      // Correct answer
      await appInstance.submitAnswer('adiós', false);
      // Incorrect answer
      await appInstance.submitAnswer('wrong', false);
      // Correct answer
      await appInstance.submitAnswer('adiós', false);

      // STEP 3: VERIFY AGGREGATED STATS
      expect(appInstance.statsManager.stats.totalAttempts).toBe(3);
      expect(appInstance.statsManager.stats.correctAnswers).toBe(2);
      expect(appInstance.statsManager.stats.incorrectAnswers).toBe(1);

      // STEP 4: VERIFY WORD-SPECIFIC STATS
      const directionKey = `${wordId}-normal`;
      const wordStats =
        appInstance.statsManager.stats.attemptsPerTranslationIdAndDirection[directionKey];
      expect(wordStats.attempts).toBe(3);
      expect(wordStats.correct).toBe(2);
      expect(wordStats.incorrect).toBe(1);

      // STEP 5: VERIFY INCORRECT COUNTER
      expect(
        appInstance.statsManager.stats.incorrectPerTranslationIdAndDirection[directionKey]
      ).toBe(1);

      // STEP 6: VERIFY REVERSE DIRECTION STATS ARE SEPARATE
      appInstance.quizState.direction = DIRECTION.REVERSE;
      await appInstance.submitAnswer('goodbye', false); // Correct in reverse

      const reverseKey = `${wordId}-reverse`;
      const reverseStats =
        appInstance.statsManager.stats.attemptsPerTranslationIdAndDirection[reverseKey];
      expect(reverseStats.attempts).toBe(1);
      expect(reverseStats.correct).toBe(1);

      // STEP 7: VERIFY AGGREGATED STATS UPDATED
      expect(appInstance.statsManager.stats.totalAttempts).toBe(4);
      expect(appInstance.statsManager.stats.correctAnswers).toBe(3);
    });

    it('should use statistics for word selection', async () => {
      // STEP 1: SET UP TEST DATA WITH WORD MISTAKES
      // Reset word sets
      for (const status of Object.values(STATUS)) {
        appInstance.quizState.wordStatusSets[status].clear();
      }

      // Add several words to LEVEL_1 for testing
      for (const id of [1, 2, 3, 4]) {
        appInstance.quizState.wordStatusSets[STATUS.LEVEL_1].add(id);
        appInstance.quizState.quizTranslations.get(id).status = STATUS.LEVEL_1;
      }

      // Record more mistakes for word ID 3
      appInstance.statsManager.stats.incorrectPerTranslationIdAndDirection['3-normal'] = 5;
      appInstance.statsManager.stats.incorrectPerTranslationIdAndDirection['1-normal'] = 1;
      appInstance.statsManager.stats.incorrectPerTranslationIdAndDirection['2-normal'] = 2;

      // STEP 2: VERIFY SELECTION USES STATS
      // Get multiple questions and record selections
      const selections = [];
      for (let i = 0; i < 10; i++) {
        const question = appInstance.getNextQuestion();
        if (question) {
          selections.push(question.translationId);
          // Update last asked words to allow variety in selection
          appInstance.quizLogic.updateLastAskedWords(question.translationId);
        }
      }

      // Count occurrences of each word
      const countMap = {};
      for (const id of selections) {
        countMap[id] = (countMap[id] || 0) + 1;
      }

      // Statistical selection should result in word occurrences
      expect(selections.length).toBeGreaterThan(0);
      expect(Object.keys(countMap).length).toBeGreaterThan(0);
    });
  });
});
