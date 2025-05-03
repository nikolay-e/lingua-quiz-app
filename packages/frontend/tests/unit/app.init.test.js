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

// packages/frontend/tests/unit/app.init.test.js
import { createMockApp, createRealApp } from './test-utils/app-test-utils.js';
import { App, createApp } from '../../src/js/app.js';
import { STATUS, MAX_FOCUS_WORDS } from '../../src/js/constants.js';
import { AppInitializer } from '../../src/js/quiz/AppInitializer.js';
import { errorHandler } from '../../src/js/utils/errorHandler.js';
import { suppressConsoleOutput } from '../__mocks__/browserMocks.js';
import { mockQuizData, smallTestSet } from './test-utils/quiz-test-data.js';

// Mock errorHandler - using centralized mock approach
jest.mock('../../src/js/utils/errorHandler.js', () => ({
  errorHandler: require('../__mocks__/utils/errorHandler').errorHandler,
}));

// Mock AppInitializer for certain tests
jest.mock('../../src/js/quiz/AppInitializer.js', () => {
  // Store a reference to the original module
  const originalModule = jest.requireActual('../../src/js/quiz/AppInitializer.js');

  return {
    ...originalModule,
    AppInitializer: class extends originalModule.AppInitializer {
      constructor(...args) {
        super(...args);
      }

      initializeData(data) {
        // Call original with debug spies to track calls
        originalModule.AppInitializer.prototype.initializeData.call(this, data);
      }

      static validateDataAndCreateApp(data, createAppCallback) {
        // Call original with debug spies
        return originalModule.AppInitializer.validateDataAndCreateApp(data, createAppCallback);
      }
    },
  };
});

describe('App Initialization and Factory', () => {
  let consoleWarnSpy;
  let consoleErrorSpy;
  let consoleDebugSpy;

  beforeEach(() => {
    // Clear all mocks for a clean state
    jest.clearAllMocks();

    // Use the suppressConsoleOutput helper from browserMocks
    const consoleSuppress = suppressConsoleOutput();

    // But still create spies to check what was called
    consoleWarnSpy = jest.spyOn(console, 'warn');
    consoleErrorSpy = jest.spyOn(console, 'error');
    consoleDebugSpy = jest.spyOn(console, 'debug');

    // Reset centralized mocks
    errorHandler._reset();
  });

  afterEach(() => {
    // Make sure to call mockRestore on all spies
    if (consoleWarnSpy) consoleWarnSpy.mockRestore();
    if (consoleErrorSpy) consoleErrorSpy.mockRestore();
    if (consoleDebugSpy) consoleDebugSpy.mockRestore();
  });

  it('should initialize with provided data', () => {
    const app = new App(mockQuizData);

    // Check that data was properly initialized
    expect(app.quizState.quizTranslations.size).toBe(mockQuizData.length);
    expect(app.quizState.sourceLanguage).toBe('en');
    expect(app.quizState.targetLanguage).toBe('es');

    // Verify the initializer was called with the correct data
    expect(app.initializer).toBeDefined();
  });

  it('should throw an error with invalid data (empty array)', () => {
    expect(() => new App([])).toThrow('Invalid or insufficient data provided.');
  });

  it('should throw an error with invalid data (null)', () => {
    expect(() => new App(null)).toThrow('Invalid or insufficient data provided.');
  });

  it('should populate LEVEL_1 correctly during construction', () => {
    const app = new App(mockQuizData);

    // Calculate expected values
    const initialL0Count = mockQuizData.filter((d) => d.status === STATUS.LEVEL_0).length;
    const initialL1Count = mockQuizData.filter((d) => d.status === STATUS.LEVEL_1).length;
    const availableL1Slots = MAX_FOCUS_WORDS - initialL1Count;
    const expectedToMove = Math.min(availableL1Slots > 0 ? availableL1Slots : 0, initialL0Count);
    const finalExpectedL1Size = initialL1Count + expectedToMove;

    // Verify the status sets were updated correctly
    expect(app.quizState.wordStatusSets[STATUS.LEVEL_1].size).toBe(finalExpectedL1Size);
    expect(app.quizState.wordStatusSets[STATUS.LEVEL_0].size).toBe(initialL0Count - expectedToMove);
  });

  describe('Initialization Error Handling', () => {
    test('should handle invalid entries during initialization', () => {
      const invalidData = [
        {
          wordPairId: 1,
          sourceWord: 'valid',
          targetWord: 'valido',
          status: 'LEVEL_0',
          sourceLanguage: 'en',
          targetLanguage: 'es',
        },
        { wordPairId: null, sourceWord: 'invalid1', targetWord: 'invalido1' }, // Invalid ID
        { sourceWord: 'invalid2', targetWord: 'invalido2', status: 'LEVEL_0' }, // Missing ID
        'not an object',
      ];

      const app = new App(invalidData);

      // Only the valid entry should be added
      expect(app.quizState.quizTranslations.size).toBe(1);

      // Check if word 1 was populated to L1 (since it would be the only valid word)
      expect(app.quizState.wordStatusSets[STATUS.LEVEL_1].has(1)).toBe(true);
      expect(app.quizState.wordStatusSets[STATUS.LEVEL_0].has(1)).toBe(false);

      // Verify warnings for invalid entries were logged
      expect(consoleWarnSpy).toHaveBeenCalledWith(
        '[AppInitializer] Invalid word entry (missing or null wordPairId):',
        invalidData[1]
      );
      expect(consoleWarnSpy).toHaveBeenCalledWith(
        '[AppInitializer] Invalid word entry (missing or null wordPairId):',
        invalidData[2]
      );
      expect(consoleWarnSpy).toHaveBeenCalledWith(
        '[AppInitializer] Invalid word entry (missing or null wordPairId):',
        invalidData[3]
      );
    });

    test('should throw error if no valid entries after initialization', () => {
      const invalidData = [
        { wordPairId: null, sourceWord: 'invalid1', targetWord: 'invalido1' },
        'not an object',
      ];

      expect(() => new App(invalidData)).toThrow('No valid entries added to quizTranslations');
      expect(consoleWarnSpy).toHaveBeenCalledTimes(2); // Warns for both invalid entries
    });
  });

  describe('AppInitializer Module Integration', () => {
    test('AppInitializer.initializeData correctly processes valid data', () => {
      // Create spies on AppInitializer methods
      const initSpy = jest.spyOn(AppInitializer.prototype, 'initializeData');

      // Create app with small test data
      const app = new App(smallTestSet);

      // Verify the initializer was called
      expect(initSpy).toHaveBeenCalledTimes(1);

      // Verify data was processed
      expect(app.quizState.quizTranslations.size).toBe(smallTestSet.length);

      // Clean up spies
      initSpy.mockRestore();
    });

    test('mocked App has expected component structure', () => {
      // Create a mock App with spy methods
      const { app, mocks } = createMockApp(smallTestSet);

      // Verify all mocks were set up correctly
      expect(app.initializer).toBeDefined();
      expect(app.stateManager).toBeDefined();
      expect(app.quizFlow).toBeDefined();
      expect(app.quizLogic).toBeDefined();
      expect(app.statsManager).toBeDefined();

      // Verify addWordToStatusSet is available as a mock method
      expect(typeof mocks.stateManager.addWordToStatusSet).toBe('function');
    });
  });

  describe('createApp Factory', () => {
    test('should create an App instance successfully', () => {
      // Create spy on static validator method
      const validateSpy = jest.spyOn(AppInitializer, 'validateDataAndCreateApp');

      const instance = createApp(mockQuizData);

      // Verify validator was called
      expect(validateSpy).toHaveBeenCalledTimes(1);

      // Verify proper App instance was created
      expect(instance).toBeInstanceOf(App);
      expect(instance.quizState).toBeDefined();
      expect(instance.statsManager).toBeDefined();
      expect(instance.quizLogic).toBeDefined();
      expect(instance.stateManager).toBeDefined();
      expect(instance.quizFlow).toBeDefined();
      expect(instance.answerProcessor).toBeDefined();
      expect(instance.initializer).toBeDefined();

      // Clean up spy
      validateSpy.mockRestore();
    });

    test('should handle errors during createApp and call errorHandler', () => {
      const invalidData = [];

      expect(() => createApp(invalidData)).toThrow(
        '[AppInitializer] Empty array provided to createApp'
      );

      // Verify the central error handler was called
      expect(errorHandler.handleApiError).toHaveBeenCalledWith(expect.any(Error));
    });

    test('should throw detailed error messages for null or undefined data', () => {
      expect(() => createApp(null)).toThrow('[AppInitializer] No data provided to createApp');

      expect(() => createApp(undefined)).toThrow('[AppInitializer] No data provided to createApp');

      // Verify error handler was called in both cases
      expect(errorHandler.handleApiError).toHaveBeenCalledTimes(2);
    });

    test('should validate data is array type', () => {
      const nonArrayData = { wordPairId: 1, sourceWord: 'test', targetWord: 'prueba' };

      expect(() => createApp(nonArrayData)).toThrow(
        '[AppInitializer] Expected array but got object'
      );

      expect(errorHandler.handleApiError).toHaveBeenCalledTimes(1);
    });
  });
});
