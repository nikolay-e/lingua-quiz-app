import { describe, it, expect } from 'vitest';
import { QuizManager, Translation, checkAnswer } from '../src/index';

describe('Core Functionality Tests', () => {
  const sampleTranslations: Translation[] = [
    {
      id: 1,
      sourceWord: { text: 'hello', language: 'en', usageExample: 'Hello world!' },
      targetWord: { text: 'привет', language: 'ru', usageExample: 'Привет мир!' }
    },
    {
      id: 2,
      sourceWord: { text: 'world', language: 'en', usageExample: 'Hello world!' },
      targetWord: { text: 'мир', language: 'ru', usageExample: 'Привет мир!' }
    },
    {
      id: 3,
      sourceWord: { text: 'cat', language: 'en' },
      targetWord: { text: 'кот', language: 'ru' }
    }
  ];

  describe('Complex Answer Patterns', () => {
    it('should handle parentheses with comma-separated requirements', () => {
      // User must provide one option from each group separated by commas
      expect(checkAnswer('равный, сейчас', '(равный|одинаковый), (сейчас|сразу)')).toBe(true);
      expect(checkAnswer('одинаковый, сразу', '(равный|одинаковый), (сейчас|сразу)')).toBe(true);
      
      // Missing parts should fail
      expect(checkAnswer('равный', '(равный|одинаковый), (сейчас|сразу)')).toBe(false);
      expect(checkAnswer('сейчас', '(равный|одинаковый), (сейчас|сразу)')).toBe(false);
    });

    it('should handle mixed bracket and pipe patterns', () => {
      // Pipes are alternatives - only one is needed
      expect(checkAnswer('hello', 'hello|hey, hi there|greetings')).toBe(true);
      // Note: 'hey' alone doesn't match 'hey, hi there' because the pipe splits on full alternatives
      expect(checkAnswer('hey, hi there', 'hello|hey, hi there|greetings')).toBe(true);
      expect(checkAnswer('greetings', 'hello|hey, hi there|greetings')).toBe(true);
      
      // These should not match
      expect(checkAnswer('hey', 'hello|hey, hi there|greetings')).toBe(false);
      expect(checkAnswer('hi there', 'hello|hey, hi there|greetings')).toBe(false);
      expect(checkAnswer('hello, greetings', 'hello|hey, hi there|greetings')).toBe(false);
    });

    it('should handle complex Cyrillic patterns', () => {
      expect(checkAnswer('тёмный', 'темный')).toBe(true); // ё/е equivalence
      expect(checkAnswer('темный', 'тёмный')).toBe(true);
      expect(checkAnswer('cop', 'сор')).toBe(true); // Latin to Cyrillic
    });

    it('should handle edge cases in answer checking', () => {
      expect(checkAnswer('', '')).toBe(false); // Empty answers should fail
      expect(checkAnswer('word', '')).toBe(false);
      expect(checkAnswer('', 'word')).toBe(false);
      
      // Whitespace handling
      expect(checkAnswer('  hello  ', 'hello')).toBe(true);
      expect(checkAnswer('hello', '  hello  ')).toBe(true);
    });
  });

  describe('QuizManager Edge Cases', () => {
    it('should handle empty translation list', () => {
      const emptyQuiz = new QuizManager([]);
      const result = emptyQuiz.getNextQuestion();
      
      expect(result.question).toBeNull();
    });

    it('should handle single translation efficiently', () => {
      const singleTranslation = [sampleTranslations[0]];
      const singleQuiz = new QuizManager(singleTranslation);
      
      const result = singleQuiz.getNextQuestion();
      expect(result.question).toBeTruthy();
      expect(result.question?.translationId).toBe(1);
    });

    it('should handle invalid translation IDs in submitAnswer', () => {
      const quizManager = new QuizManager(sampleTranslations);
      
      // This should not crash but handle gracefully
      expect(() => {
        quizManager.submitAnswer(999, 'any answer');
      }).toThrow('Translation or progress not found');
    });

    it('should maintain consistency during rapid operations', () => {
      const quizManager = new QuizManager(sampleTranslations);
      
      // Perform rapid operations
      for (let i = 0; i < 20; i++) {
        const result = quizManager.getNextQuestion();
        if (result.question) {
          // Alternate between correct answers (привет, мир, кот) and wrong ones
          const correctAnswers = ['привет', 'мир', 'кот'];
          const answer = i % 3 === 0 ? 'wrong' : correctAnswers[result.question.translationId - 1];
          quizManager.submitAnswer(result.question.translationId, answer);
        }
      }
      
      // Should still function
      const finalResult = quizManager.getNextQuestion();
      expect(finalResult.question).toBeTruthy();
    });
  });

  describe('Custom Options Edge Cases', () => {
    it('should handle zero maxFocusWords', () => {
      const zeroFocusQuiz = new QuizManager(sampleTranslations, {}, { maxFocusWords: 0 });
      const state = zeroFocusQuiz.getState();
      
      // With zero focus words, all should remain at LEVEL_0
      const level1Count = state.progress.filter(p => p.status === 'LEVEL_1').length;
      expect(level1Count).toBe(0);
    });

    it('should handle custom correctAnswersToLevelUp', () => {
      const customQuiz = new QuizManager(sampleTranslations, {}, { correctAnswersToLevelUp: 1 });
      
      const result = customQuiz.getNextQuestion();
      if (result.question) {
        const translationId = result.question.translationId;
        
        // Answer correctly once (should advance with custom setting)
        const correctAnswer = translationId === 1 ? 'привет' : translationId === 2 ? 'мир' : 'кот';
        const submissionResult = customQuiz.submitAnswer(translationId, correctAnswer);
        
        const state = customQuiz.getState();
        const progress = state.progress.find(p => p.translationId === translationId);
        
        // With correctAnswersToLevelUp = 1, the word should have advanced to next level
        expect(submissionResult.isCorrect).toBe(true);
        expect(submissionResult.levelChange).toBeDefined();
        // After level promotion, consecutiveCorrect is reset to 0
        expect(progress?.consecutiveCorrect).toBe(0);
        // Check that it moved from LEVEL_1 to LEVEL_2
        expect(progress?.status).toBe('LEVEL_2');
      }
    });

    it('should handle large numbers of translations efficiently', () => {
      const manyTranslations: Translation[] = Array.from({length: 100}, (_, i) => ({
        id: i + 1,
        sourceWord: { text: `word${i}`, language: 'en' },
        targetWord: { text: `слово${i}`, language: 'ru' }
      }));

      const startTime = Date.now();
      const largeQuiz = new QuizManager(manyTranslations);
      const result = largeQuiz.getNextQuestion();
      const endTime = Date.now();

      // Should initialize quickly
      expect(endTime - startTime).toBeLessThan(1000);
      expect(result.question).toBeTruthy();
    });
  });

  describe('State Management', () => {
    it('should restore state correctly', () => {
      const originalQuiz = new QuizManager(sampleTranslations);
      
      // Perform some operations
      const result = originalQuiz.getNextQuestion();
      if (result.question) {
        originalQuiz.submitAnswer(result.question.translationId, 'привет');
      }
      
      const savedState = originalQuiz.getState();
      const restoredQuiz = new QuizManager(sampleTranslations, savedState);
      
      const originalState = originalQuiz.getState();
      const restoredState = restoredQuiz.getState();
      
      // Key state should match
      expect(restoredState.currentLevel).toBe(originalState.currentLevel);
      expect(restoredState.progress.length).toBe(originalState.progress.length);
    });

    it('should handle level switching edge cases', () => {
      const quizManager = new QuizManager(sampleTranslations);
      
      // Try to switch to a level with no words
      const result = quizManager.setLevel('LEVEL_5');
      
      expect(result.success).toBe(false);
      expect(result.actualLevel).toBeDefined();
      expect(result.message).toContain('no available words');
    });
  });

  describe('Algorithm Implementation', () => {
    it('should progress words through levels correctly', () => {
      const quizManager = new QuizManager(sampleTranslations);
      
      // Get a word and answer it correctly multiple times
      const result = quizManager.getNextQuestion();
      if (result.question) {
        const translationId = result.question.translationId;
        const correctAnswer = translationId === 1 ? 'привет' : translationId === 2 ? 'мир' : 'кот';
        
        let submissionResult: ReturnType<typeof quizManager.submitAnswer> | undefined;
        // Answer correctly 3 times (T_PROMO default)
        for (let i = 0; i < 3; i++) {
          submissionResult = quizManager.submitAnswer(translationId, correctAnswer);
        }
        
        const state = quizManager.getState();
        const progress = state.progress.find(p => p.translationId === translationId);
        
        // After 3 correct answers, word should have advanced to next level
        expect(submissionResult?.isCorrect).toBe(true);
        expect(submissionResult?.levelChange).toBeDefined();
        // After level promotion, consecutiveCorrect is reset to 0
        expect(progress?.consecutiveCorrect).toBe(0);
        // Check that it moved from LEVEL_1 to LEVEL_2
        expect(progress?.status).toBe('LEVEL_2');
      }
    });

    it('should handle mixed performance patterns', () => {
      const quizManager = new QuizManager(sampleTranslations);
      
      // Create mixed performance: correct, wrong, correct, wrong pattern
      for (let i = 0; i < 8; i++) {
        const result = quizManager.getNextQuestion();
        if (result.question) {
          const translationId = result.question.translationId;
          const correctAnswer = translationId === 1 ? 'привет' : translationId === 2 ? 'мир' : 'кот';
          const answer = i % 2 === 0 ? correctAnswer : 'wrong';
          
          quizManager.submitAnswer(translationId, answer);
        }
      }
      
      const state = quizManager.getState();
      
      // Should maintain valid state
      expect(state.progress.length).toBe(3);
      state.progress.forEach(p => {
        expect(['LEVEL_0', 'LEVEL_1', 'LEVEL_2', 'LEVEL_3', 'LEVEL_4', 'LEVEL_5']).toContain(p.status);
        expect(p.queuePosition).toBeGreaterThanOrEqual(0);
        expect(p.consecutiveCorrect).toBeGreaterThanOrEqual(0);
      });
    });
  });
});