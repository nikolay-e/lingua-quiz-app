// packages/frontend/tests/unit/app.state.test.js
import { App } from '../../src/js/app.js';
import {
  STATUS,
  DIRECTION,
  MAX_FOCUS_WORDS,
  MAX_MISTAKES_BEFORE_DEGRADATION,
} from '../../src/js/constants.js'; // Updated import
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

describe('App State Management', () => {
  let isolatedApp;
  let consoleWarnSpy;
  let consoleErrorSpy;

  beforeEach(() => {
    // Clear mocks and use suppressConsoleOutput helper
    jest.clearAllMocks();
    const consoleSuppress = suppressConsoleOutput();
    
    // Create spies for checking calls
    consoleWarnSpy = jest.spyOn(console, 'warn');
    consoleErrorSpy = jest.spyOn(console, 'error');
    
    // Create fresh instance for each test
    isolatedApp = new App(mockData);
    
    // Reset internal state parts if needed, e.g., mistakes
    isolatedApp.quizState.consecutiveMistakes = new Map();
    isolatedApp.quizState.lastAskedWords = [];
    
    // Reset centralized mocks
    errorHandler._reset();
  });

  afterEach(() => {
    // Make sure to restore all spies
    if (consoleWarnSpy) consoleWarnSpy.mockRestore();
    if (consoleErrorSpy) consoleErrorSpy.mockRestore();
  });

  describe('Word Status Management', () => {
    it('should move a word to a new status and handle no-change scenarios', () => {
      const wordId = 2; // Starts L1
      // Access state via quizState
      expect(isolatedApp.quizState.wordStatusSets[STATUS.LEVEL_1].has(wordId)).toBe(true);
      expect(isolatedApp.quizState.quizTranslations.get(wordId).status).toBe(STATUS.LEVEL_1);

      // Call method on App instance
      let changed = isolatedApp.moveWordToStatus(wordId, STATUS.LEVEL_2);
      expect(changed).toBe(true);
      // Check state via quizState
      expect(isolatedApp.quizState.wordStatusSets[STATUS.LEVEL_1].has(wordId)).toBe(false);
      expect(isolatedApp.quizState.wordStatusSets[STATUS.LEVEL_2].has(wordId)).toBe(true);
      expect(isolatedApp.quizState.quizTranslations.get(wordId).status).toBe(STATUS.LEVEL_2);

      changed = isolatedApp.moveWordToStatus(wordId, STATUS.LEVEL_0);
      expect(changed).toBe(true);
      expect(isolatedApp.quizState.wordStatusSets[STATUS.LEVEL_2].has(wordId)).toBe(false);
      expect(isolatedApp.quizState.wordStatusSets[STATUS.LEVEL_0].has(wordId)).toBe(true);
      expect(isolatedApp.quizState.quizTranslations.get(wordId).status).toBe(STATUS.LEVEL_0);

      changed = isolatedApp.moveWordToStatus(wordId, STATUS.LEVEL_0);
      expect(changed).toBe(false); // Already in L0
      expect(isolatedApp.quizState.wordStatusSets[STATUS.LEVEL_0].has(wordId)).toBe(true);
      expect(isolatedApp.quizState.quizTranslations.get(wordId).status).toBe(STATUS.LEVEL_0);
    });

    it('should return error and false when moving a word to an invalid status', () => {
      const wordId = 2; // Starts L1
      const originalStatus = isolatedApp.quizState.quizTranslations.get(wordId).status;

      const changed = isolatedApp.moveWordToStatus(wordId, 'INVALID_STATUS');

      expect(changed).toBe(false);
      // Status should remain unchanged
      expect(isolatedApp.quizState.quizTranslations.get(wordId).status).toBe(originalStatus);
      expect(isolatedApp.quizState.wordStatusSets[STATUS.LEVEL_1].has(wordId)).toBe(true); // Should still be in original set
      expect(consoleErrorSpy).toHaveBeenCalledWith(
        expect.stringContaining("invalid status 'INVALID_STATUS'")
      );
    });

    it('should return true from populateFocusWords when L1 is not full and L0 has words', () => {
      // Reset state specifically for this test
      isolatedApp = new App(
        mockData.map((d) => ({ ...d, status: d.status === 'LEVEL_1' ? 'LEVEL_3' : d.status }))
      ); // Move initial L1 words out
      isolatedApp.quizState.wordStatusSets[STATUS.LEVEL_1].clear(); // Ensure L1 is empty
      const initialL0Words = mockData
        .filter((d) => d.status === STATUS.LEVEL_0)
        .map((d) => d.wordPairId);
      isolatedApp.quizState.wordStatusSets[STATUS.LEVEL_0] = new Set(initialL0Words);
      for (const id of initialL0Words) {
        // Ensure map reflects L0 status
        if (isolatedApp.quizState.quizTranslations.has(id))
          isolatedApp.quizState.quizTranslations.get(id).status = STATUS.LEVEL_0;
      }

      const initialL0Size = isolatedApp.quizState.wordStatusSets[STATUS.LEVEL_0].size;
      expect(initialL0Size).toBeGreaterThan(0);

      const populated = isolatedApp.populateFocusWords(); // Call method on App

      expect(populated).toBe(true);
      const expectedToMove = Math.min(MAX_FOCUS_WORDS, initialL0Size);
      // Check state via quizState
      expect(isolatedApp.quizState.wordStatusSets[STATUS.LEVEL_1].size).toBe(expectedToMove);
      expect(isolatedApp.quizState.wordStatusSets[STATUS.LEVEL_0].size).toBe(
        initialL0Size - expectedToMove
      );
    });

    it('should return false from populateFocusWords when focus set is already full', () => {
      // Setup: create an app where L1 is already full
      const tempMockData = [];
      for (let i = 1; i <= MAX_FOCUS_WORDS; i++)
        tempMockData.push({
          wordPairId: i,
          status: STATUS.LEVEL_1,
          sourceLanguage: 'en',
          targetLanguage: 'es',
        });
      tempMockData.push({
        wordPairId: 100,
        status: STATUS.LEVEL_0,
        sourceLanguage: 'en',
        targetLanguage: 'es',
      }); // Add one L0 word
      const fullL1App = new App(tempMockData);

      expect(fullL1App.quizState.wordStatusSets[STATUS.LEVEL_1].size).toBe(MAX_FOCUS_WORDS);
      const initialL0Size = fullL1App.quizState.wordStatusSets[STATUS.LEVEL_0].size;
      expect(initialL0Size).toBe(1);

      const populated = fullL1App.populateFocusWords();

      expect(populated).toBe(false); // Should not populate as L1 is full
      expect(fullL1App.quizState.wordStatusSets[STATUS.LEVEL_1].size).toBe(MAX_FOCUS_WORDS);
      expect(fullL1App.quizState.wordStatusSets[STATUS.LEVEL_0].size).toBe(initialL0Size); // L0 should remain unchanged
    });

    it('should return false from populateFocusWords when no LEVEL_0 words are available', () => {
      isolatedApp.quizState.wordStatusSets[STATUS.LEVEL_0].clear(); // Ensure L0 is empty
      // Ensure map reflects no L0 words
      for (const word of isolatedApp.quizState.quizTranslations.values()) {
        if (word.status === STATUS.LEVEL_0) word.status = STATUS.LEVEL_1; // Move any stray L0s
      }
      const initialL1Size = isolatedApp.quizState.wordStatusSets[STATUS.LEVEL_1].size;

      const populated = isolatedApp.populateFocusWords(); // Call method on App

      expect(populated).toBe(false);
      // Check state via quizState
      expect(isolatedApp.quizState.wordStatusSets[STATUS.LEVEL_1].size).toBe(initialL1Size); // L1 unchanged
    });

    test('should handle moving a non-existent word status', () => {
      const result = isolatedApp.moveWordToStatus(9999, STATUS.LEVEL_1);
      expect(result).toBe(false);
      expect(consoleErrorSpy).toHaveBeenCalledWith(
        'Word 9999 not found in quizTranslations! Cannot move status.'
      );
    });
  });

  describe('Level Degradation', () => {
    it('should degrade word from LEVEL_3 to LEVEL_2 after N mistakes', async () => {
      const wordId = 4; // Starts L3
      isolatedApp.moveWordToStatus(wordId, STATUS.LEVEL_3);
      isolatedApp.quizState.currentTranslationId = wordId; // Set context
      isolatedApp.quizState.direction = DIRECTION.NORMAL;

      // Simulate N incorrect answers by calling submitAnswer
      for (let i = 0; i < MAX_MISTAKES_BEFORE_DEGRADATION; i++) {
        await isolatedApp.submitAnswer('incorrect', false); // Submit incorrect answer
      }

      // Check final state via quizState
      expect(isolatedApp.quizState.quizTranslations.get(wordId).status).toBe(STATUS.LEVEL_2);
      expect(isolatedApp.quizState.wordStatusSets[STATUS.LEVEL_2].has(wordId)).toBe(true);
      expect(isolatedApp.quizState.wordStatusSets[STATUS.LEVEL_3].has(wordId)).toBe(false);
      // Check mistake counter reset via quizLogic/quizState
      const mistakeKey = isolatedApp.quizLogic.getMistakesKey(wordId, DIRECTION.NORMAL);
      expect(isolatedApp.quizState.consecutiveMistakes.get(mistakeKey)).toBe(0);
    });

    it('should degrade word from LEVEL_2 to LEVEL_1 after N mistakes', async () => {
      const wordId = 3; // Starts L2
      isolatedApp.moveWordToStatus(wordId, STATUS.LEVEL_2);
      isolatedApp.quizState.currentTranslationId = wordId;
      isolatedApp.quizState.direction = DIRECTION.NORMAL;

      for (let i = 0; i < MAX_MISTAKES_BEFORE_DEGRADATION; i++) {
        await isolatedApp.submitAnswer('incorrect', false);
      }

      expect(isolatedApp.quizState.quizTranslations.get(wordId).status).toBe(STATUS.LEVEL_1);
      expect(isolatedApp.quizState.wordStatusSets[STATUS.LEVEL_1].has(wordId)).toBe(true);
      expect(isolatedApp.quizState.wordStatusSets[STATUS.LEVEL_2].has(wordId)).toBe(false);
      const mistakeKey = isolatedApp.quizLogic.getMistakesKey(wordId, DIRECTION.NORMAL);
      expect(isolatedApp.quizState.consecutiveMistakes.get(mistakeKey)).toBe(0);
    });

    it('should degrade word from LEVEL_1 to LEVEL_0 after N mistakes', async () => {
      const wordId = 2; // Starts L1

      // Clear and explicitly set up the word status to ensure integrity
      isolatedApp.quizState.wordStatusSets[STATUS.LEVEL_0].clear();
      isolatedApp.quizState.wordStatusSets[STATUS.LEVEL_1].clear();

      const word2 = isolatedApp.quizState.quizTranslations.get(wordId);
      if (word2) word2.status = STATUS.LEVEL_1;
      isolatedApp.quizState.wordStatusSets[STATUS.LEVEL_1].add(wordId);

      isolatedApp.quizState.currentTranslationId = wordId;
      isolatedApp.quizState.direction = DIRECTION.NORMAL;

      // Important: Reset mistake counter at the start of the test
      const mistakeKey = isolatedApp.quizLogic.getMistakesKey(wordId, DIRECTION.NORMAL);
      isolatedApp.quizState.consecutiveMistakes.set(mistakeKey, 0);

      expect(isolatedApp.quizState.quizTranslations.get(wordId).status).toBe(STATUS.LEVEL_1);

      // Make MAX_MISTAKES_BEFORE_DEGRADATION-1 mistakes first
      for (let i = 0; i < MAX_MISTAKES_BEFORE_DEGRADATION - 1; i++) {
        await isolatedApp.submitAnswer('incorrect', false);
        expect(isolatedApp.quizState.consecutiveMistakes.get(mistakeKey)).toBe(i + 1);
      }

      // Verify we're at the threshold
      expect(isolatedApp.quizState.consecutiveMistakes.get(mistakeKey)).toBe(
        MAX_MISTAKES_BEFORE_DEGRADATION - 1
      );

      // Make the final mistake that should trigger degradation
      const result = await isolatedApp.submitAnswer('incorrect_final', false);

      expect(result.statusChanged).toBe(true);
      expect(isolatedApp.quizState.quizTranslations.get(wordId).status).toBe(STATUS.LEVEL_0);
      expect(isolatedApp.quizState.wordStatusSets[STATUS.LEVEL_0].has(wordId)).toBe(true);
      expect(isolatedApp.quizState.wordStatusSets[STATUS.LEVEL_1].has(wordId)).toBe(false);
      expect(isolatedApp.quizState.consecutiveMistakes.get(mistakeKey)).toBe(0); // Reset after degradation
    });
    it('should handle mistake tracking separately per direction', async () => {
      const wordId = 4; // Starts L3
      isolatedApp.moveWordToStatus(wordId, STATUS.LEVEL_3);
      isolatedApp.quizState.currentTranslationId = wordId;

      // Make N-1 mistakes in NORMAL direction
      isolatedApp.quizState.direction = DIRECTION.NORMAL;
      for (let i = 0; i < MAX_MISTAKES_BEFORE_DEGRADATION - 1; i++) {
        await isolatedApp.submitAnswer('incorrect', false);
      }
      const normalKey = isolatedApp.quizLogic.getMistakesKey(wordId, DIRECTION.NORMAL);
      expect(isolatedApp.quizState.consecutiveMistakes.get(normalKey)).toBe(
        MAX_MISTAKES_BEFORE_DEGRADATION - 1
      );

      // Make N-1 mistakes in REVERSE direction
      isolatedApp.quizState.direction = DIRECTION.REVERSE;
      isolatedApp.quizState.currentTranslationId = wordId; // Ensure context is right
      for (let i = 0; i < MAX_MISTAKES_BEFORE_DEGRADATION - 1; i++) {
        await isolatedApp.submitAnswer('incorrect', false);
      }
      const reverseKey = isolatedApp.quizLogic.getMistakesKey(wordId, DIRECTION.REVERSE);
      expect(isolatedApp.quizState.consecutiveMistakes.get(reverseKey)).toBe(
        MAX_MISTAKES_BEFORE_DEGRADATION - 1
      );

      // Status should NOT have changed yet
      expect(isolatedApp.quizState.quizTranslations.get(wordId).status).toBe(STATUS.LEVEL_3);

      // One more mistake in NORMAL should degrade
      isolatedApp.quizState.direction = DIRECTION.NORMAL;
      isolatedApp.quizState.currentTranslationId = wordId;
      await isolatedApp.submitAnswer('incorrect_final', false);
      expect(isolatedApp.quizState.quizTranslations.get(wordId).status).toBe(STATUS.LEVEL_2);
      // Both counters should reset upon degradation
      expect(isolatedApp.quizState.consecutiveMistakes.get(normalKey)).toBe(0);
      expect(isolatedApp.quizState.consecutiveMistakes.get(reverseKey)).toBe(0);
    });

    it('should reset mistakes counter on correct answer', async () => {
      const wordId = 4; // Starts L3
      isolatedApp.moveWordToStatus(wordId, STATUS.LEVEL_3);
      isolatedApp.quizState.currentTranslationId = wordId;
      isolatedApp.quizState.direction = DIRECTION.NORMAL;
      const mistakeKey = isolatedApp.quizLogic.getMistakesKey(wordId, DIRECTION.NORMAL);

      await isolatedApp.submitAnswer('incorrect1', false);
      await isolatedApp.submitAnswer('incorrect2', false);
      expect(isolatedApp.quizState.consecutiveMistakes.get(mistakeKey)).toBe(2);

      await isolatedApp.submitAnswer('gracias', false); // Correct answer for word 4
      expect(isolatedApp.quizState.consecutiveMistakes.get(mistakeKey)).toBe(0); // Counter reset

      await isolatedApp.submitAnswer('incorrect3', false); // Another mistake
      expect(isolatedApp.quizState.consecutiveMistakes.get(mistakeKey)).toBe(1); // Counter starts again

      expect(isolatedApp.quizState.quizTranslations.get(wordId).status).toBe(STATUS.LEVEL_3); // Status unchanged
    });

    it('should handle degrading a word already at LEVEL_0', () => {
      const wordId = 1; // Starts L0
      isolatedApp.moveWordToStatus(wordId, STATUS.LEVEL_0);
      expect(isolatedApp.quizState.quizTranslations.get(wordId).status).toBe(STATUS.LEVEL_0);

      const result = isolatedApp.degradeWordLevel(wordId); // Call method on App instance
      expect(result).toBe(false); // No change occurred
      expect(isolatedApp.quizState.quizTranslations.get(wordId).status).toBe(STATUS.LEVEL_0);
      expect(consoleWarnSpy).toHaveBeenCalledWith(
        `Word ${wordId} is already at LEVEL_0, cannot degrade further.`
      );
    });

    test('should handle degrading a non-existent word', () => {
      const result = isolatedApp.degradeWordLevel(9999); // Call method on App instance
      expect(result).toBe(false);
      expect(consoleErrorSpy).toHaveBeenCalledWith('Word 9999 not found for degradation!');
    });
  });

  describe('Quiz Direction', () => {
    it('should toggle direction when LEVEL_2 words exist', () => {
      isolatedApp.moveWordToStatus(3, STATUS.LEVEL_2); // Ensure L2 has a word
      expect(isolatedApp.quizState.direction).toBe(DIRECTION.NORMAL);
      const newDirectionLabel = isolatedApp.toggleDirection(); // Call method on App instance
      expect(newDirectionLabel).toBe('Reverse');
      expect(isolatedApp.quizState.direction).toBe(DIRECTION.REVERSE);
    });

    it('should not toggle to REVERSE when no LEVEL_2 words exist', () => {
      isolatedApp.quizState.wordStatusSets[STATUS.LEVEL_2].clear(); // Ensure L2 is empty
      // Ensure map reflects this
      for (const word of isolatedApp.quizState.quizTranslations.values()) {
        if (word.status === STATUS.LEVEL_2) word.status = STATUS.LEVEL_1;
      }

      expect(isolatedApp.quizState.direction).toBe(DIRECTION.NORMAL);
      const newDirectionLabel = isolatedApp.toggleDirection(); // Call method on App instance
      expect(newDirectionLabel).toBe('Normal'); // Stays Normal
      expect(isolatedApp.quizState.direction).toBe(DIRECTION.NORMAL);
    });

    it('should always toggle back to NORMAL from REVERSE', () => {
      isolatedApp.moveWordToStatus(3, STATUS.LEVEL_2); // Allow toggling to reverse first
      isolatedApp.toggleDirection(); // Toggle to Reverse
      expect(isolatedApp.quizState.direction).toBe(DIRECTION.REVERSE);

      const newDirectionLabel = isolatedApp.toggleDirection(); // Toggle back
      expect(newDirectionLabel).toBe('Normal');
      expect(isolatedApp.quizState.direction).toBe(DIRECTION.NORMAL);
    });
  });
});
