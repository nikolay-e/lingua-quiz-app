// packages/frontend/tests/quizManager.test.js

import { QuizManager } from '../src/js/quiz/quizManager.js';
import { App } from '../src/js/app.js';
import {
  getRandomTranslationIdFromTopFew,
  moveToMasteredOneDirection,
  moveToMasteredVocabulary,
} from '../src/js/quiz/wordSetManager.js';

// Mock the wordSetManager functions
jest.mock('../src/js/quiz/wordSetManager.js', () => ({
  moveToMasteredOneDirection: jest.fn(),
  moveToMasteredVocabulary: jest.fn(),
  getRandomTranslationIdFromTopFew: jest.fn(),
  updateStats: jest.requireActual('../src/js/quiz/wordSetManager.js').updateStats,
}));

describe('QuizManager Class', () => {
  let appState;
  let quizManager;

  beforeEach(() => {
    appState = new App();
    quizManager = new QuizManager(appState);

    // Set up quizTranslations and focusTranslationIds
    appState.quizTranslations.set(1, {
      wordPairId: 1,
      sourceWord: 'hello',
      targetWord: 'hola',
      status: 'Focus Words',
    });
    appState.focusTranslationIds.add(1);
    appState.setCurrentTranslationId(1);

    // Mock getRandomTranslationIdFromTopFew to return 1
    getRandomTranslationIdFromTopFew.mockClear();
    getRandomTranslationIdFromTopFew.mockReturnValue(1);
  });

  it('should get the next question', () => {
    const questionData = quizManager.getNextQuestion();
    expect(getRandomTranslationIdFromTopFew).toHaveBeenCalledWith(
      appState.focusTranslationIds,
      quizManager.lastAskedWords,
      appState.quizTranslations
    );
    expect(questionData.word).toBe('hello');
    expect(questionData.translationId).toBe(1);
  });

  it('should verify a correct answer', () => {
    const isCorrect = quizManager.verifyAnswer('hola', new Date());
    expect(isCorrect).toBe(true);
  });

  it('should verify an incorrect answer', () => {
    const isCorrect = quizManager.verifyAnswer('adios', new Date());
    expect(isCorrect).toBe(false);
  });

  it('should update stats on correct answer', () => {
    const startTime = new Date();
    quizManager.verifyAnswer('hola', startTime);
    expect(moveToMasteredOneDirection).not.toHaveBeenCalled();
    expect(moveToMasteredVocabulary).not.toHaveBeenCalled();
  });

  it('should move word to mastered one direction after 3 correct answers', () => {
    const startTime = new Date();
    for (let i = 0; i < 3; i += 1) {
      quizManager.verifyAnswer('hola', startTime);
    }
    expect(moveToMasteredOneDirection).toHaveBeenCalledWith(appState, 1);
  });
});
