// packages/frontend/tests/unit/app.init.test.js
import { App, createApp } from '../../src/js/app.js';
import { STATUS, MAX_FOCUS_WORDS } from '../../src/js/constants.js'; // Updated import
import { errorHandler } from '../../src/js/utils/errorHandler.js';
import { suppressConsoleOutput } from '../__mocks__/browserMocks.js';

// Mock errorHandler - using centralized mock approach
jest.mock('../../src/js/utils/errorHandler.js', () => ({
  errorHandler: require('../__mocks__/utils/errorHandler').errorHandler,
}));

// --- Mock Data (Ensure this is the full array) ---
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

describe('App Initialization and Factory', () => {
  let consoleWarnSpy;
  let consoleErrorSpy;

  beforeEach(() => {
    // Clear all mocks for a clean state
    jest.clearAllMocks();
    
    // Use the suppressConsoleOutput helper from browserMocks
    const consoleSuppress = suppressConsoleOutput();
    
    // But still create spies to check what was called
    consoleWarnSpy = jest.spyOn(console, 'warn');
    consoleErrorSpy = jest.spyOn(console, 'error');
    
    // Reset centralized mocks
    errorHandler._reset();
  });

  afterEach(() => {
    // Make sure to call mockRestore on all spies
    if (consoleWarnSpy) consoleWarnSpy.mockRestore();
    if (consoleErrorSpy) consoleErrorSpy.mockRestore();
  });

  it('should initialize with provided data', () => {
    const app = new App(mockData);
    // Access state via app.quizState
    expect(app.quizState.quizTranslations.size).toBe(mockData.length);
    expect(app.quizState.sourceLanguage).toBe('en');
    expect(app.quizState.targetLanguage).toBe('es');
  });

  it('should throw an error with invalid data (empty array)', () => {
    expect(() => new App([])).toThrow('Invalid or insufficient data provided.');
  });

  it('should throw an error with invalid data (null)', () => {
    expect(() => new App(null)).toThrow('Invalid or insufficient data provided.');
  });

  it('should populate LEVEL_1 correctly during construction', () => {
    const localApp = new App(mockData); // Use full mockData
    const initialL0Count = mockData.filter((d) => d.status === STATUS.LEVEL_0).length;
    const initialL1Count = mockData.filter((d) => d.status === STATUS.LEVEL_1).length;
    const availableL1Slots = MAX_FOCUS_WORDS - initialL1Count;
    const expectedToMove = Math.min(availableL1Slots > 0 ? availableL1Slots : 0, initialL0Count);
    const finalExpectedL1Size = initialL1Count + expectedToMove;

    // Access state via localApp.quizState
    expect(localApp.quizState.wordStatusSets[STATUS.LEVEL_1].size).toBe(finalExpectedL1Size);
    expect(localApp.quizState.wordStatusSets[STATUS.LEVEL_0].size).toBe(
      initialL0Count - expectedToMove
    );
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
      const localApp = new App(invalidData);
      // Access state via localApp.quizState
      expect(localApp.quizState.quizTranslations.size).toBe(1); // Only the valid entry
      // Check if word 1 was populated to L1
      expect(localApp.quizState.wordStatusSets[STATUS.LEVEL_1].has(1)).toBe(true);
      expect(localApp.quizState.wordStatusSets[STATUS.LEVEL_0].has(1)).toBe(false);
      // Check warnings for invalid entries
      expect(consoleWarnSpy).toHaveBeenCalledWith(
        '[App] Invalid word entry (missing or null wordPairId):',
        invalidData[1]
      );
      expect(consoleWarnSpy).toHaveBeenCalledWith(
        '[App] Invalid word entry (missing or null wordPairId):',
        invalidData[2]
      );
      expect(consoleWarnSpy).toHaveBeenCalledWith(
        '[App] Invalid word entry (missing or null wordPairId):',
        invalidData[3]
      ); // Also warns for non-object
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

  describe('createApp Factory', () => {
    it('should create an App instance successfully', () => {
      const instance = createApp(mockData);
      expect(instance).toBeInstanceOf(App);
      // Check if internal instances were created
      expect(instance.quizState).toBeDefined();
      expect(instance.statsManager).toBeDefined();
      expect(instance.quizLogic).toBeDefined();
    });

    it('should handle errors during createApp and call errorHandler', () => {
      const invalidData = [];
      expect(() => createApp(invalidData)).toThrow('[createApp] Empty array provided to createApp');
      // Check if the central error handler was called by the factory function
      expect(errorHandler.handleApiError).toHaveBeenCalledWith(expect.any(Error));
    });
  });
});
