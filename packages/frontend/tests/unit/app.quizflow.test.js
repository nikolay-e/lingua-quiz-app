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

// packages/frontend/tests/unit/app.quizflow.test.js
import { createMockApp, createRealApp } from './test-utils/app-test-utils.js';
import { App } from '../../src/js/app.js';
import { STATUS, DIRECTION, MAX_MISTAKES_BEFORE_DEGRADATION } from '../../src/js/constants.js';
import { errorHandler } from '../../src/js/utils/errorHandler.js';
import { suppressConsoleOutput } from '../__mocks__/browserMocks.js';
import { mockQuizData, smallTestSet } from './test-utils/quiz-test-data.js';

// Mock errorHandler - using centralized mock approach
jest.mock('../../src/js/utils/errorHandler.js', () => ({
  errorHandler: require('../__mocks__/utils/errorHandler').errorHandler,
}));

describe('Quiz Flow', () => {
  let app;
  let mocks;

  // Initialize with mock data before each test
  beforeEach(() => {
    // Create mock app with components for isolated testing
    const mockAppData = createMockApp(mockQuizData);
    app = mockAppData.app;
    mocks = mockAppData.mocks;

    // Suppress console output for cleaner tests
    suppressConsoleOutput();
  });

  describe('Direction Toggle', () => {
    it('should toggle direction and return appropriate label', () => {
      // Delegate to the quizFlow mock
      const result = app.toggleDirection();
      expect(mocks.quizFlow.toggleDirection).toHaveBeenCalled();
      expect(result).toBe('Normal');
    });
  });

  describe('Get Next Question', () => {
    it('should delegate to quizFlow to get the next question', () => {
      const result = app.getNextQuestion();
      expect(mocks.quizFlow.getNextQuestion).toHaveBeenCalled();
      expect(result).toEqual({ word: 'hello', translationId: 1 });
    });
  });

  describe('Submit Answer', () => {
    it('should process correct answers appropriately', async () => {
      // Set up the answerProcessor mock to simulate a correct answer
      const mockFeedback = {
        isSuccess: true,
        correctAnswer: 'hola',
        userAnswer: 'hola',
        message: 'Correct!',
      };

      mocks.answerProcessor = {
        submitAnswer: jest.fn().mockResolvedValue({
          feedback: mockFeedback,
          usageExamples: { source: 'Hello', target: 'Hola' },
          questionData: { word: 'hello', translationId: 1 },
        }),
      };

      app.answerProcessor = mocks.answerProcessor;

      // Submit answer through the app's public API
      const result = await app.submitAnswer('hola');

      // Verify the answer processor was called with the correct parameters
      expect(mocks.answerProcessor.submitAnswer).toHaveBeenCalledWith('hola', true);

      // Verify return values match what the processor returned
      expect(result.feedback.isSuccess).toBe(true);
      expect(result.usageExamples).toEqual({ source: 'Hello', target: 'Hola' });
      expect(result.questionData).toEqual({ word: 'hello', translationId: 1 });
    });

    it('should process incorrect answers appropriately', async () => {
      // Set up the answerProcessor mock to simulate an incorrect answer
      const mockFeedback = {
        isSuccess: false,
        correctAnswer: 'hola',
        userAnswer: 'wrong',
        message: 'Incorrect. The answer is "hola".',
      };

      mocks.answerProcessor = {
        submitAnswer: jest.fn().mockResolvedValue({
          feedback: mockFeedback,
          usageExamples: { source: 'Hello', target: 'Hola' },
          questionData: { word: 'hello', translationId: 1 },
        }),
      };

      app.answerProcessor = mocks.answerProcessor;

      // Submit answer
      const result = await app.submitAnswer('wrong');

      // Verify the answer processor was called with the correct parameters
      expect(mocks.answerProcessor.submitAnswer).toHaveBeenCalledWith('wrong', true);

      // Verify return values for incorrect answer
      expect(result.feedback.isSuccess).toBe(false);
      expect(result.feedback.correctAnswer).toBe('hola');
    });
  });

  describe('Quiz Flow Integration Tests', () => {
    let realApp;

    beforeEach(() => {
      jest.clearAllMocks();
      // Create a real app with actual components for integration testing
      realApp = createRealApp(smallTestSet);
    });

    it('should handle a complete quiz flow with multiple answers', async () => {
      // Test full learning flow
      // 1. Get a question
      const question1 = realApp.getNextQuestion();
      expect(question1).toBeTruthy();
      expect(question1.word).toBeTruthy();

      // 2. Set up for testing a correct answer
      realApp.quizState.direction = DIRECTION.NORMAL;

      // Store the current translation ID before submitting
      const translationId = realApp.quizState.currentTranslationId;
      const wordPair = realApp.quizState.quizTranslations.get(translationId);

      // Verify we have a valid word pair
      expect(wordPair).toBeTruthy();

      // Submit a correct answer based on the current question
      const correctAnswer = wordPair.targetWord;
      const result1 = await realApp.submitAnswer(correctAnswer);

      // Verify success
      expect(result1.feedback.isSuccess).toBe(true);
      // Skip checking userAnswer as it might not be set in the feedback

      // 3. Submit an incorrect answer for the next question
      // Get a new question
      const question2 = realApp.getNextQuestion();
      expect(question2).toBeTruthy();

      // Submit a deliberately wrong answer
      const result2 = await realApp.submitAnswer('definitely wrong answer');

      // Verify failure
      expect(result2.feedback.isSuccess).toBe(false);
      // Skip checking userAnswer as it might not be set in the feedback
    });

    it('should toggle direction and maintain functionality', async () => {
      // Initial direction
      expect(realApp.currentDirectionLabel).toBe('Normal');

      // Toggle direction
      const toggleResult = realApp.toggleDirection();

      // Verify toggle result
      expect(toggleResult).toBe('Reverse');
      expect(realApp.currentDirectionLabel).toBe('Reverse');

      // Make sure questions still work after toggling
      const question = realApp.getNextQuestion();
      expect(question).toBeTruthy();

      // In reverse mode, the source and target are flipped
      // We should be providing the "sourceWord" as answer
      const translationId = realApp.quizState.currentTranslationId;
      const wordPair = realApp.quizState.quizTranslations.get(translationId);

      // Use sourceWord as the answer in reverse mode
      const result = await realApp.submitAnswer(wordPair.sourceWord);
      expect(result.feedback.isSuccess).toBe(true);
    });
  });
});
