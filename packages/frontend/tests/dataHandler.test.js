import { App } from '../src/js/app.js';
import { parseData } from '../src/js/quiz/dataHandler.js';

describe('DataHandler Functions', () => {
  let appState;

  beforeEach(() => {
    appState = new App();
  });

  it('should parse data correctly', () => {
    const mockData = [
      {
        wordPairId: 1,
        sourceWord: 'hello',
        targetWord: 'hola',
        status: 'Focus Words',
        sourceLanguage: 'en',
        targetLanguage: 'es',
      },
      {
        wordPairId: 2,
        sourceWord: 'goodbye',
        targetWord: 'adios',
        status: 'Upcoming Words',
        sourceLanguage: 'en',
        targetLanguage: 'es',
      },
    ];

    parseData(appState, mockData);

    expect(appState.quizTranslations.size).toBe(2);
    expect(appState.focusTranslationIds.has(1)).toBe(true);
    expect(appState.focusTranslationIds.has(2)).toBe(true);
    expect(appState.upcomingTranslationIds.size).toBe(0);
    expect(appState.masteredOneDirectionTranslationIds.size).toBe(0);
    expect(appState.masteredVocabularyTranslationIds.size).toBe(0);

    expect(appState.sourceLanguage).toBe('en');
    expect(appState.targetLanguage).toBe('es');
  });

  it('should throw error on invalid data', () => {
    expect(() => parseData(appState, null)).toThrow('Invalid data structure in JSON');
    expect(() => parseData(appState, {})).toThrow('Invalid data structure in JSON');
  });

  it('should throw error when no languages detected', () => {
    const mockData = [];
    expect(() => parseData(appState, mockData)).toThrow(
      'At least two supported languages must be present in the data'
    );
  });

  it('should ensure focus words has at least 20 words', () => {
    const mockData = [];
    for (let i = 1; i <= 25; i += 1) {
      mockData.push({
        wordPairId: i,
        sourceWord: `word${i}`,
        targetWord: `palabra${i}`,
        status: 'Upcoming Words',
        sourceLanguage: 'en',
        targetLanguage: 'es',
      });
    }

    parseData(appState, mockData);

    expect(appState.focusTranslationIds.size).toBe(20);
    expect(appState.upcomingTranslationIds.size).toBe(5);
  });
});
