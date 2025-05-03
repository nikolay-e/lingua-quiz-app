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

// packages/frontend/tests/unit/test-utils/app-test-utils.js
import { App } from '../../../src/js/app.js';
import {
  MAX_FOCUS_WORDS,
  CORRECT_ANSWERS_TO_MASTER,
  MAX_MISTAKES_BEFORE_DEGRADATION,
} from '../../../src/js/constants.js';
import { AppAnswerProcessor } from '../../../src/js/quiz/AppAnswerProcessor.js';
import { AppInitializer } from '../../../src/js/quiz/AppInitializer.js';
import { AppQuizFlow } from '../../../src/js/quiz/AppQuizFlow.js';
import { AppStateManager } from '../../../src/js/quiz/AppStateManager.js';
import { QuizLogic } from '../../../src/js/quiz/QuizLogic.js';
import { QuizState } from '../../../src/js/quiz/QuizState.js';
import { StatsManager } from '../../../src/js/quiz/StatsManager.js';

/**
 * Creates a fully mocked App instance for testing
 * @param {Array} mockData - Test data to initialize with
 * @returns {Object} - Mock App instance and spy functions
 */
export function createMockApp(mockData) {
  // Create spy mocks for all component methods
  const stateManagerMock = {
    populateFocusWords: jest.fn().mockReturnValue(true),
    moveWordToStatus: jest.fn().mockReturnValue(true),
    degradeWordLevel: jest.fn().mockReturnValue(true),
    addWordToStatusSet: jest.fn(),
  };

  const quizLogicMock = {
    resetMistakesCounter: jest.fn(),
    incrementMistakesCounter: jest.fn().mockReturnValue(1),
    verifyAnswer: jest.fn().mockReturnValue(true),
    selectNextTranslationId: jest.fn().mockReturnValue(1),
    updateLastAskedWords: jest.fn(),
    resetBothMistakeCounters: jest.fn(),
  };

  const quizFlowMock = {
    getNextQuestion: jest.fn().mockReturnValue({ word: 'hello', translationId: 1 }),
    handleCorrectAnswer: jest.fn().mockReturnValue(true),
    toggleDirection: jest.fn().mockReturnValue('Normal'),
    getUsageExamples: jest.fn().mockReturnValue({ source: 'Hello', target: 'Hola' }),
    maxFocusWords: MAX_FOCUS_WORDS,
  };

  const statsManagerMock = {
    updateStats: jest.fn(),
    getCorrectCount: jest.fn().mockReturnValue(3),
    aggregateIncorrectCounts: jest.fn().mockReturnValue({}),
  };

  const initializerMock = {
    initializeData: jest.fn(),
  };

  const answerProcessorMock = {
    submitAnswer: jest.fn().mockResolvedValue({
      feedback: { isSuccess: true, userAnswer: 'hola', correctAnswer: 'hola', message: 'Correct!' },
      usageExamples: { source: 'Hello', target: 'Hola' },
      questionData: { word: 'hello', translationId: 1 },
    }),
  };

  // Create real instances for core components
  const quizState = new QuizState();

  // Initialize with mock data
  quizState.sourceLanguage = 'en';
  quizState.targetLanguage = 'es';
  for (const item of mockData) {
    quizState.quizTranslations.set(item.wordPairId, { ...item });
    quizState.wordStatusSets[item.status].add(item.wordPairId);
  }

  // Create the App instance with mocked components
  const app = new App(mockData);

  // Replace real components with mocks
  app.stateManager = stateManagerMock;
  app.quizLogic = quizLogicMock;
  app.quizFlow = quizFlowMock;
  app.statsManager = statsManagerMock;
  app.initializer = initializerMock;
  app.answerProcessor = answerProcessorMock;

  // Keep the real quizState for testing state changes
  app.quizState = quizState;

  return {
    app,
    mocks: {
      stateManager: stateManagerMock,
      quizLogic: quizLogicMock,
      quizFlow: quizFlowMock,
      statsManager: statsManagerMock,
      initializer: initializerMock,
      answerProcessor: answerProcessorMock,
    },
  };
}

/**
 * Creates a real App instance for integration testing
 * @param {Array} mockData - Test data to initialize with
 * @returns {App} - Initialized App instance
 */
export function createRealApp(mockData) {
  // Create a full App instance with real components
  const app = new App(mockData);

  // Call the real initializer to set up data
  app.initializer.initializeData(mockData);

  return app;
}
