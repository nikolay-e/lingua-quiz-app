import { describe, it, expect } from 'vitest';
import { QuizManager, Translation, F, K, T_PROMO, MAX_FOCUS_POOL_SIZE } from '../src/index';

describe('Algorithm Parameter Validation', () => {
  const sampleTranslations: Translation[] = [
    {
      id: 1,
      sourceWord: { text: 'hello', language: 'en' },
      targetWord: { text: 'привет', language: 'ru' },
    },
    {
      id: 2,
      sourceWord: { text: 'world', language: 'en' },
      targetWord: { text: 'мир', language: 'ru' },
    },
    {
      id: 3,
      sourceWord: { text: 'good', language: 'en' },
      targetWord: { text: 'хороший', language: 'ru' },
    },
  ];

  describe('Algorithm Constants Usage', () => {
    it('should use algorithm constants correctly in calculations', () => {
      const quizManager = new QuizManager(sampleTranslations);
      const options = quizManager.getOptions();

      // Verify that options use algorithm constants (without testing the constants themselves)
      expect(options.queuePositionIncrement).toBe(K * F);
      expect(options.maxFocusWords).toBe(MAX_FOCUS_POOL_SIZE);
      expect(options.correctAnswersToLevelUp).toBe(T_PROMO);
    });

    it('should calculate focus pool size correctly', () => {
      expect(MAX_FOCUS_POOL_SIZE).toBe(K * F * T_PROMO);
    });
  });

  describe('Custom Options Validation', () => {
    it('should accept valid custom options', () => {
      const customOptions = {
        maxFocusWords: 50,
        correctAnswersToLevelUp: 5,
        queuePositionIncrement: 8,
        enableUsageExamples: false,
      };

      const quizManager = new QuizManager(sampleTranslations, {}, customOptions);
      const options = quizManager.getOptions();

      expect(options.maxFocusWords).toBe(50);
      expect(options.correctAnswersToLevelUp).toBe(5);
      expect(options.queuePositionIncrement).toBe(8);
      expect(options.enableUsageExamples).toBe(false);
    });

    it('should handle edge case parameter values', () => {
      // Test minimum valid values
      const minOptions = {
        maxFocusWords: 1,
        correctAnswersToLevelUp: 1,
        queuePositionIncrement: 1,
      };

      const quizManager = new QuizManager(sampleTranslations, {}, minOptions);
      const options = quizManager.getOptions();

      expect(options.maxFocusWords).toBe(1);
      expect(options.correctAnswersToLevelUp).toBe(1);
      expect(options.queuePositionIncrement).toBe(1);
    });

    it('should handle zero values appropriately', () => {
      const zeroOptions = {
        maxFocusWords: 0,
      };

      const quizManager = new QuizManager(sampleTranslations, {}, zeroOptions);
      const options = quizManager.getOptions();

      expect(options.maxFocusWords).toBe(0);
    });

    it('should handle large parameter values', () => {
      const largeOptions = {
        maxFocusWords: 1000,
        correctAnswersToLevelUp: 100,
        queuePositionIncrement: 50,
      };

      const quizManager = new QuizManager(sampleTranslations, {}, largeOptions);
      const options = quizManager.getOptions();

      expect(options.maxFocusWords).toBe(1000);
      expect(options.correctAnswersToLevelUp).toBe(100);
      expect(options.queuePositionIncrement).toBe(50);
    });
  });

  describe('Options Inheritance and Defaults', () => {
    it('should use default values when no custom options provided', () => {
      const quizManager = new QuizManager(sampleTranslations);
      const options = quizManager.getOptions();

      // Should use algorithm constants as defaults
      expect(options.maxFocusWords).toBe(MAX_FOCUS_POOL_SIZE);
      expect(options.correctAnswersToLevelUp).toBe(T_PROMO);
      expect(options.queuePositionIncrement).toBe(K * F);
    });

    it('should partially override defaults with custom options', () => {
      const partialOptions = {
        maxFocusWords: 40,
        correctAnswersToLevelUp: 4,
        // Other options should remain at defaults
      };

      const quizManager = new QuizManager(sampleTranslations, {}, partialOptions);
      const options = quizManager.getOptions();

      // Custom values
      expect(options.maxFocusWords).toBe(40);
      expect(options.correctAnswersToLevelUp).toBe(4);

      // Default values for non-specified options
      expect(options.queuePositionIncrement).toBe(K * F);
    });

    it('should maintain option immutability', () => {
      const customOptions = {
        maxFocusWords: 25,
        correctAnswersToLevelUp: 2,
      };

      const quizManager = new QuizManager(sampleTranslations, {}, customOptions);
      const options1 = quizManager.getOptions();
      const options2 = quizManager.getOptions();

      // Should return consistent values
      expect(options1.maxFocusWords).toBe(options2.maxFocusWords);
      expect(options1.correctAnswersToLevelUp).toBe(options2.correctAnswersToLevelUp);

      // Modifying the original customOptions should not affect QuizManager
      customOptions.maxFocusWords = 100;
      const options3 = quizManager.getOptions();
      expect(options3.maxFocusWords).toBe(25); // Should remain unchanged
    });
  });

  describe('Parameter Interdependencies', () => {
    it('should handle relationships between parameters correctly', () => {
      // Test case where queuePositionIncrement affects queue behavior
      const translations = Array.from({ length: 20 }, (_, i) => ({
        id: i + 1,
        sourceWord: { text: `word${i}`, language: 'en' },
        targetWord: { text: `слово${i}`, language: 'ru' },
      }));

      const smallIncrement = new QuizManager(translations, {}, { queuePositionIncrement: 1 });
      const largeIncrement = new QuizManager(translations, {}, { queuePositionIncrement: 15 });

      // Both should work but behave differently
      expect(smallIncrement.getOptions().queuePositionIncrement).toBe(1);
      expect(largeIncrement.getOptions().queuePositionIncrement).toBe(15);
    });

    it('should handle maxFocusWords relative to translation count', () => {
      const fewTranslations = sampleTranslations; // 3 translations
      const manyTranslations = Array.from({ length: 100 }, (_, i) => ({
        id: i + 1,
        sourceWord: { text: `word${i}`, language: 'en' },
        targetWord: { text: `слово${i}`, language: 'ru' },
      }));

      // MaxFocusWords larger than available translations
      const quizWithFew = new QuizManager(fewTranslations, {}, { maxFocusWords: 50 });
      expect(quizWithFew.getOptions().maxFocusWords).toBe(50);

      // MaxFocusWords smaller than available translations
      const quizWithMany = new QuizManager(manyTranslations, {}, { maxFocusWords: 10 });
      expect(quizWithMany.getOptions().maxFocusWords).toBe(10);
    });
  });

  describe('Algorithm Math Validation', () => {
    it('should validate queue position calculations', () => {
      const translations = Array.from({ length: 10 }, (_, i) => ({
        id: i + 1,
        sourceWord: { text: `word${i}`, language: 'en' },
        targetWord: { text: `слово${i}`, language: 'ru' },
      }));

      const quizManager = new QuizManager(translations);
      const increment = quizManager.getOptions().queuePositionIncrement;

      // The increment should be the calculated value K * F
      expect(increment).toBe(K * F);
    });

    it('should validate focus pool size calculation', () => {
      const quizManager = new QuizManager(sampleTranslations);
      const maxFocus = quizManager.getOptions().maxFocusWords;

      // Should equal the calculated MAX_FOCUS_POOL_SIZE
      expect(maxFocus).toBe(MAX_FOCUS_POOL_SIZE);
      expect(maxFocus).toBe(K * F * T_PROMO);
    });

    it('should validate promotion threshold usage', () => {
      const quizManager = new QuizManager(sampleTranslations);
      const correctAnswersNeeded = quizManager.getOptions().correctAnswersToLevelUp;

      // Should equal T_PROMO from the algorithm
      expect(correctAnswersNeeded).toBe(T_PROMO);
    });
  });
});
