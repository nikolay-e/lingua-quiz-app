import { App } from '../src/js/app.js';
import {
  moveToFocusWords,
  moveToMasteredOneDirection,
  moveToMasteredVocabulary,
  stats,
  updateStats,
} from '../src/js/quiz/wordSetManager.js';

describe('WordSetManager Functions', () => {
  let appState;

  beforeEach(() => {
    appState = new App();
    // Reset stats
    stats.totalAttempts = 0;
    stats.correctAnswers = 0;
    stats.incorrectAnswers = 0;
    stats.attemptsPerTranslationIdAndDirection = {};
    stats.incorrectPerTranslationIdAndDirection = {};
    stats.timePerTranslationIdAndDirection = {};
    stats.timePerQuestion = [];
  });

  it('should move a word to focus words', () => {
    appState.upcomingTranslationIds.add(1);
    appState.quizTranslations.set(1, { wordPairId: 1, status: 'Upcoming Words' });
    moveToFocusWords(appState, 1);
    expect(appState.focusTranslationIds.has(1)).toBe(true);
    expect(appState.upcomingTranslationIds.has(1)).toBe(false);
    expect(appState.quizTranslations.get(1).status).toBe('Focus Words');
  });

  it('should move a word to mastered one direction', () => {
    appState.focusTranslationIds.add(1);
    appState.quizTranslations.set(1, { wordPairId: 1, status: 'Focus Words' });
    moveToMasteredOneDirection(appState, 1);
    expect(appState.masteredOneDirectionTranslationIds.has(1)).toBe(true);
    expect(appState.focusTranslationIds.has(1)).toBe(false);
    expect(appState.quizTranslations.get(1).status).toBe('Mastered One Direction');
  });

  it('should move a word to mastered vocabulary', () => {
    appState.masteredOneDirectionTranslationIds.add(1);
    appState.quizTranslations.set(1, { wordPairId: 1, status: 'Mastered One Direction' });
    moveToMasteredVocabulary(appState, 1);
    expect(appState.masteredVocabularyTranslationIds.has(1)).toBe(true);
    expect(appState.masteredOneDirectionTranslationIds.has(1)).toBe(false);
    expect(appState.quizTranslations.get(1).status).toBe('Mastered Vocabulary');
  });

  it('should update stats correctly on correct answer', () => {
    const startTime = new Date();
    updateStats(true, 1, startTime, true);
    expect(stats.totalAttempts).toBe(1);
    expect(stats.correctAnswers).toBe(1);
    expect(stats.incorrectAnswers).toBe(0);
    expect(stats.attemptsPerTranslationIdAndDirection['1-normal'].attempts).toBe(1);
    expect(stats.attemptsPerTranslationIdAndDirection['1-normal'].correct).toBe(1);
  });

  it('should update stats correctly on incorrect answer', () => {
    const startTime = new Date();
    updateStats(false, 1, startTime, false);
    expect(stats.totalAttempts).toBe(1);
    expect(stats.correctAnswers).toBe(0);
    expect(stats.incorrectAnswers).toBe(1);
    expect(stats.attemptsPerTranslationIdAndDirection['1-reverse'].attempts).toBe(1);
    expect(stats.attemptsPerTranslationIdAndDirection['1-reverse'].incorrect).toBe(1);
  });
});
