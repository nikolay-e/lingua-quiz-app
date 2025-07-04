import { describe, it, expect, beforeEach } from 'vitest';
import { QuizManager, Translation, checkAnswer, normalize, formatForDisplay, K, F } from '../src/index';

describe('Text Processing Functions', () => {
  describe('normalize', () => {
    it('should handle basic normalization', () => {
      expect(normalize('  Hello  World  ')).toBe('hello world');
      expect(normalize('UPPERCASE')).toBe('uppercase');
    });

    it('should handle Cyrillic normalization', () => {
      expect(normalize('ёлка')).toBe('елка');
      expect(normalize('ЁЛКА')).toBe('елка');
    });

    it('should handle Latin to Cyrillic conversion', () => {
      expect(normalize('cop')).toBe('сор');
      expect(normalize('COP')).toBe('сор');
    });
  });

  describe('formatForDisplay', () => {
    it('should handle pipe alternatives', () => {
      expect(formatForDisplay('hello|hi|hey')).toBe('hello');
      expect(formatForDisplay('привет|здравствуй')).toBe('привет');
    });

    it('should preserve brackets, commas, and parentheses', () => {
      expect(formatForDisplay('word[s]')).toBe('word[s]');
      expect(formatForDisplay('red, blue')).toBe('red, blue');
      expect(formatForDisplay('word (context)')).toBe('word (context)');
    });
  });

  describe('checkAnswer', () => {
    it('should handle basic matching', () => {
      expect(checkAnswer('hello', 'hello')).toBe(true);
      expect(checkAnswer('Hello', 'hello')).toBe(true);
      expect(checkAnswer('hello', 'world')).toBe(false);
    });

    it('should handle pipe alternatives', () => {
      expect(checkAnswer('hello', 'hello|hi|hey')).toBe(true);
      expect(checkAnswer('hi', 'hello|hi|hey')).toBe(true);
      expect(checkAnswer('world', 'hello|hi|hey')).toBe(false);
    });

    it('should handle bracket optional parts', () => {
      expect(checkAnswer('good morning', 'good [morning]')).toBe(true);
      expect(checkAnswer('good', 'good [morning]')).toBe(true);
      expect(checkAnswer('morning', 'good [morning]')).toBe(false);
    });

    it('should handle comma-separated required parts', () => {
      expect(checkAnswer('red, blue', 'red, blue')).toBe(true);
      expect(checkAnswer('blue, red', 'red, blue')).toBe(true);
      expect(checkAnswer('red', 'red, blue')).toBe(false);
    });
  });
});

describe('QuizManager', () => {
  let mockTranslations: Translation[];
  let quizManager: QuizManager;

  beforeEach(() => {
    mockTranslations = [
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

    quizManager = new QuizManager(mockTranslations);
  });

  describe('initialization', () => {
    it('should initialize with correct default state', () => {
      const state = quizManager.getState();
      expect(state.currentLevel).toBe('LEVEL_1');
      expect(state.progress).toHaveLength(3);
      
      // All words should start in focus pool (LEVEL_1) due to replenishFocusPool
      const level1Words = state.progress.filter(p => p.status === 'LEVEL_1');
      expect(level1Words).toHaveLength(3);
    });

    it('should initialize with custom options', () => {
      const customManager = new QuizManager(mockTranslations, {}, {
        maxFocusWords: 5,
        correctAnswersToLevelUp: 5,
        enableUsageExamples: false
      });
      
      const options = customManager.getOptions();
      expect(options.maxFocusWords).toBe(5);
      expect(options.correctAnswersToLevelUp).toBe(5);
      expect(options.enableUsageExamples).toBe(false);
    });

    it('should restore from initial state', () => {
      const initialState = {
        progress: [
          {
            translationId: 1,
            status: 'LEVEL_2' as const,
            queuePosition: 0,
            consecutiveCorrect: 2,
            recentHistory: [true, true]
          }
        ],
        currentLevel: 'LEVEL_2' as const
      };

      const restoredManager = new QuizManager(mockTranslations, initialState);
      const state = restoredManager.getState();
      
      expect(state.currentLevel).toBe('LEVEL_2');
      const progress1 = state.progress.find(p => p.translationId === 1);
      expect(progress1?.status).toBe('LEVEL_2');
      expect(progress1?.consecutiveCorrect).toBe(2);
    });
  });

  describe('question generation', () => {
    it('should generate a valid question', () => {
      const result = quizManager.getNextQuestion();
      expect(result.question).toBeDefined();
      
      if (result.question) {
        expect(result.question.translationId).toBeDefined();
        expect(result.question.questionText).toBeDefined();
        expect(result.question.level).toBe('LEVEL_1');
        expect(result.question.direction).toBe('normal');
        expect(result.question.questionType).toBe('translation');
      }
    });

    it('should handle different levels correctly', () => {
      // Move some words to LEVEL_2 first
      quizManager.submitAnswer(1, 'привет');
      quizManager.submitAnswer(1, 'привет');
      quizManager.submitAnswer(1, 'привет'); // Should promote to LEVEL_2

      // Set level to LEVEL_2 (reverse direction)
      const setResult = quizManager.setLevel('LEVEL_2');
      expect(setResult.success).toBe(true);

      const result = quizManager.getNextQuestion();
      if (result.question) {
        expect(result.question.level).toBe('LEVEL_2');
        expect(result.question.direction).toBe('reverse');
      }
    });

    it('should auto-adjust level when no words available', () => {
      // Try to set a level with no words
      const setResult = quizManager.setLevel('LEVEL_3');
      expect(setResult.success).toBe(false);
      expect(setResult.actualLevel).toBe('LEVEL_1');
      expect(setResult.message).toContain('LEVEL_3 has no available words');
    });
  });

  describe('answer submission and progression', () => {
    it('should handle correct answers', () => {
      const question = quizManager.getNextQuestion().question!;
      const result = quizManager.submitAnswer(question.translationId, 'привет');
      
      expect(result.isCorrect).toBe(true);
      expect(result.correctAnswerText).toBe('привет');
      expect(result.submittedAnswerText).toBe('привет');
      expect(result.translation).toBeDefined();
    });

    it('should handle incorrect answers', () => {
      const question = quizManager.getNextQuestion().question!;
      const result = quizManager.submitAnswer(question.translationId, 'wrong');
      
      expect(result.isCorrect).toBe(false);
      expect(result.correctAnswerText).toBe('привет');
      expect(result.submittedAnswerText).toBe('wrong');
    });

    it('should track consecutive correct answers', () => {
      const question = quizManager.getNextQuestion().question!;
      const translationId = question.translationId;
      
      // Submit 2 correct answers
      quizManager.submitAnswer(translationId, 'привет');
      quizManager.submitAnswer(translationId, 'привет');
      
      const state = quizManager.getState();
      const progress = state.progress.find(p => p.translationId === translationId);
      expect(progress?.consecutiveCorrect).toBe(2);
      expect(progress?.status).toBe('LEVEL_1'); // Not promoted yet
      
      // Third correct answer should promote
      const result = quizManager.submitAnswer(translationId, 'привет');
      expect(result.levelChange).toBeDefined();
      expect(result.levelChange?.from).toBe('LEVEL_1');
      expect(result.levelChange?.to).toBe('LEVEL_2');
    });

    it('should handle word degradation after mistakes', () => {
      // First, promote a word to LEVEL_2
      const question = quizManager.getNextQuestion().question!;
      const translationId = question.translationId;
      
      quizManager.submitAnswer(translationId, 'привет');
      quizManager.submitAnswer(translationId, 'привет');
      quizManager.submitAnswer(translationId, 'привет'); // Promoted to LEVEL_2
      
      // Now make 3 mistakes
      quizManager.submitAnswer(translationId, 'wrong1');
      quizManager.submitAnswer(translationId, 'wrong2');
      quizManager.submitAnswer(translationId, 'wrong3');
      
      // Should be degraded back to LEVEL_1
      const state = quizManager.getState();
      const progress = state.progress.find(p => p.translationId === translationId);
      expect(progress?.status).toBe('LEVEL_1');
    });

    it('should reset consecutive counter after wrong answer', () => {
      const question = quizManager.getNextQuestion().question!;
      const translationId = question.translationId;
      
      // Submit 2 correct answers
      quizManager.submitAnswer(translationId, 'привет');
      quizManager.submitAnswer(translationId, 'привет');
      
      // Submit wrong answer
      quizManager.submitAnswer(translationId, 'wrong');
      
      const state = quizManager.getState();
      const progress = state.progress.find(p => p.translationId === translationId);
      expect(progress?.consecutiveCorrect).toBe(0);
    });
  });

  describe('queue management', () => {
    it('should manage queue positions correctly', () => {
      const question = quizManager.getNextQuestion().question!;
      const translationId = question.translationId;
      const initialState = quizManager.getState();
      
      // Get initial queue state
      const level1Queue = [...initialState.queues.LEVEL_1];
      expect(level1Queue[0]).toBe(translationId); // Should be first
      
      // Submit correct answer
      quizManager.submitAnswer(translationId, 'привет');
      
      const newState = quizManager.getState();
      const newLevel1Queue = newState.queues.LEVEL_1;
      
      // Word should be moved to position (K × F) × consecutiveCorrect
      // With a 3-word queue, position (K × F) should place it at the end
      const expectedQueuePosition = K * F * 1; // 1 consecutive correct answer
      const queueLength = newLevel1Queue.length;
      const expectedIndex = Math.min(expectedQueuePosition, queueLength - 1);
      
      const newPosition = newLevel1Queue.indexOf(translationId);
      expect(newPosition).toBe(expectedIndex);
    });

    it('should handle queue replenishment', () => {
      // All words should start in LEVEL_1 due to replenishFocusPool
      const state = quizManager.getState();
      const level1Count = state.progress.filter(p => p.status === 'LEVEL_1').length;
      expect(level1Count).toBe(3); // All words moved from LEVEL_0 to LEVEL_1
    });
  });

  describe('statistics and completion', () => {
    it('should calculate statistics correctly', () => {
      const stats = quizManager.getStatistics();
      
      expect(stats.totalWords).toBe(3);
      expect(stats.levelCounts.LEVEL_0).toBe(0); // All moved to LEVEL_1
      expect(stats.levelCounts.LEVEL_1).toBe(3);
      expect(stats.completionPercentage).toBe(0);
      expect(stats.isComplete).toBe(false);
    });

    it('should track completion progress', () => {
      // Promote all words to completion level (LEVEL_3 or LEVEL_5 depending on options)
      const targetLevel = quizManager.getOptions().enableUsageExamples ? 'LEVEL_5' : 'LEVEL_3';
      
      // For simplicity, manually set all words to target level
      const state = quizManager.getState();
      state.progress.forEach(p => {
        p.status = targetLevel as any;
      });
      
      const stats = quizManager.getStatistics();
      expect(stats.completionPercentage).toBe(100);
      expect(stats.isComplete).toBe(true);
    });
  });

  describe('level switching', () => {
    it('should switch levels successfully when words are available', () => {
      // First promote a word to LEVEL_2
      const question = quizManager.getNextQuestion().question!;
      quizManager.submitAnswer(question.translationId, 'привет');
      quizManager.submitAnswer(question.translationId, 'привет');
      quizManager.submitAnswer(question.translationId, 'привет');
      
      // Now switch to LEVEL_2
      const result = quizManager.setLevel('LEVEL_2');
      expect(result.success).toBe(true);
      expect(result.actualLevel).toBe('LEVEL_2');
      expect(quizManager.getCurrentLevel()).toBe('LEVEL_2');
    });

    it('should auto-adjust to available level when requested level is empty', () => {
      // Try to switch to LEVEL_3 (which has no words)
      const result = quizManager.setLevel('LEVEL_3');
      expect(result.success).toBe(false);
      expect(result.actualLevel).toBe('LEVEL_1');
      expect(result.message).toContain('LEVEL_3 has no available words');
    });
  });

  describe('translation utilities', () => {
    it('should get translation by ID', () => {
      const translation = quizManager.getTranslation(1);
      expect(translation).toBeDefined();
      expect(translation?.sourceWord.text).toBe('hello');
      expect(translation?.targetWord.text).toBe('привет');
    });

    it('should get formatted translation for display', () => {
      const formatted = quizManager.getTranslationForDisplay(1);
      expect(formatted).toBeDefined();
      expect(formatted?.source).toBe('hello');
      expect(formatted?.target).toBe('привет');
    });

    it('should return undefined for non-existent translation', () => {
      const translation = quizManager.getTranslation(999);
      expect(translation).toBeUndefined();
      
      const formatted = quizManager.getTranslationForDisplay(999);
      expect(formatted).toBeUndefined();
    });
  });

  describe('edge cases', () => {
    it('should handle empty translation list', () => {
      const emptyManager = new QuizManager([]);
      const question = emptyManager.getNextQuestion();
      expect(question.question).toBeNull();
    });

    it('should throw error for invalid translation ID in submitAnswer', () => {
      expect(() => {
        quizManager.submitAnswer(999, 'answer');
      }).toThrow('Translation or progress not found');
    });

    it('should handle response time tracking', () => {
      const question = quizManager.getNextQuestion().question!;
      
      // Wait a bit to ensure response time is measurable
      setTimeout(() => {
        const result = quizManager.submitAnswer(question.translationId, 'привет');
        expect(result.responseTimeMs).toBeDefined();
        expect(result.responseTimeMs).toBeGreaterThan(0);
      }, 10);
    });
  });
});