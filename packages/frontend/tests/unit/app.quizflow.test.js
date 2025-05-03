// packages/frontend/tests/unit/app.quizflow.test.js
import { App } from '../../src/js/app.js';
import { STATUS, DIRECTION, MAX_MISTAKES_BEFORE_DEGRADATION } from '../../src/js/constants.js'; // Updated import
import { errorHandler } from '../../src/js/utils/errorHandler.js';
import { suppressConsoleOutput } from '../__mocks__/browserMocks.js';

// Mock errorHandler - using centralized mock approach
jest.mock('../../src/js/utils/errorHandler.js', () => ({
  errorHandler: require('../__mocks__/utils/errorHandler').errorHandler,
}));

// --- Mock Data (Ensure full array is available) ---
const mockData = [
  {
    wordPairId: 1,
    sourceWord: 'hello',
    targetWord: 'hola',
    sourceLanguage: 'en',
    targetLanguage: 'es',
    status: 'LEVEL_0',
    sourceWordUsageExample: 'Hello, how are you?',
    targetWordUsageExample: '¿Hola, cómo estás?',
  },
  {
    wordPairId: 2,
    sourceWord: 'goodbye',
    targetWord: 'adiós',
    sourceLanguage: 'en',
    targetLanguage: 'es',
    status: 'LEVEL_1',
    sourceWordUsageExample: 'Goodbye, see you later!',
    targetWordUsageExample: '¡Adiós, hasta luego!',
  },
  {
    wordPairId: 3,
    sourceWord: 'please',
    targetWord: 'por favor',
    sourceLanguage: 'en',
    targetLanguage: 'es',
    status: 'LEVEL_2',
    sourceWordUsageExample: 'Please, help me.',
    targetWordUsageExample: 'Por favor, ayúdame.',
  },
  {
    wordPairId: 4,
    sourceWord: 'thank you',
    targetWord: 'gracias',
    sourceLanguage: 'en',
    targetLanguage: 'es',
    status: 'LEVEL_3',
    sourceWordUsageExample: 'Thank you for your help.',
    targetWordUsageExample: 'Gracias por tu ayuda.',
  },
  {
    wordPairId: 5,
    sourceWord: 'yes',
    targetWord: 'sí',
    sourceLanguage: 'en',
    targetLanguage: 'es',
    status: 'LEVEL_0',
    sourceWordUsageExample: 'Yes, I agree.',
    targetWordUsageExample: 'Sí, estoy de acuerdo.',
  },
  {
    wordPairId: 6,
    sourceWord: 'no',
    targetWord: 'no',
    sourceLanguage: 'en',
    targetLanguage: 'es',
    status: 'LEVEL_1',
    sourceWordUsageExample: "No, I don't want to.",
    targetWordUsageExample: 'No, no quiero.',
  },
  {
    wordPairId: 7,
    sourceWord: 'water',
    targetWord: 'agua',
    sourceLanguage: 'en',
    targetLanguage: 'es',
    status: 'LEVEL_0',
    sourceWordUsageExample: 'I need some water.',
    targetWordUsageExample: 'Necesito un poco de agua.',
  },
  {
    wordPairId: 8,
    sourceWord: 'food',
    targetWord: 'comida',
    sourceLanguage: 'en',
    targetLanguage: 'es',
    status: 'LEVEL_1',
    sourceWordUsageExample: 'The food is delicious.',
    targetWordUsageExample: 'La comida está deliciosa.',
  },
  {
    wordPairId: 9,
    sourceWord: 'house',
    targetWord: 'casa',
    sourceLanguage: 'en',
    targetLanguage: 'es',
    status: 'LEVEL_2',
    sourceWordUsageExample: 'My house is big.',
    targetWordUsageExample: 'Mi casa es grande.',
  },
  {
    wordPairId: 10,
    sourceWord: 'car',
    targetWord: 'coche',
    sourceLanguage: 'en',
    targetLanguage: 'es',
    status: 'LEVEL_3',
    sourceWordUsageExample: 'I drive a red car.',
    targetWordUsageExample: 'Conduzco un coche rojo.',
  },
  {
    wordPairId: 11,
    sourceWord: 'book',
    targetWord: 'libro',
    sourceLanguage: 'en',
    targetLanguage: 'es',
    status: 'LEVEL_0',
    sourceWordUsageExample: 'I love this book.',
    targetWordUsageExample: 'Me encanta este libro.',
  },
  {
    wordPairId: 12,
    sourceWord: 'friend',
    targetWord: 'amigo',
    sourceLanguage: 'en',
    targetLanguage: 'es',
    status: 'LEVEL_1',
    sourceWordUsageExample: 'She is my friend.',
    targetWordUsageExample: 'Ella es mi amiga.',
  },
  {
    wordPairId: 13,
    sourceWord: 'family',
    targetWord: 'familia',
    sourceLanguage: 'en',
    targetLanguage: 'es',
    status: 'LEVEL_2',
    sourceWordUsageExample: 'My family is large.',
    targetWordUsageExample: 'Mi familia es grande.',
  },
  {
    wordPairId: 14,
    sourceWord: 'love',
    targetWord: 'amor',
    sourceLanguage: 'en',
    targetLanguage: 'es',
    status: 'LEVEL_3',
    sourceWordUsageExample: 'Love is important.',
    targetWordUsageExample: 'El amor es importante.',
  },
  {
    wordPairId: 15,
    sourceWord: 'time',
    targetWord: 'tiempo',
    sourceLanguage: 'en',
    targetLanguage: 'es',
    status: 'LEVEL_0',
    sourceWordUsageExample: 'What time is it?',
    targetWordUsageExample: '¿Qué hora es?',
  },
  {
    wordPairId: 16,
    sourceWord: 'day',
    targetWord: 'día',
    sourceLanguage: 'en',
    targetLanguage: 'es',
    status: 'LEVEL_1',
    sourceWordUsageExample: 'Have a nice day!',
    targetWordUsageExample: '¡Que tengas un buen día!',
  },
  {
    wordPairId: 17,
    sourceWord: 'night',
    targetWord: 'noche',
    sourceLanguage: 'en',
    targetLanguage: 'es',
    status: 'LEVEL_0',
    sourceWordUsageExample: 'Good night, sleep well.',
    targetWordUsageExample: 'Buenas noches, que duermas bien.',
  },
  {
    wordPairId: 18,
    sourceWord: 'eat',
    targetWord: 'comer',
    sourceLanguage: 'en',
    targetLanguage: 'es',
    status: 'LEVEL_2',
    sourceWordUsageExample: 'I like to eat pizza.',
    targetWordUsageExample: 'Me gusta comer pizza.',
  },
  {
    wordPairId: 19,
    sourceWord: 'drink',
    targetWord: 'beber',
    sourceLanguage: 'en',
    targetLanguage: 'es',
    status: 'LEVEL_1',
    sourceWordUsageExample: 'What would you like to drink?',
    targetWordUsageExample: '¿Qué te gustaría beber?',
  },
  {
    wordPairId: 20,
    sourceWord: 'work',
    targetWord: 'trabajo',
    sourceLanguage: 'en',
    targetLanguage: 'es',
    status: 'LEVEL_3',
    sourceWordUsageExample: 'I have to go to work.',
    targetWordUsageExample: 'Tengo que ir al trabajo.',
  },
  {
    wordPairId: 21,
    sourceWord: 'play',
    targetWord: 'jugar',
    sourceLanguage: 'en',
    targetLanguage: 'es',
    status: 'LEVEL_0',
    sourceWordUsageExample: 'The children like to play in the park.',
    targetWordUsageExample: 'A los niños les gusta jugar en el parque.',
  },
  {
    wordPairId: 22,
    sourceWord: 'school',
    targetWord: 'escuela',
    sourceLanguage: 'en',
    targetLanguage: 'es',
    status: 'LEVEL_1',
    sourceWordUsageExample: 'The school is closed today.',
    targetWordUsageExample: 'La escuela está cerrada hoy.',
  },
  {
    wordPairId: 23,
    sourceWord: 'money',
    targetWord: 'dinero',
    sourceLanguage: 'en',
    targetLanguage: 'es',
    status: 'LEVEL_2',
    sourceWordUsageExample: 'I need to save money.',
    targetWordUsageExample: 'Necesito ahorrar dinero.',
  },
  {
    wordPairId: 24,
    sourceWord: 'sun',
    targetWord: 'sol',
    sourceLanguage: 'en',
    targetLanguage: 'es',
    status: 'LEVEL_0',
    sourceWordUsageExample: 'The sun is shining brightly.',
    targetWordUsageExample: 'El sol brilla intensamente.',
  },
  {
    wordPairId: 25,
    sourceWord: 'moon',
    targetWord: 'luna',
    sourceLanguage: 'en',
    targetLanguage: 'es',
    status: 'LEVEL_3',
    sourceWordUsageExample: 'The moon is full tonight.',
    targetWordUsageExample: 'La luna está llena esta noche.',
  },
  {
    wordPairId: 26,
    sourceWord: 'happy',
    targetWord: 'feliz',
    sourceLanguage: 'en',
    targetLanguage: 'es',
    status: 'LEVEL_1',
    sourceWordUsageExample: 'I am happy to see you.',
    targetWordUsageExample: 'Estoy feliz de verte.',
  },
  {
    wordPairId: 27,
    sourceWord: 'sad',
    targetWord: 'triste',
    sourceLanguage: 'en',
    targetLanguage: 'es',
    status: 'LEVEL_0',
    sourceWordUsageExample: 'Why are you sad?',
    targetWordUsageExample: '¿Por qué estás triste?',
  },
  {
    wordPairId: 28,
    sourceWord: 'big',
    targetWord: 'grande',
    sourceLanguage: 'en',
    targetLanguage: 'es',
    status: 'LEVEL_2',
    sourceWordUsageExample: 'That is a big dog!',
    targetWordUsageExample: '¡Ese es un perro grande!',
  },
  {
    wordPairId: 29,
    sourceWord: 'small',
    targetWord: 'pequeño',
    sourceLanguage: 'en',
    targetLanguage: 'es',
    status: 'LEVEL_1',
    sourceWordUsageExample: 'The mouse is very small.',
    targetWordUsageExample: 'El ratón es muy pequeño.',
  },
  {
    wordPairId: 30,
    sourceWord: 'good',
    targetWord: 'bueno',
    sourceLanguage: 'en',
    targetLanguage: 'es',
    status: 'LEVEL_3',
    sourceWordUsageExample: 'This is a good restaurant.',
    targetWordUsageExample: 'Este es un buen restaurante.',
  },
];

describe('App Quiz Flow and Logic', () => {
  let isolatedApp;
  let consoleWarnSpy;
  let consoleErrorSpy;

  beforeEach(() => {
    // Clear mocks and suppress console output
    jest.clearAllMocks();
    const consoleSuppress = suppressConsoleOutput();
    
    // Create spies for checking calls
    consoleWarnSpy = jest.spyOn(console, 'warn');
    consoleErrorSpy = jest.spyOn(console, 'error');
    
    // Create fresh instance
    isolatedApp = new App(mockData);
    
    // Reset stats and state parts relevant to flow for each test
    isolatedApp.statsManager.stats = {
      totalAttempts: 0,
      correctAnswers: 0,
      incorrectAnswers: 0,
      attemptsPerTranslationIdAndDirection: {},
      incorrectPerTranslationIdAndDirection: {},
      timePerTranslationIdAndDirection: {},
      timePerQuestion: [],
    };
    isolatedApp.quizState.consecutiveMistakes = new Map();
    isolatedApp.quizState.lastAskedWords = [];
    isolatedApp.quizState.currentTranslationId = null; // Ensure no current question at start
    isolatedApp.quizState.direction = DIRECTION.NORMAL; // Reset direction
    
    // Reset centralized mocks
    errorHandler._reset();
  });

  afterEach(() => {
    // Make sure to restore all spies
    if (consoleWarnSpy) consoleWarnSpy.mockRestore();
    if (consoleErrorSpy) consoleErrorSpy.mockRestore();
  });

  describe('Question Selection', () => {
    // Tests moved to app.state.test.js as they focus more on state transitions
    // or the selection algorithm itself which is now in QuizLogic
    // (Keep tests like 'prioritize words with more mistakes', 'avoid recently asked'
    // here if testing the *outcome* of getNextQuestion)

    it('should prioritize words with more mistakes', () => {
      // Clear the existing set and manually add just the two words we want to test
      isolatedApp.quizState.wordStatusSets[STATUS.LEVEL_1].clear(); // Use quizState

      // First update the words' status in the translations map to match the test's expectations
      const word2 = isolatedApp.quizState.quizTranslations.get(2);
      const word6 = isolatedApp.quizState.quizTranslations.get(6);
      if (word2) word2.status = STATUS.LEVEL_1;
      if (word6) word6.status = STATUS.LEVEL_1;

      // Now manually add them to the set
      isolatedApp.quizState.wordStatusSets[STATUS.LEVEL_1].add(2);
      isolatedApp.quizState.wordStatusSets[STATUS.LEVEL_1].add(6);

      // Access stats via statsManager
      isolatedApp.statsManager.stats.incorrectPerTranslationIdAndDirection['2-normal'] = 5;
      isolatedApp.statsManager.stats.incorrectPerTranslationIdAndDirection['6-normal'] = 1;
      isolatedApp.quizState.direction = DIRECTION.NORMAL; // Use quizState

      expect(isolatedApp.quizState.wordStatusSets[STATUS.LEVEL_1].size).toBe(2);

      const selections = {};
      let word2SelectedCount = 0;
      for (let i = 0; i < 20; i++) {
        const q = isolatedApp.getNextQuestion(); // Call App's public method
        if (q) {
          selections[q.translationId] = (selections[q.translationId] || 0) + 1;
          if (q.translationId === 2) {
            word2SelectedCount++;
          }
          // Call App's internal delegation or direct state manipulation if needed
          isolatedApp.quizLogic.updateLastAskedWords(q.translationId);
        } else {
          console.warn('getNextQuestion returned null during prioritization test');
          break;
        }
      }
      expect(word2SelectedCount).toBeGreaterThan(0);
    });

    it('should avoid recently asked words if possible', () => {
      const l1Set = isolatedApp.quizState.wordStatusSets[STATUS.LEVEL_1];
      if (l1Set.size < 2) isolatedApp.populateFocusWords();
      expect(l1Set.size).toBeGreaterThan(1);

      const q1 = isolatedApp.getNextQuestion();
      expect(q1).not.toBeNull();
      isolatedApp.quizLogic.updateLastAskedWords(q1.translationId); // Update state

      const q2 = isolatedApp.getNextQuestion();
      expect(q2).not.toBeNull();
      expect(q2.translationId).not.toBe(q1.translationId); // Check outcome

      expect(isolatedApp.quizState.lastAskedWords).toContain(q1.translationId);
      expect(isolatedApp.quizState.lastAskedWords).toContain(q2.translationId);
    });
  });

  describe('Answer Submission', () => {
    beforeEach(() => {
      // Set up a known state for answer submission tests
      // First clear the set and update maps to avoid any initialization issues
      isolatedApp.quizState.wordStatusSets[STATUS.LEVEL_1].clear();
      const word1 = isolatedApp.quizState.quizTranslations.get(1);
      if (word1) word1.status = STATUS.LEVEL_1;
      isolatedApp.quizState.wordStatusSets[STATUS.LEVEL_1].add(1);

      isolatedApp.quizState.currentTranslationId = 1; // Set the current word
      isolatedApp.quizState.direction = DIRECTION.NORMAL; // Set direction
    });

    it('should correctly verify a correct answer via submitAnswer', async () => {
      const result = await isolatedApp.submitAnswer('hola', false); // Submit correct answer
      expect(result.feedback.isSuccess).toBe(true);
      expect(result.feedback.message).toBe('Correct!');
      // Check if mistake counter was reset (indirectly via quizState)
      const mistakeKey = isolatedApp.quizLogic.getMistakesKey(1, DIRECTION.NORMAL);
      expect(isolatedApp.quizState.consecutiveMistakes.get(mistakeKey)).toBe(0);
    });

    it('should correctly verify an incorrect answer via submitAnswer', async () => {
      const result = await isolatedApp.submitAnswer('adios', false); // Submit incorrect answer
      expect(result.feedback.isSuccess).toBe(false);
      expect(result.feedback.message).toContain("Wrong. The correct pair is: 'hello' ↔ 'hola'");
      // Check if mistake counter was incremented
      const mistakeKey = isolatedApp.quizLogic.getMistakesKey(1, DIRECTION.NORMAL);
      expect(isolatedApp.quizState.consecutiveMistakes.get(mistakeKey)).toBe(1);
    });

    it('should update stats correctly on answer submission', async () => {
      // Correct
      await isolatedApp.submitAnswer('hola', false);
      // Access stats via statsManager
      expect(isolatedApp.statsManager.stats.totalAttempts).toBe(1);
      expect(isolatedApp.statsManager.stats.correctAnswers).toBe(1);
      expect(isolatedApp.statsManager.stats.incorrectAnswers).toBe(0);
      expect(
        isolatedApp.statsManager.stats.attemptsPerTranslationIdAndDirection['1-normal'].attempts
      ).toBe(1);
      expect(
        isolatedApp.statsManager.stats.attemptsPerTranslationIdAndDirection['1-normal'].correct
      ).toBe(1);
      expect(
        isolatedApp.statsManager.stats.incorrectPerTranslationIdAndDirection['1-normal']
      ).toBeFalsy();

      // Incorrect
      await isolatedApp.submitAnswer('wrong', false);
      // Access stats via statsManager
      expect(isolatedApp.statsManager.stats.totalAttempts).toBe(2);
      expect(isolatedApp.statsManager.stats.correctAnswers).toBe(1);
      expect(isolatedApp.statsManager.stats.incorrectAnswers).toBe(1);
      expect(
        isolatedApp.statsManager.stats.attemptsPerTranslationIdAndDirection['1-normal'].attempts
      ).toBe(2);
      expect(
        isolatedApp.statsManager.stats.attemptsPerTranslationIdAndDirection['1-normal'].incorrect
      ).toBe(1);
      expect(isolatedApp.statsManager.stats.incorrectPerTranslationIdAndDirection['1-normal']).toBe(
        1
      );
    });

    it('should provide usage examples in the response', async () => {
      isolatedApp.quizState.currentTranslationId = 1; // Ensure current word is set
      const result = await isolatedApp.submitAnswer('hola', false); // Doesn't matter if correct/incorrect here
      expect(result.usageExamples).toBeDefined();
      expect(result.usageExamples.source).toBe('Hello, how are you?');
      expect(result.usageExamples.target).toBe('¿Hola, cómo estás?');
    });

    it('should handle empty user answers gracefully', async () => {
      isolatedApp.quizState.currentTranslationId = 1;
      const result = await isolatedApp.submitAnswer('', false); // Submit empty string
      expect(result.feedback.isSuccess).toBe(false);
      expect(result.feedback.message).toContain('Wrong'); // Should be treated as incorrect
      // Check if mistake counter was incremented
      const mistakeKey = isolatedApp.quizLogic.getMistakesKey(1, DIRECTION.NORMAL);
      expect(isolatedApp.quizState.consecutiveMistakes.get(mistakeKey)).toBe(1);
    });

    it('should get next question when shouldGetNextQuestion is true', async () => {
      // Add another word to LEVEL_1 for selection diversity
      isolatedApp.quizState.wordStatusSets[STATUS.LEVEL_1].add(2);

      // Make specific state preparations to ensure consistent test behavior
      isolatedApp.quizState.currentTranslationId = 1;

      // Force the selection of a different word by modifying lastAskedWords
      isolatedApp.quizState.lastAskedWords = [1]; // Word 1 was just asked

      const result = await isolatedApp.submitAnswer('hola', true); // Request next question

      expect(result.questionData).not.toBeNull();
      expect(result.questionData).toHaveProperty('word');
      expect(result.questionData).toHaveProperty('translationId');
      expect(result.questionData.translationId).not.toBe(1); // Expecting a different question
    });

    // Tests for status changes (L1->L2, L2->L3, degradation) remain similar
    // but ensure assertions check app.quizState.quizTranslations.get(id).status
    // and app.quizState.wordStatusSets[STATUS.*].has(id)

    it('should move word to LEVEL_2 after 3 correct answers in normal direction', async () => {
      // Clear the set first and manually set the word's status
      isolatedApp.quizState.wordStatusSets[STATUS.LEVEL_1].clear();
      isolatedApp.quizState.wordStatusSets[STATUS.LEVEL_2].clear();

      const word1 = isolatedApp.quizState.quizTranslations.get(1);
      if (word1) word1.status = STATUS.LEVEL_1;
      isolatedApp.quizState.wordStatusSets[STATUS.LEVEL_1].add(1);

      isolatedApp.quizState.currentTranslationId = 1;
      isolatedApp.quizState.direction = DIRECTION.NORMAL;
      for (let i = 0; i < 3; i++) {
        await isolatedApp.submitAnswer('hola', false);
      }
      expect(isolatedApp.quizState.wordStatusSets[STATUS.LEVEL_2].has(1)).toBe(true);
      expect(isolatedApp.quizState.quizTranslations.get(1).status).toBe(STATUS.LEVEL_2);
    });

    it('should move word to LEVEL_3 after mastering both directions', async () => {
      // Master normal (L1 -> L2)
      // First clear and set up our word status
      isolatedApp.quizState.wordStatusSets[STATUS.LEVEL_1].clear();
      isolatedApp.quizState.wordStatusSets[STATUS.LEVEL_2].clear();
      isolatedApp.quizState.wordStatusSets[STATUS.LEVEL_3].clear();

      const word1 = isolatedApp.quizState.quizTranslations.get(1);
      if (word1) word1.status = STATUS.LEVEL_1;
      isolatedApp.quizState.wordStatusSets[STATUS.LEVEL_1].add(1);

      isolatedApp.quizState.currentTranslationId = 1;
      isolatedApp.quizState.direction = DIRECTION.NORMAL;
      for (let i = 0; i < 3; i++) await isolatedApp.submitAnswer('hola', false);
      expect(isolatedApp.quizState.quizTranslations.get(1).status).toBe(STATUS.LEVEL_2);

      // Master reverse (L2 -> L3)
      isolatedApp.quizState.direction = DIRECTION.REVERSE;
      isolatedApp.quizState.currentTranslationId = 1;
      for (let i = 0; i < 3; i++) await isolatedApp.submitAnswer('hello', false);

      expect(isolatedApp.quizState.quizTranslations.get(1).status).toBe(STATUS.LEVEL_3);
      expect(isolatedApp.quizState.wordStatusSets[STATUS.LEVEL_3].has(1)).toBe(true);
      expect(isolatedApp.quizState.wordStatusSets[STATUS.LEVEL_2].has(1)).toBe(false);
    });

    it('should return statusChanged = true when status is upgraded', async () => {
      // Clear and setup word status
      isolatedApp.quizState.wordStatusSets[STATUS.LEVEL_1].clear();
      isolatedApp.quizState.wordStatusSets[STATUS.LEVEL_2].clear();

      const word1 = isolatedApp.quizState.quizTranslations.get(1);
      if (word1) word1.status = STATUS.LEVEL_1;
      isolatedApp.quizState.wordStatusSets[STATUS.LEVEL_1].add(1);

      isolatedApp.quizState.currentTranslationId = 1;
      isolatedApp.quizState.direction = DIRECTION.NORMAL;
      for (let i = 0; i < 2; i++) await isolatedApp.submitAnswer('hola', false);
      const result = await isolatedApp.submitAnswer('hola', false); // 3rd correct -> UPGRADE
      expect(result.statusChanged).toBe(true);
      expect(isolatedApp.quizState.quizTranslations.get(1).status).toBe(STATUS.LEVEL_2);
    });

    it('should return statusChanged = true when status is degraded', async () => {
      // Clear and setup word status
      isolatedApp.quizState.wordStatusSets[STATUS.LEVEL_0].clear();
      isolatedApp.quizState.wordStatusSets[STATUS.LEVEL_1].clear();

      // Update the word in the translations map
      const word1 = isolatedApp.quizState.quizTranslations.get(1);
      if (word1) word1.status = STATUS.LEVEL_1;
      isolatedApp.quizState.wordStatusSets[STATUS.LEVEL_1].add(1);

      isolatedApp.quizState.currentTranslationId = 1;
      isolatedApp.quizState.direction = DIRECTION.NORMAL;

      // Important: Reset the mistake counter before starting
      const mistakeKey = isolatedApp.quizLogic.getMistakesKey(1, DIRECTION.NORMAL);
      isolatedApp.quizState.consecutiveMistakes.set(mistakeKey, 0);

      // Make MAX_MISTAKES_BEFORE_DEGRADATION-1 mistakes first
      for (let i = 0; i < MAX_MISTAKES_BEFORE_DEGRADATION - 1; i++) {
        await isolatedApp.submitAnswer('wrong', false);
      }

      // Verify we're at the threshold
      expect(isolatedApp.quizState.consecutiveMistakes.get(mistakeKey)).toBe(
        MAX_MISTAKES_BEFORE_DEGRADATION - 1
      );

      // Make the final mistake that should trigger degradation
      const result = await isolatedApp.submitAnswer('wrong', false); // Final mistake -> DEGRADE

      // Check the result and state
      expect(result.statusChanged).toBe(true);
      expect(isolatedApp.quizState.quizTranslations.get(1).status).toBe(STATUS.LEVEL_0);
      expect(isolatedApp.quizState.wordStatusSets[STATUS.LEVEL_0].has(1)).toBe(true);
      expect(isolatedApp.quizState.wordStatusSets[STATUS.LEVEL_1].has(1)).toBe(false);
    });
  });

  describe('Statistics Tracking Access', () => {
    // Test access via StatsManager instance
    it('should allow access to aggregated incorrect counts', () => {
      isolatedApp.statsManager.stats.incorrectPerTranslationIdAndDirection = {
        '1-normal': 2,
        '1-reverse': 1,
        '2-normal': 3,
      };
      const counts = isolatedApp.statsManager.aggregateIncorrectCounts();
      expect(counts).toEqual({ 1: 3, 2: 3 });
    });

    it('should allow access to correct count for a direction', () => {
      isolatedApp.statsManager.stats.attemptsPerTranslationIdAndDirection['1-normal'] = {
        correct: 2,
      };
      const count = isolatedApp.statsManager.getCorrectCount(1, DIRECTION.NORMAL);
      expect(count).toBe(2);
      const countRev = isolatedApp.statsManager.getCorrectCount(1, DIRECTION.REVERSE);
      expect(countRev).toBe(0); // Not set yet
    });
  });

  describe('Error Handling (Quiz Flow)', () => {
    test('should handle submitting answer when currentTranslationId is null initially', async () => {
      isolatedApp.quizState.currentTranslationId = null; // Ensure it's null
      // Ensure there's a word available to be selected

      // Clear and setup word status
      isolatedApp.quizState.wordStatusSets[STATUS.LEVEL_1].clear();

      const word2 = isolatedApp.quizState.quizTranslations.get(2);
      if (word2) word2.status = STATUS.LEVEL_1;
      isolatedApp.quizState.wordStatusSets[STATUS.LEVEL_1].add(2);

      const result = await isolatedApp.submitAnswer('some answer', true);

      // Expect it to have selected a new question rather than erroring
      expect(result.feedback.message).toContain('Starting quiz...'); // Or similar initial message
      expect(result.questionData).not.toBeNull();
      expect(isolatedApp.quizState.currentTranslationId).not.toBeNull(); // A word should now be current
      expect(errorHandler.handleApiError).not.toHaveBeenCalled();
    });

    test('should handle submitting answer when currentTranslationId is null and no questions available', async () => {
      isolatedApp.quizState.currentTranslationId = null;
      // Make sure no questions are available
      for (const id of isolatedApp.quizState.quizTranslations.keys()) {
        isolatedApp.moveWordToStatus(id, STATUS.LEVEL_3);
      }

      const result = await isolatedApp.submitAnswer('some answer', true);

      expect(result.feedback.message).toContain('Quiz finished');
      expect(result.questionData).toBeNull();
      expect(isolatedApp.quizState.currentTranslationId).toBeNull();
      expect(errorHandler.handleApiError).not.toHaveBeenCalled(); // No actual error occurred
    });

    test('should handle error during answer verification (e.g., word removed mid-flight)', async () => {
      isolatedApp.quizState.currentTranslationId = 1; // Word exists initially
      // Mock the verifyAnswer part (now in QuizLogic) to throw
      jest.spyOn(isolatedApp.quizLogic, 'verifyAnswer').mockImplementationOnce(() => {
        throw new Error('Simulated verification error');
      });

      const result = await isolatedApp.submitAnswer('hola');

      expect(result.feedback.isSuccess).toBe(false);
      expect(result.feedback.message).toContain('An error occurred');
      expect(errorHandler.handleApiError).toHaveBeenCalledWith(expect.any(Error));
      expect(consoleErrorSpy).toHaveBeenCalledWith('Error submitting answer:', expect.any(Error));
    });
  });

  describe('Edge Cases (Answer Comparison)', () => {
    // These tests primarily verify the compareAnswers logic, which is now in QuizLogic,
    // but we test it via the App's submitAnswer method which uses it.
    it('should handle case insensitive and trimmed answers correctly', async () => {
      // Clear and setup word status
      isolatedApp.quizState.wordStatusSets[STATUS.LEVEL_1].clear();

      const word1 = isolatedApp.quizState.quizTranslations.get(1);
      if (word1) word1.status = STATUS.LEVEL_1;
      isolatedApp.quizState.wordStatusSets[STATUS.LEVEL_1].add(1);

      isolatedApp.quizState.currentTranslationId = 1;
      isolatedApp.quizState.direction = DIRECTION.NORMAL;
      const result = await isolatedApp.submitAnswer('  HoLa  ', false);
      expect(result.feedback.isSuccess).toBe(true); // Should match 'hola'
    });

    it('should handle answers with/without diacritics (accents) correctly', async () => {
      // Clear and setup word status
      isolatedApp.quizState.wordStatusSets[STATUS.LEVEL_1].clear();

      const word2 = isolatedApp.quizState.quizTranslations.get(2);
      if (word2) word2.status = STATUS.LEVEL_1;
      isolatedApp.quizState.wordStatusSets[STATUS.LEVEL_1].add(2);

      isolatedApp.quizState.currentTranslationId = 2;
      isolatedApp.quizState.direction = DIRECTION.NORMAL;

      // Test with accent
      let result = await isolatedApp.submitAnswer('adiós', false);
      expect(result.feedback.isSuccess).toBe(true);

      // Reset stats (important for re-testing correct count logic if needed)
      isolatedApp.statsManager.stats.attemptsPerTranslationIdAndDirection = {};
      isolatedApp.statsManager.stats.incorrectPerTranslationIdAndDirection = {};

      // Test without accent
      result = await isolatedApp.submitAnswer('adios', false);
      expect(result.feedback.isSuccess).toBe(true); // Should still match 'adiós' after normalization
    });

    it('should handle answers with punctuation correctly (ignore it)', async () => {
      // Clear and setup word status
      isolatedApp.quizState.wordStatusSets[STATUS.LEVEL_1].clear();

      const word4 = isolatedApp.quizState.quizTranslations.get(4);
      if (word4) word4.status = STATUS.LEVEL_1;
      isolatedApp.quizState.wordStatusSets[STATUS.LEVEL_1].add(4);

      isolatedApp.quizState.currentTranslationId = 4;
      isolatedApp.quizState.direction = DIRECTION.NORMAL;

      // Test with ending punctuation
      const result = await isolatedApp.submitAnswer('gracias!', false);
      expect(result.feedback.isSuccess).toBe(true);

      isolatedApp.statsManager.stats.attemptsPerTranslationIdAndDirection = {};
      isolatedApp.statsManager.stats.incorrectPerTranslationIdAndDirection = {};

      // Test with different case and punctuation
      const result2 = await isolatedApp.submitAnswer('Gracias.', false);
      expect(result2.feedback.isSuccess).toBe(true);
    });
  });
}); // End describe block
