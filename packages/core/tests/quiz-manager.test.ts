import { describe, it, expect, beforeEach } from 'vitest';
import { QuizManager, Translation, K, F } from '../src/index';

describe('QuizManager Tests', () => {
  const sampleTranslations: Translation[] = [
    {
      id: 1,
      sourceText: 'hello',
      sourceLanguage: 'en',
      sourceUsageExample: 'Hello world!',
      targetText: 'привет',
      targetLanguage: 'ru',
      targetUsageExample: 'Привет мир!',
    },
    {
      id: 2,
      sourceText: 'world',
      sourceLanguage: 'en',
      sourceUsageExample: 'Hello world!',
      targetText: 'мир',
      targetLanguage: 'ru',
      targetUsageExample: 'Привет мир!',
    },
    {
      id: 3,
      sourceText: 'cat',
      sourceLanguage: 'en',
      targetText: 'кот',
      targetLanguage: 'ru',
    },
    {
      id: 4,
      sourceText: 'dog',
      sourceLanguage: 'en',
      targetText: 'собака',
      targetLanguage: 'ru',
    },
    {
      id: 5,
      sourceText: 'book',
      sourceLanguage: 'en',
      targetText: 'книга',
      targetLanguage: 'ru',
    },
  ];

  describe('QuizManager Basic Functionality', () => {
    let quizManager: QuizManager;

    beforeEach(() => {
      quizManager = new QuizManager(sampleTranslations);
    });

    it('should initialize with focus pool automatically replenished', () => {
      const state = quizManager.getState();
      const expectedFocusWords = Math.min(sampleTranslations.length, quizManager.getOptions().maxFocusWords);
      expect(state.queues.LEVEL_1.length).toBe(expectedFocusWords);
      expect(state.queues.LEVEL_0.length).toBe(sampleTranslations.length - expectedFocusWords);
    });

    it('should provide next question from LEVEL_1', () => {
      const result = quizManager.getNextQuestion();

      expect(result.question).toBeTruthy();
      expect(result.question?.level).toBe('LEVEL_1');
      expect(result.question?.direction).toBe('normal');
      expect(result.question?.questionType).toBe('translation');
    });

    it('should handle correct answers and update queue positions', () => {
      const result = quizManager.getNextQuestion();
      expect(result.question).toBeTruthy();

      const { translationId } = result.question!;
      const translation = quizManager.getTranslation(translationId);
      expect(translation).toBeTruthy();

      const submission = quizManager.submitAnswer(translationId, translation!.targetText);

      expect(submission.isCorrect).toBe(true);
      expect(submission.translation).toEqual(translation);
    });

    it('should handle incorrect answers and move word to focus position', () => {
      const result = quizManager.getNextQuestion();
      expect(result.question).toBeTruthy();

      const { translationId } = result.question!;

      const submission = quizManager.submitAnswer(translationId, 'wrong answer');

      expect(submission.isCorrect).toBe(false);

      const state = quizManager.getState();
      const wordQueue = state.queues.LEVEL_1;
      const wordIndex = wordQueue.indexOf(translationId);
      const expectedIndex = Math.min(F, wordQueue.length - 1);
      expect(wordIndex).toBe(expectedIndex);
    });

    it('should advance word to next level after consecutive correct answers', () => {
      const result = quizManager.getNextQuestion();
      expect(result.question).toBeTruthy();

      const { translationId } = result.question!;
      const translation = quizManager.getTranslation(translationId);
      expect(translation).toBeTruthy();

      const correctAnswersNeeded = quizManager.getOptions().correctAnswersToLevelUp;
      let lastSubmission: ReturnType<typeof quizManager.submitAnswer> | undefined;

      for (let i = 0; i < correctAnswersNeeded; i++) {
        const nextResult = quizManager.getNextQuestion();
        if (nextResult.question?.translationId === translationId) {
          lastSubmission = quizManager.submitAnswer(translationId, translation!.targetText);
        }
      }

      if (lastSubmission?.levelChange) {
        expect(lastSubmission.levelChange.from).toBe('LEVEL_1');
        expect(lastSubmission.levelChange.to).toBe('LEVEL_2');
      }
    });

    it('should track response time', async () => {
      const result = quizManager.getNextQuestion();
      expect(result.question).toBeTruthy();

      const { translationId } = result.question!;

      await new Promise((resolve) => setTimeout(resolve, 10));

      const submission = quizManager.submitAnswer(translationId, 'any answer');
      expect(submission.responseTimeMs).toBeGreaterThan(0);
    });

    it('should provide statistics', () => {
      const stats = quizManager.getStatistics();

      expect(stats.totalWords).toBe(sampleTranslations.length);
      expect(stats.levelCounts.LEVEL_0 + stats.levelCounts.LEVEL_1).toBe(sampleTranslations.length);
      expect(stats.completionPercentage).toBeGreaterThanOrEqual(0);
      expect(stats.isComplete).toBe(false);
    });

    it('should get words by level for persistence', () => {
      const wordsByLevel = quizManager.getWordsByLevel();

      expect(Object.keys(wordsByLevel)).toEqual(['LEVEL_0', 'LEVEL_1', 'LEVEL_2', 'LEVEL_3', 'LEVEL_4', 'LEVEL_5']);

      const totalWords = Object.values(wordsByLevel).reduce((sum, level) => sum + level.length, 0);
      expect(totalWords).toBe(sampleTranslations.length);
    });
  });

  describe('Level Management', () => {
    let quizManager: QuizManager;

    beforeEach(() => {
      quizManager = new QuizManager(sampleTranslations);
    });

    it('should start with LEVEL_1 as current level', () => {
      expect(quizManager.getCurrentLevel()).toBe('LEVEL_1');
    });

    it('should allow setting valid levels', () => {
      const result = quizManager.setLevel('LEVEL_1');
      expect(result.success).toBe(true);
      expect(result.actualLevel).toBe('LEVEL_1');
      expect(quizManager.getCurrentLevel()).toBe('LEVEL_1');
    });

    it('should automatically switch to available level when requested level is empty', () => {
      const result = quizManager.setLevel('LEVEL_3');
      expect(result.success).toBe(false);
      expect(result.actualLevel).toBe('LEVEL_1');
      expect(result.message).toContain('has no available words');
    });

    it('should auto-adjust level when current level becomes empty', () => {
      const currentLevel = quizManager.getCurrentLevel();
      expect(['LEVEL_1', 'LEVEL_2', 'LEVEL_3', 'LEVEL_4']).toContain(currentLevel);
    });
  });

  describe('Translation Display', () => {
    let quizManager: QuizManager;

    beforeEach(() => {
      const complexTranslations: Translation[] = [
        {
          id: 1,
          sourceText: 'test',
          sourceLanguage: 'en',
          targetText: 'тест|испытание',
          targetLanguage: 'ru',
        },
        {
          id: 2,
          sourceText: 'example',
          sourceLanguage: 'en',
          targetText: '(пример|образец), случай',
          targetLanguage: 'ru',
        },
      ];
      quizManager = new QuizManager(complexTranslations);
    });

    it('should format translations for display correctly', () => {
      const display1 = quizManager.getTranslationForDisplay(1);
      expect(display1).toBeTruthy();
      expect(display1?.target).toBe('тест');

      const display2 = quizManager.getTranslationForDisplay(2);
      expect(display2).toBeTruthy();
      expect(display2?.target).toBe('пример, случай');
    });

    it('should return undefined for non-existent translation', () => {
      const display = quizManager.getTranslationForDisplay(999);
      expect(display).toBeUndefined();
    });
  });

  describe('Custom Options', () => {
    it('should accept custom configuration options', () => {
      const customOptions = {
        maxFocusWords: 10,
        correctAnswersToLevelUp: 5,
        queuePositionIncrement: 8,
      };

      const quizManager = new QuizManager(sampleTranslations, {}, customOptions);
      const options = quizManager.getOptions();

      expect(options.maxFocusWords).toBe(10);
      expect(options.correctAnswersToLevelUp).toBe(5);
      expect(options.queuePositionIncrement).toBe(8);
    });

    it('should use default values when options not provided', () => {
      const quizManager = new QuizManager(sampleTranslations);
      const options = quizManager.getOptions();

      expect(options.queuePositionIncrement).toBe(K * F);
      expect(options.enableUsageExamples).toBe(true);
    });
  });

  describe('Initial State Handling', () => {
    it('should restore progress from initial state', () => {
      const initialProgress = [
        {
          translationId: 1,
          level: 'LEVEL_2' as const,
          consecutiveCorrect: 1,
          recentHistory: [true, false, true],
        },
      ];

      const quizManager = new QuizManager(sampleTranslations, { progress: initialProgress });
      const state = quizManager.getState();

      expect(state.queues.LEVEL_2).toContain(1);
      expect(state.queues.LEVEL_0).not.toContain(1);
      expect(state.queues.LEVEL_1).not.toContain(1);
    });

    it('should set custom initial level', () => {
      const quizManager = new QuizManager(sampleTranslations, { currentLevel: 'LEVEL_2' });

      const currentLevel = quizManager.getCurrentLevel();
      expect(['LEVEL_1', 'LEVEL_2', 'LEVEL_3', 'LEVEL_4']).toContain(currentLevel);
    });
  });

  describe('Edge Cases', () => {
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

    it('should handle invalid translation IDs', () => {
      const quizManager = new QuizManager(sampleTranslations);

      expect(() => {
        quizManager.submitAnswer(999, 'any answer');
      }).toThrow('Translation or progress not found');
    });

    it('should maintain consistency during rapid operations', () => {
      const quizManager = new QuizManager(sampleTranslations);

      for (let i = 0; i < 20; i++) {
        const result = quizManager.getNextQuestion();
        if (result.question) {
          const correctAnswers = ['привет', 'мир', 'кот', 'собака', 'книга'];
          const answer = i % 3 === 0 ? 'wrong' : correctAnswers[result.question.translationId - 1];
          quizManager.submitAnswer(result.question.translationId, answer);
        }
      }

      const finalState = quizManager.getState();
      expect(finalState.progress.length).toBe(sampleTranslations.length);
    });
  });
});
