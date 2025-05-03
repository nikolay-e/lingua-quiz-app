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

// packages/frontend/tests/unit/test-utils/quiz-test-data.js

/**
 * Shared test data for quiz-related tests
 */

// Common test data used across multiple test files
export const mockQuizData = [
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
    sourceWordUsageExample: 'Love is a beautiful feeling.',
    targetWordUsageExample: 'El amor es un sentimiento hermoso.',
  },
  {
    wordPairId: 15,
    sourceWord: 'cat',
    targetWord: 'gato',
    sourceLanguage: 'en',
    targetLanguage: 'es',
    status: 'LEVEL_0',
    sourceWordUsageExample: 'My cat is black.',
    targetWordUsageExample: 'Mi gato es negro.',
  },
];

// Helper function to create a subset of data with specific statuses
export function createDataWithStatuses(statusMap) {
  return mockQuizData.map((item) => ({
    ...item,
    status: statusMap[item.wordPairId] || item.status,
  }));
}

// Helper function to filter data by status
export function getWordsByStatus(data, status) {
  return data.filter((item) => item.status === status);
}

// Create a smaller test set when full set isn't needed
export const smallTestSet = mockQuizData.slice(0, 5);
