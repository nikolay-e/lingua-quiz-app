import { describe, it, expect, beforeEach } from 'vitest';
import { QuizManager, Translation, checkAnswer, formatForDisplay, K, F } from '../src/index';

describe('Text Processing Functions', () => {
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

    it('should handle parentheses groups with pipes - showing only first alternative without parentheses', () => {
      // Test cases from the bug report
      expect(formatForDisplay('(менять|изменять), (изменение|смена)')).toBe('менять, изменение');
      expect(formatForDisplay('(трудный|сложный), (твёрдый|жёсткий), усердно')).toBe('трудный, твёрдый, усердно');
      expect(formatForDisplay('(матч|соревнование), спичка, (подходить|соответствовать)')).toBe('матч, спичка, подходить');
      expect(formatForDisplay('(значить|означать), иметь в виду')).toBe('значить, иметь в виду');
      expect(formatForDisplay('(двигать|перемещать), переезжать, движение')).toBe('двигать, переезжать, движение');
      expect(formatForDisplay('(записка|заметка), нота [музыка], замечать')).toBe('записка, нота [музыка], замечать');
    });

    it('should handle complex mixed formats', () => {
      // Parentheses without pipes should be preserved as-is
      expect(formatForDisplay('word (context), another')).toBe('word (context), another');
      // Single parentheses group with pipes
      expect(formatForDisplay('(option1|option2|option3)')).toBe('option1');
      // Mixed parentheses - some with pipes, some without
      expect(formatForDisplay('(a|b), (context), (x|y|z)')).toBe('a, (context), x');
    });

    it('should handle real-world documentation examples', () => {
      // Example from docs: banco → банк, скамейка
      expect(formatForDisplay('банк, скамейка')).toBe('банк, скамейка');

      // Example from docs: bonito|hermoso|lindo
      expect(formatForDisplay('bonito|hermoso|lindo')).toBe('bonito');

      // Example from docs: paz → мир [гармония]
      expect(formatForDisplay('мир [гармония]')).toBe('мир [гармония]');

      // Example from docs: planta → этаж (здания)
      expect(formatForDisplay('этаж (здания)')).toBe('этаж (здания)');

      // Example from docs: машина|автомобиль
      expect(formatForDisplay('машина|автомобиль')).toBe('машина');
    });

    it('should handle nested and complex patterns', () => {
      // Multiple parentheses groups in succession
      expect(formatForDisplay('(a|b)(c|d)(e|f)')).toBe('ace');

      // Parentheses groups with commas and other text
      expect(formatForDisplay('prefix, (option1|option2), suffix, (choice1|choice2)')).toBe('prefix, option1, suffix, choice1');

      // Empty parentheses (edge case)
      expect(formatForDisplay('word ()')).toBe('word'); // Empty parentheses should be removed
      expect(formatForDisplay('word (|)')).toBe('word'); // Empty alternative should be removed

      // Single pipe at start/end of parentheses
      expect(formatForDisplay('(|option)')).toBe('option');
      expect(formatForDisplay('(option|)')).toBe('option');
    });

    it('should handle whitespace variations', () => {
      // Spaces around pipes
      expect(formatForDisplay('hello | hi | hey')).toBe('hello');
      expect(formatForDisplay('(option1 | option2 | option3)')).toBe('option1');

      // Tabs and multiple spaces
      expect(formatForDisplay('hello\t|\thi')).toBe('hello');
      expect(formatForDisplay('(a  |  b), (c|d)')).toBe('a, c');

      // Leading/trailing spaces in alternatives
      expect(formatForDisplay('( space1 | space2 )')).toBe('space1');
    });

    it('should preserve non-parentheses formatting', () => {
      // Square brackets should always be preserved
      expect(formatForDisplay('word[suffix]')).toBe('word[suffix]');
      expect(formatForDisplay('prefix[opt1|opt2]suffix')).toBe('prefix[opt1|opt2]suffix');

      // Commas should always be preserved
      expect(formatForDisplay('first, second, third')).toBe('first, second, third');

      // Regular parentheses without pipes should be preserved
      expect(formatForDisplay('word (explanation)')).toBe('word (explanation)');
      expect(formatForDisplay('multiple (words) with (context)')).toBe('multiple (words) with (context)');
    });

    it('should handle malformed input gracefully', () => {
      // Unmatched brackets/parentheses
      expect(formatForDisplay('word[incomplete')).toBe('word[incomplete');
      expect(formatForDisplay('incomplete]word')).toBe('incomplete]word');
      expect(formatForDisplay('word(incomplete')).toBe('word(incomplete');
      expect(formatForDisplay('incomplete)word')).toBe('incomplete)word');

      // Empty alternatives
      expect(formatForDisplay('word||another')).toBe('word');
      expect(formatForDisplay('||word')).toBe('');
      expect(formatForDisplay('word||')).toBe('word');

      // Empty parentheses groups - should be cleaned up
      expect(formatForDisplay('()')).toBe('');
      expect(formatForDisplay('word, ()')).toBe('word');
      expect(formatForDisplay('()|valid')).toBe('');

      // Only separators
      expect(formatForDisplay('|||')).toBe('');
      expect(formatForDisplay('((()))')).toBe(''); // Should remove all empty parentheses
    });

    it('should handle unicode and special characters', () => {
      // Unicode characters in alternatives
      expect(formatForDisplay('café|naïve')).toBe('café');
      expect(formatForDisplay('😀|😃')).toBe('😀');

      // Mixed scripts
      expect(formatForDisplay('English|Русский')).toBe('English');
      expect(formatForDisplay('(option1|вариант2)')).toBe('option1');

      // Special whitespace characters
      expect(formatForDisplay('word\t|\tother')).toBe('word');
      expect(formatForDisplay('word\u00A0|other')).toBe('word'); // Non-breaking space
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

    it('should handle bracket optional parts without spaces', () => {
      // Test case from bug report: парковать[ся]
      expect(checkAnswer('парковать', 'парковать[ся]')).toBe(true);
      expect(checkAnswer('парковаться', 'парковать[ся]')).toBe(true);
      expect(checkAnswer('парковать ся', 'парковать[ся]')).toBe(true);

      // More test cases
      expect(checkAnswer('test', 'test[ing]')).toBe(true);
      expect(checkAnswer('testing', 'test[ing]')).toBe(true);
      expect(checkAnswer('test ing', 'test[ing]')).toBe(true);

      // Should not accept just the optional part
      expect(checkAnswer('ся', 'парковать[ся]')).toBe(false);
      expect(checkAnswer('ing', 'test[ing]')).toBe(false);
    });

    it('should handle comma-separated required parts', () => {
      expect(checkAnswer('red, blue', 'red, blue')).toBe(true);
      expect(checkAnswer('blue, red', 'red, blue')).toBe(true);
      expect(checkAnswer('red', 'red, blue')).toBe(false);
      expect(checkAnswer('blue', 'red, blue')).toBe(false);

      // Real example from docs: carta (letter, card, menu)
      expect(checkAnswer('письмо, карта, меню', 'письмо, карта, меню')).toBe(true);
      expect(checkAnswer('меню, письмо, карта', 'письмо, карта, меню')).toBe(true);
      expect(checkAnswer('письмо', 'письмо, карта, меню')).toBe(false);
      expect(checkAnswer('письмо, карта', 'письмо, карта, меню')).toBe(false);
    });

    it('should handle parentheses grouping with pipes', () => {
      // Real example from docs: gleich → (равный|одинаковый), (сейчас|сразу)
      const answer = '(равный|одинаковый), (сейчас|сразу)';

      // ✅ Valid combinations - one from each group
      expect(checkAnswer('равный, сейчас', answer)).toBe(true);
      expect(checkAnswer('одинаковый, сразу', answer)).toBe(true);
      expect(checkAnswer('равный, сразу', answer)).toBe(true);
      expect(checkAnswer('одинаковый, сейчас', answer)).toBe(true);
      expect(checkAnswer('сейчас, равный', answer)).toBe(true); // Order doesn't matter

      // ❌ Invalid - incomplete (missing one group)
      expect(checkAnswer('равный', answer)).toBe(false);
      expect(checkAnswer('сейчас', answer)).toBe(false);

      // ❌ Invalid - treating as 3 separate meanings
      expect(checkAnswer('равный, одинаковый, сейчас', answer)).toBe(false);

      // ❌ Invalid - wrong words
      expect(checkAnswer('неправильно, слово', answer)).toBe(false);
    });

    it('should handle Cyrillic normalization in answers', () => {
      // ё/е equivalence
      expect(checkAnswer('тёмный', 'темный')).toBe(true);
      expect(checkAnswer('темный', 'тёмный')).toBe(true);
      expect(checkAnswer('ТЁМНЫЙ', 'темный')).toBe(true);

      // In pipe alternatives
      expect(checkAnswer('тёмный', 'темный|чёрный')).toBe(true);
      expect(checkAnswer('чёрный', 'темный|черный')).toBe(true);

      // In comma-separated parts
      expect(checkAnswer('тёмный, чёрный', 'темный, черный')).toBe(true);
      expect(checkAnswer('черный, тёмный', 'темный, чёрный')).toBe(true);
    });

    it('should handle Latin to Cyrillic conversion in answers', () => {
      // Basic conversion
      expect(checkAnswer('cop', 'сор')).toBe(true);
      expect(checkAnswer('сор', 'cop')).toBe(true);
      expect(checkAnswer('COP', 'сор')).toBe(true);

      // In pipe alternatives
      expect(checkAnswer('cop', 'сор|мусор')).toBe(true);
      expect(checkAnswer('мусор', 'cop|мусор')).toBe(true);

      // In comma-separated parts
      expect(checkAnswer('cop, мусор', 'сор, мусор')).toBe(true);
      expect(checkAnswer('сор, мусор', 'cop, мусор')).toBe(true);
    });

    it('should handle Spanish accent normalization in answers', () => {
      // Basic Spanish accents
      expect(checkAnswer('cafe', 'café')).toBe(true);
      expect(checkAnswer('café', 'cafe')).toBe(true);
      expect(checkAnswer('nino', 'niño')).toBe(true);
      expect(checkAnswer('niño', 'nino')).toBe(true);
      expect(checkAnswer('corazon', 'corazón')).toBe(true);
      expect(checkAnswer('espanol', 'español')).toBe(true);

      // In pipe alternatives
      expect(checkAnswer('cafe', 'café|coffee')).toBe(true);
      expect(checkAnswer('coffee', 'café|coffee')).toBe(true);
      expect(checkAnswer('café', 'cafe|coffee')).toBe(true);

      // In comma-separated parts
      expect(checkAnswer('cafe, nino', 'café, niño')).toBe(true);
      expect(checkAnswer('café, niño', 'cafe, nino')).toBe(true);

      // Mixed case
      expect(checkAnswer('MÉXICO', 'mexico')).toBe(true);
      expect(checkAnswer('educación', 'EDUCACION')).toBe(true);
    });

    it('should handle German umlaut normalization in answers', () => {
      // Basic German umlauts
      expect(checkAnswer('mude', 'müde')).toBe(true);
      expect(checkAnswer('müde', 'mude')).toBe(true);
      expect(checkAnswer('uber', 'über')).toBe(true);
      expect(checkAnswer('über', 'uber')).toBe(true);
      expect(checkAnswer('schon', 'schön')).toBe(true);
      expect(checkAnswer('grosse', 'größe')).toBe(true);

      // German letter + e equivalents
      expect(checkAnswer('muede', 'müde')).toBe(true);
      expect(checkAnswer('müde', 'muede')).toBe(true);
      expect(checkAnswer('ueber', 'über')).toBe(true);
      expect(checkAnswer('über', 'ueber')).toBe(true);
      expect(checkAnswer('schoen', 'schön')).toBe(true);
      expect(checkAnswer('schön', 'schoen')).toBe(true);
      expect(checkAnswer('groesse', 'größe')).toBe(true);
      expect(checkAnswer('größe', 'groesse')).toBe(true);

      // In pipe alternatives
      expect(checkAnswer('mude', 'müde|tired')).toBe(true);
      expect(checkAnswer('muede', 'müde|tired')).toBe(true);
      expect(checkAnswer('tired', 'müde|tired')).toBe(true);
      expect(checkAnswer('müde', 'mude|tired')).toBe(true);

      // In comma-separated parts
      expect(checkAnswer('mude, schon', 'müde, schön')).toBe(true);
      expect(checkAnswer('muede, schoen', 'müde, schön')).toBe(true);
      expect(checkAnswer('müde, schön', 'mude, schon')).toBe(true);

      // Mixed case
      expect(checkAnswer('ÜBER', 'uber')).toBe(true);
      expect(checkAnswer('UEBER', 'über')).toBe(true);
      expect(checkAnswer('größe', 'GROSSE')).toBe(true);
      expect(checkAnswer('größe', 'GROESSE')).toBe(true);
    });

    it('should handle mixed language normalization in answers', () => {
      // Spanish + German
      expect(checkAnswer('cafe mude', 'café müde')).toBe(true);
      expect(checkAnswer('niño über', 'nino uber')).toBe(true);

      // With pipes
      expect(checkAnswer('cafe', 'café|müde')).toBe(true);
      expect(checkAnswer('mude', 'café|müde')).toBe(true);

      // With commas
      expect(checkAnswer('español, schön', 'espanol, schon')).toBe(true);
      expect(checkAnswer('corazón, größe', 'corazon, grosse')).toBe(true);
    });

    it('should handle complex bracket scenarios', () => {
      // Multiple words before/after brackets
      expect(checkAnswer('good morning coffee', 'good morning [coffee]')).toBe(true);
      expect(checkAnswer('good morning', 'good morning [coffee]')).toBe(true);
      expect(checkAnswer('coffee', 'good morning [coffee]')).toBe(false);

      // Brackets in middle
      expect(checkAnswer('word context here', 'word [context] here')).toBe(true);
      expect(checkAnswer('word here', 'word [context] here')).toBe(true);
      expect(checkAnswer('wordcontexthere', 'word [context] here')).toBe(true);
      expect(checkAnswer('word contexthere', 'word [context] here')).toBe(true);

      // Real examples from docs
      expect(checkAnswer('мир', 'мир [вселенная]')).toBe(true);
      expect(checkAnswer('мир вселенная', 'мир [вселенная]')).toBe(true);
      expect(checkAnswer('мирвселенная', 'мир [вселенная]')).toBe(true);
      expect(checkAnswer('вселенная', 'мир [вселенная]')).toBe(false);
      expect(checkAnswer('мир, вселенная', 'мир [вселенная]')).toBe(false);
    });

    it('should handle edge cases and invalid inputs', () => {
      // Empty strings
      expect(checkAnswer('', '')).toBe(true);
      expect(checkAnswer('', 'word')).toBe(false);
      expect(checkAnswer('word', '')).toBe(false);

      // Whitespace handling
      expect(checkAnswer('  word  ', 'word')).toBe(true);
      expect(checkAnswer('word', '  word  ')).toBe(true);
      expect(checkAnswer('  red  ,  blue  ', 'red, blue')).toBe(true);

      // Special characters that should be ignored
      expect(checkAnswer('word', 'word')).toBe(true);
      expect(checkAnswer('word!', 'word')).toBe(false); // Punctuation matters
    });

    it('should handle mixed format combinations', () => {
      // Pipes with brackets: спасибо|благодарю [вам] means "спасибо" OR "благодарю [вам]"
      expect(checkAnswer('спасибо', 'спасибо|благодарю [вам]')).toBe(true);
      expect(checkAnswer('благодарю', 'спасибо|благодарю [вам]')).toBe(true);
      expect(checkAnswer('благодарю вам', 'спасибо|благодарю [вам]')).toBe(true);
      expect(checkAnswer('благодарювам', 'спасибо|благодарю [вам]')).toBe(true);

      // These should be false - brackets don't apply to first alternative
      expect(checkAnswer('спасибо вам', 'спасибо|благодарю [вам]')).toBe(false);
      expect(checkAnswer('спасибовам', 'спасибо|благодарю [вам]')).toBe(false);

      // Commas with brackets: письмо, карта [игральная]
      expect(checkAnswer('письмо, карта', 'письмо, карта [игральная]')).toBe(true);
      expect(checkAnswer('письмо, карта игральная', 'письмо, карта [игральная]')).toBe(true);
      expect(checkAnswer('письмо, картаигральная', 'письмо, карта [игральная]')).toBe(true);
      expect(checkAnswer('карта, письмо', 'письмо, карта [игральная]')).toBe(true);
      expect(checkAnswer('письмо', 'письмо, карта [игральная]')).toBe(false);

      // Parentheses with brackets: (записка|заметка), нота [музыка], замечать
      expect(checkAnswer('записка, нота, замечать', '(записка|заметка), нота [музыка], замечать')).toBe(true);
      expect(checkAnswer('заметка, нота музыка, замечать', '(записка|заметка), нота [музыка], замечать')).toBe(true);
      expect(checkAnswer('записка, нотамузыка, замечать', '(записка|заметка), нота [музыка], замечать')).toBe(true);
      expect(checkAnswer('записка, нота', '(записка|заметка), нота [музыка], замечать')).toBe(false);
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
        targetWord: { text: 'привет', language: 'ru', usageExample: 'Привет мир!' },
      },
      {
        id: 2,
        sourceWord: { text: 'world', language: 'en', usageExample: 'Hello world!' },
        targetWord: { text: 'мир', language: 'ru', usageExample: 'Привет мир!' },
      },
      {
        id: 3,
        sourceWord: { text: 'cat', language: 'en' },
        targetWord: { text: 'кот', language: 'ru' },
      },
    ];

    quizManager = new QuizManager(mockTranslations);
  });

  describe('initialization', () => {
    it('should initialize with correct default state', () => {
      const state = quizManager.getState();
      expect(state.currentLevel).toBe('LEVEL_1');
      expect(state.progress).toHaveLength(3);

      // All words should start in focus pool (LEVEL_1) due to replenishFocusPool
      const level1Words = state.progress.filter((p) => p.status === 'LEVEL_1');
      expect(level1Words).toHaveLength(3);
    });

    it('should initialize with custom options', () => {
      const customManager = new QuizManager(
        mockTranslations,
        {},
        {
          maxFocusWords: 5,
          correctAnswersToLevelUp: 5,
          enableUsageExamples: false,
        }
      );

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
            recentHistory: [true, true],
          },
        ],
        currentLevel: 'LEVEL_2' as const,
      };

      const restoredManager = new QuizManager(mockTranslations, initialState);
      const state = restoredManager.getState();

      expect(state.currentLevel).toBe('LEVEL_2');
      const progress1 = state.progress.find((p) => p.translationId === 1);
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
      const progress = state.progress.find((p) => p.translationId === translationId);
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
      const result = quizManager.submitAnswer(translationId, 'wrong3');

      // Should be degraded back to LEVEL_1
      const state = quizManager.getState();
      const progress = state.progress.find((p) => p.translationId === translationId);
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
      const progress = state.progress.find((p) => p.translationId === translationId);
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
      const level1Count = state.progress.filter((p) => p.status === 'LEVEL_1').length;
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
      state.progress.forEach((p) => {
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
