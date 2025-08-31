import { describe, it, expect } from 'vitest';
import { checkAnswer, formatForDisplay, normalizeForComparison } from '../src/answer-comparison';

// Helper to generate permutations for validating comma-separated answers
function getPermutations<T>(array: T[]): T[][] {
  if (array.length === 0) return [[]];
  const firstEl = array[0];
  const rest = array.slice(1);
  const permsWithoutFirst = getPermutations(rest);
  const allPermutations: T[][] = [];
  permsWithoutFirst.forEach((perm) => {
    for (let i = 0; i <= perm.length; i++) {
      const permWithFirst = [...perm.slice(0, i), firstEl, ...perm.slice(i)];
      allPermutations.push(permWithFirst);
    }
  });
  return allPermutations;
}

describe('Answer Comparison and Text Processing', () => {
  describe('1. Normalization (`normalizeForComparison`)', () => {
    const testCases = [
      // Case and Whitespace
      { input: '  HeLlO  wOrLd  ', expected: 'helloworld' },
      { input: '\t  Test  \n', expected: 'test' },

      // Cyrillic ё/е equivalence
      { input: 'Ещё один тёмный день', expected: 'ещеодинтемныйдень' },
      { input: 'тёмный', expected: 'темный' },
      { input: 'ТЁМНЫЙ', expected: 'темный' },

      // Latin-to-Cyrillic homoglyphs (in Cyrillic context)
      { input: 'cop', expected: 'сор' },
      { input: 'COP', expected: 'сор' },

      // German Umlauts and ß
      { input: 'Müller', expected: 'muller' },
      { input: 'Mueller', expected: 'muller' },
      { input: 'Schön', expected: 'schon' },
      { input: 'Schoen', expected: 'schon' },
      { input: 'Grüße', expected: 'grusse' },
      { input: 'Gruesse', expected: 'grusse' },
      { input: 'Straße', expected: 'strasse' },
      { input: 'über', expected: 'uber' },
      { input: 'ueber', expected: 'uber' },

      // Spanish and other Latin diacritics
      { input: 'José', expected: 'jose' },
      { input: 'niño', expected: 'nino' },
      { input: 'café', expected: 'cafe' },
      { input: 'façade', expected: 'facade' },
      { input: 'corazón', expected: 'corazon' },
      { input: 'español', expected: 'espanol' },

      // Mixed content
      { input: 'Müller café', expected: 'mullercafe' },

      // Edge cases
      { input: '', expected: '' },
      { input: '   ', expected: '' },
    ];

    testCases.forEach(({ input, expected }) => {
      it(`should normalize "${input}" to "${expected}"`, () => {
        expect(normalizeForComparison(input)).toBe(expected);
      });
    });
  });

  describe('2. Display Formatting (`formatForDisplay`)', () => {
    const testCases = [
      // Basic pipe alternatives - show first
      { input: 'hello|hi|hey', expected: 'hello' },
      { input: 'привет|здравствуй', expected: 'привет' },

      // Preserve brackets, commas, and regular parentheses
      { input: 'word[s]', expected: 'word[s]' },
      { input: 'red, blue', expected: 'red, blue' },
      { input: 'word (context)', expected: 'word (context)' },

      // Parentheses with pipes - key feature from the review
      { input: '(a|b), (c|d)', expected: 'a, c' },
      { input: '(трудный|сложный), (твёрдый|жёсткий)', expected: 'трудный, твёрдый' },
      { input: '(менять|изменять), (изменение|смена)', expected: 'менять, изменение' },
      { input: '(матч|соревнование), спичка, (подходить|соответствовать)', expected: 'матч, спичка, подходить' },
      { input: '(значить|означать), иметь в виду', expected: 'значить, иметь в виду' },
      { input: '(двигать|перемещать), переезжать, движение', expected: 'двигать, переезжать, движение' },
      { input: '(записка|заметка), нота [музыка], замечать', expected: 'записка, нота [музыка], замечать' },
      { input: '(a|b)', expected: 'a' },

      // Mixed content
      { input: '(a|b), word, [clarification], (x|y)', expected: 'a, word, [clarification], x' },

      // Parentheses without pipes should be preserved
      { input: 'word (context), another', expected: 'word (context), another' },
      { input: '(a|b), (context), (x|y|z)', expected: 'a, (context), x' },

      // Multiple parentheses groups in succession
      { input: '(a|b)(c|d)(e|f)', expected: 'ace' },

      // Whitespace handling
      { input: '  ( a | b ) ,  (c|d)  ', expected: 'a, c' },
      { input: '(option1 | option2 | option3)', expected: 'option1' },
      { input: '( space1 | space2 )', expected: 'space1' },
      { input: 'hello | hi | hey', expected: 'hello' },
      { input: 'hello\t|\thi', expected: 'hello' },
      { input: '(a  |  b), (c|d)', expected: 'a, c' },

      // Comma cleanup
      { input: ' , word, ', expected: 'word' },
      { input: ', , word, ,', expected: 'word' },

      // Edge cases
      { input: '()', expected: '' },
      { input: 'word, ()', expected: 'word' },
      { input: '(|a)', expected: 'a' },
      { input: '(a|)', expected: 'a' },
      { input: '((()))', expected: '' },

      // Pipes inside brackets are preserved
      { input: 'pipes[inside|brackets]', expected: 'pipes[inside|brackets]' },
      { input: 'prefix[opt1|opt2]suffix', expected: 'prefix[opt1|opt2]suffix' },

      // Documentation examples
      { input: 'банк, скамейка', expected: 'банк, скамейка' },
      { input: 'bonito|hermoso|lindo', expected: 'bonito' },
      { input: 'мир [гармония]', expected: 'мир [гармония]' },
      { input: 'этаж (здания)', expected: 'этаж (здания)' },
      { input: 'машина|автомобиль', expected: 'машина' },

      // Malformed input gracefully handled
      { input: 'word[incomplete', expected: 'word[incomplete' },
      { input: 'incomplete]word', expected: 'incomplete]word' },
      { input: 'word(incomplete', expected: 'word(incomplete' },
      { input: 'incomplete)word', expected: 'incomplete)word' },
      { input: 'word||another', expected: 'word' },
      { input: '||word', expected: '' },
      { input: 'word||', expected: 'word' },
      { input: '|||', expected: '' },

      // Unicode and special characters
      { input: 'café|naïve', expected: 'café' },
      { input: '😀|😃', expected: '😀' },
      { input: 'English|Русский', expected: 'English' },
      { input: '(option1|вариант2)', expected: 'option1' },
      { input: 'word\u00A0|other', expected: 'word' }, // Non-breaking space
    ];

    testCases.forEach(({ input, expected }) => {
      it(`should format "${input}" for display as "${expected}"`, () => {
        expect(formatForDisplay(input)).toBe(expected);
      });
    });
  });

  describe('3. Answer Checking (`checkAnswer`)', () => {
    // Define components to dynamically build complex test cases
    const components = {
      c1: {
        def: 'run|jog',
        valid: ['run', 'jog'],
        invalid: ['walk', 'sprint'],
      },
      c2: {
        def: 'fast|quick',
        valid: ['fast', 'quick'],
        invalid: ['slow', 'rapid'],
      },
      c3: {
        def: 'car[s]',
        valid: ['car', 'cars', 'car s'],
        invalid: ['s', 'vehicle'],
      },
      c4: {
        def: 'парковать[ся]',
        valid: ['парковать', 'парковаться', 'парковать ся'],
        invalid: ['ся', 'стоять'],
      },
      c5: {
        def: 'мир [вселенная]',
        valid: ['мир', 'мир вселенная', 'мирвселенная'],
        invalid: ['вселенная', 'космос'],
      },
      c6: {
        def: 'test[ing]',
        valid: ['test', 'testing', 'test ing'],
        invalid: ['ing', 'exam'],
      },
    };

    describe('3.1 Single Group Validation', () => {
      // Test each component individually
      for (const key in components) {
        const { def, valid, invalid } = components[key as keyof typeof components];
        describe(`Component "${def}"`, () => {
          valid.forEach((answer) => {
            it(`should accept "${answer}"`, () => {
              expect(checkAnswer(answer, def)).toBe(true);
            });
          });
          invalid.forEach((answer) => {
            it(`should reject "${answer}"`, () => {
              expect(checkAnswer(answer, def)).toBe(false);
            });
          });
        });
      }

      // Additional single group tests
      const singleGroupTests = [
        { user: 'hello', correct: 'hello', expected: true },
        { user: 'Hello', correct: 'hello', expected: true },
        { user: 'hello', correct: 'world', expected: false },
        { user: 'hello', correct: 'hello|hi|hey', expected: true },
        { user: 'hi', correct: 'hello|hi|hey', expected: true },
        { user: 'greetings', correct: 'hello|hi|hey', expected: false },
        { user: 'good morning', correct: 'good [morning]', expected: true },
        { user: 'good', correct: 'good [morning]', expected: true },
        { user: 'morning', correct: 'good [morning]', expected: false },
      ];

      singleGroupTests.forEach(({ user, correct, expected }) => {
        it(`should return ${expected} for "${user}" vs "${correct}"`, () => {
          expect(checkAnswer(user, correct)).toBe(expected);
        });
      });
    });

    describe('3.2 Multi-Group (Comma) Validation', () => {
      const group1 = components.c1; // run|jog
      const group2 = components.c2; // fast|quick
      const group3 = components.c4; // парковать[ся]
      const correctAnswer = `(${group1.def}), (${group2.def}), ${group3.def}`;

      // Generate all possible valid answer combinations
      const validAnswers: string[][] = [];
      for (const v1 of group1.valid) {
        for (const v2 of group2.valid) {
          for (const v3 of group3.valid) {
            validAnswers.push([v1, v2, v3]);
          }
        }
      }

      // Test a sample of permutations (not all to keep test time reasonable)
      validAnswers.slice(0, 3).forEach((answerTuple) => {
        getPermutations(answerTuple).forEach((perm) => {
          const userAnswer = perm.join(', ');
          it(`should accept correct combination: "${userAnswer}"`, () => {
            expect(checkAnswer(userAnswer, correctAnswer)).toBe(true);
          });
        });
      });

      // Test invalid combinations
      const invalidScenarios = [
        { answer: 'run, fast', reason: 'missing a part' },
        { answer: 'run', reason: 'missing parts' },
        { answer: 'run, fast, парковать, extra', reason: 'too many parts' },
        { answer: 'run, slow, парковать', reason: 'incorrect part' },
        { answer: 'walk, fast, парковать', reason: 'incorrect part' },
      ];

      invalidScenarios.forEach(({ answer, reason }) => {
        it(`should reject "${answer}" (${reason})`, () => {
          expect(checkAnswer(answer, correctAnswer)).toBe(false);
        });
      });
    });

    describe('3.3 Normalization Integration', () => {
      const testCases = [
        // Cyrillic ё/е equivalence
        { user: 'тёмный', correct: 'темный', expected: true },
        { user: 'темный', correct: 'тёмный', expected: true },
        { user: 'ТЁМНЫЙ', correct: 'темный', expected: true },
        { user: 'тёмный', correct: 'темный|чёрный', expected: true },
        { user: 'чёрный', correct: 'темный|черный', expected: true },
        { user: 'тёмный, чёрный', correct: 'темный, черный', expected: true },
        { user: 'черный, тёмный', correct: 'темный, чёрный', expected: true },

        // Latin/Cyrillic character mapping
        { user: 'cop', correct: 'сор', expected: true },
        { user: 'сор', correct: 'cop', expected: true },
        { user: 'COP', correct: 'сор', expected: true },
        { user: 'cop', correct: 'сор|мусор', expected: true },
        { user: 'мусор', correct: 'cop|мусор', expected: true },
        { user: 'cop, мусор', correct: 'сор, мусор', expected: true },

        // Spanish accent normalization
        { user: 'cafe', correct: 'café', expected: true },
        { user: 'café', correct: 'cafe', expected: true },
        { user: 'nino', correct: 'niño', expected: true },
        { user: 'niño', correct: 'nino', expected: true },
        { user: 'corazon', correct: 'corazón', expected: true },
        { user: 'espanol', correct: 'español', expected: true },
        { user: 'cafe', correct: 'café|coffee', expected: true },
        { user: 'coffee', correct: 'café|coffee', expected: true },
        { user: 'café', correct: 'cafe|coffee', expected: true },
        { user: 'cafe, nino', correct: 'café, niño', expected: true },
        { user: 'café, niño', correct: 'cafe, nino', expected: true },
        { user: 'MÉXICO', correct: 'mexico', expected: true },
        { user: 'educación', correct: 'EDUCACION', expected: true },

        // German umlaut normalization
        { user: 'mude', correct: 'müde', expected: true },
        { user: 'müde', correct: 'mude', expected: true },
        { user: 'uber', correct: 'über', expected: true },
        { user: 'über', correct: 'uber', expected: true },
        { user: 'schon', correct: 'schön', expected: true },
        { user: 'grosse', correct: 'größe', expected: true },
        { user: 'muede', correct: 'müde', expected: true },
        { user: 'müde', correct: 'muede', expected: true },
        { user: 'ueber', correct: 'über', expected: true },
        { user: 'über', correct: 'ueber', expected: true },
        { user: 'schoen', correct: 'schön', expected: true },
        { user: 'schön', correct: 'schoen', expected: true },
        { user: 'groesse', correct: 'größe', expected: true },
        { user: 'größe', correct: 'groesse', expected: true },
        { user: 'mude', correct: 'müde|tired', expected: true },
        { user: 'tired', correct: 'müde|tired', expected: true },
        { user: 'müde', correct: 'mude|tired', expected: true },
        { user: 'mude, schon', correct: 'müde, schön', expected: true },
        { user: 'müde, schön', correct: 'mude, schon', expected: true },
        { user: 'strasse', correct: 'straße', expected: true },
        { user: 'straße', correct: 'strasse', expected: true },
        { user: 'weiss', correct: 'weiß', expected: true },
        { user: 'weiß', correct: 'weiss', expected: true },

        // Complex normalization with multiple features
        { user: 'Müde, café, тёмный', correct: 'muede, cafe, темный', expected: true },
        { user: 'MÜDE, CAFÉ, ТЁМНЫЙ', correct: 'mude, cafe, темный', expected: true },
      ];

      testCases.forEach(({ user, correct, expected }) => {
        it(`should ${expected ? 'accept' : 'reject'} "${user}" vs "${correct}"`, () => {
          expect(checkAnswer(user, correct)).toBe(expected);
        });
      });
    });

    describe('3.4 Documentation Examples', () => {
      const examples = [
        // Comma separation - multiple distinct meanings
        { user: 'этаж, квартира', correct: 'этаж, квартира', expected: true },
        { user: 'квартира, этаж', correct: 'этаж, квартира', expected: true },
        { user: 'этаж', correct: 'этаж, квартира', expected: false },
        { user: 'квартира', correct: 'этаж, квартира', expected: false },
        { user: 'письмо, карта, меню', correct: 'письмо, карта, меню', expected: true },
        { user: 'меню, письмо, карта', correct: 'письмо, карта, меню', expected: true },
        { user: 'письмо', correct: 'письмо, карта, меню', expected: false },
        { user: 'письмо, карта', correct: 'письмо, карта, меню', expected: false },

        // Pipe separation - synonyms/alternatives
        { user: 'спасибо', correct: 'спасибо|благодарю', expected: true },
        { user: 'благодарю', correct: 'спасибо|благодарю', expected: true },
        { user: 'пожалуйста', correct: 'спасибо|благодарю', expected: false },
        { user: 'машина', correct: 'машина|автомобиль', expected: true },
        { user: 'автомобиль', correct: 'машина|автомобиль', expected: true },
        { user: 'машина, автомобиль', correct: 'машина|автомобиль', expected: false },

        // Parentheses grouping - multiple meanings with alternatives
        { user: 'равный, сейчас', correct: '(равный|одинаковый), (сейчас|сразу)', expected: true },
        { user: 'одинаковый, сразу', correct: '(равный|одинаковый), (сейчас|сразу)', expected: true },
        { user: 'равный, сразу', correct: '(равный|одинаковый), (сейчас|сразу)', expected: true },
        { user: 'одинаковый, сейчас', correct: '(равный|одинаковый), (сейчас|сразу)', expected: true },
        { user: 'сейчас, равный', correct: '(равный|одинаковый), (сейчас|сразу)', expected: true },
        { user: 'равный', correct: '(равный|одинаковый), (сейчас|сразу)', expected: false },
        { user: 'сейчас', correct: '(равный|одинаковый), (сейчас|сразу)', expected: false },
        { user: 'равный, одинаковый, сейчас', correct: '(равный|одинаковый), (сейчас|сразу)', expected: false },

        // Square brackets - optional clarifications
        { user: 'мир', correct: 'мир [вселенная]', expected: true },
        { user: 'мир вселенная', correct: 'мир [вселенная]', expected: true },
        { user: 'мирвселенная', correct: 'мир [вселенная]', expected: true },
        { user: 'вселенная', correct: 'мир [вселенная]', expected: false },
        { user: 'мир, вселенная', correct: 'мир [вселенная]', expected: false },
        { user: 'этаж', correct: 'этаж [здания]', expected: true },
        { user: 'этаж здания', correct: 'этаж [здания]', expected: true },
        { user: 'здания', correct: 'этаж [здания]', expected: false },

        // Mixed patterns
        { user: 'hello', correct: 'hello|hey|hi there|greetings', expected: true },
        { user: 'hey', correct: 'hello|hey|hi there|greetings', expected: true },
        { user: 'hi there', correct: 'hello|hey|hi there|greetings', expected: true },
        { user: 'greetings', correct: 'hello|hey|hi there|greetings', expected: true },
        { user: 'hello, greetings', correct: 'hello|hey|hi there|greetings', expected: false },
        { user: 'wrong', correct: 'hello|hey|hi there|greetings', expected: false },
      ];

      examples.forEach(({ user, correct, expected }) => {
        it(`should return ${expected} for user answer "${user}" and correct answer "${correct}"`, () => {
          expect(checkAnswer(user, correct)).toBe(expected);
        });
      });
    });

    describe('3.5 Edge Cases', () => {
      const edgeCases = [
        // Empty answers
        { user: '', correct: '', expected: true },
        { user: 'word', correct: '', expected: false },
        { user: '', correct: 'word', expected: false },

        // Whitespace handling
        { user: '  hello  ', correct: 'hello', expected: true },
        { user: 'hello', correct: '  hello  ', expected: true },
        { user: '  hello,  world  ', correct: 'hello, world', expected: true },

        // Case sensitivity
        { user: 'HELLO', correct: 'hello', expected: true },
        { user: 'Hello', correct: 'HELLO', expected: true },

        // Complex whitespace in comma-separated
        { user: 'word1 , word2 , word3', correct: 'word1, word2, word3', expected: true },

        // Malformed patterns gracefully handled
        { user: 'test', correct: 'test[incomplete', expected: false },
        { user: 'test', correct: 'incomplete]test', expected: false },
      ];

      edgeCases.forEach(({ user, correct, expected }) => {
        it(`should return ${expected} for edge case "${user}" vs "${correct}"`, () => {
          expect(checkAnswer(user, correct)).toBe(expected);
        });
      });
    });
  });

  describe('4. Bug Fixes - Issues from Screenshots', () => {
    const bugFixTests = [
      // Single word translations that were incorrectly rejected
      {
        description: 'Simple Spanish-Russian translation (broma → шутка)',
        user: 'шутка',
        correct: 'шутка',
        expected: true,
      },
      {
        description: 'Simple hearing verb (oír → слышать)',
        user: 'слышать',
        correct: 'слышать',
        expected: true,
      },
      {
        description: 'Hearing verb with alternatives',
        user: 'слышать',
        correct: 'слышать|услышать',
        expected: true,
      },

      // Complex phrase handling (simplified cases)
      {
        description: 'Simple phrase with alternatives',
        user: 'выполнять',
        correct: '(выполнять|исполнять)',
        expected: true,
      },
      {
        description: 'Complex phrase without optional part',
        user: 'выполнять',
        correct: 'выполнять [обещание или долг]',
        expected: true,
      },

      // Age-related expressions with complex patterns
      {
        description: 'Age expression with complex pattern',
        user: 'исполняться',
        correct: '(выполнять|исполнять), исполняться [о возрасте]',
        expected: false, // Should require both parts
      },
      {
        description: 'Complete age expression',
        user: 'выполнять, исполняться',
        correct: '(выполнять|исполнять), исполняться [о возрасте]',
        expected: true,
      },
      {
        description: 'Age expression with alternative',
        user: 'исполнять, исполняться',
        correct: '(выполнять|исполнять), исполняться [о возрасте]',
        expected: true,
      },

      // Verb forms and conjugations
      {
        description: 'Infinitive vs past tense forms',
        user: 'сделал',
        correct: 'делать',
        expected: false, // Different verb forms should not match
      },
      {
        description: 'Verb with multiple forms',
        user: 'сделал',
        correct: 'делать|сделать|сделал',
        expected: true,
      },

      // Preposition and directional issues
      {
        description: 'Preposition "above" vs verb "did"',
        user: 'наверху',
        correct: 'encima',
        expected: false, // Wrong translation
      },
      {
        description: 'Above/over translation',
        user: 'наверху',
        correct: 'наверху|выше|сверху',
        expected: true,
      },

      // Excitement and emotion verbs
      {
        description: 'Excitement verb alternatives',
        user: 'возбуждать',
        correct: 'excitar',
        expected: false, // Needs proper translation
      },
      {
        description: 'Proper excitement translation',
        user: 'возбуждать',
        correct: 'возбуждать|взволновать',
        expected: true,
      },

      // Together/joint expressions
      {
        description: 'Together expression',
        user: 'вместе',
        correct: 'junto',
        expected: false, // Wrong translation
      },
      {
        description: 'Proper together translation',
        user: 'вместе',
        correct: 'вместе|совместно',
        expected: true,
      },

      // Complex reflexive verbs
      {
        description: 'Return reflexive verb',
        user: 'возвращаться',
        correct: 'вернуться',
        expected: false, // Different aspects
      },
      {
        description: 'Return verb with aspects',
        user: 'возвращаться',
        correct: 'возвращаться|вернуться',
        expected: true,
      },

      // Case sensitivity in proper names and verbs
      {
        description: 'Capitalization in verb forms',
        user: 'regresar',
        correct: 'Regresar',
        expected: true, // Should be case insensitive
      },
    ];

    bugFixTests.forEach(({ description, user, correct, expected }) => {
      it(`${description}: "${user}" vs "${correct}" should be ${expected}`, () => {
        expect(checkAnswer(user, correct)).toBe(expected);
      });
    });
  });

  describe('5. Display Format Bug Fixes', () => {
    const displayBugTests = [
      // Complex pattern simplification for display
      {
        description: 'Complex age pattern should be simplified',
        input: '(выполнять|исполнять), исполняться [о возрасте]',
        expected: 'выполнять, исполняться [о возрасте]',
      },
      {
        description: 'Multiple parentheses groups with brackets',
        input: '(делать|совершать), (действие|поступок) [в отношении чего-то]',
        expected: 'делать, действие [в отношении чего-то]',
      },
      {
        description: 'Complex verb pattern with context',
        input: '(слышать|услышать), воспринимать [звук]',
        expected: 'слышать, воспринимать [звук]',
      },
      {
        description: 'Nested alternatives with clarification',
        input: '(выполнять|исполнять) (обещание|долг|обязательство)',
        expected: 'выполнять обещание',
      },
    ];

    displayBugTests.forEach(({ description, input, expected }) => {
      it(`${description}: "${input}" should display as "${expected}"`, () => {
        expect(formatForDisplay(input)).toBe(expected);
      });
    });
  });

  describe('6. Integration Tests - Complex Real-World Scenarios', () => {
    const realWorldTests = [
      {
        description: 'German verb with multiple meanings',
        user: 'machen, tun',
        correct: '(machen|tun), (erstellen|schaffen)',
        expected: false, // Missing second group
      },
      {
        description: 'German verb with complete answer',
        user: 'machen, erstellen',
        correct: '(machen|tun), (erstellen|schaffen)',
        expected: true,
      },
      {
        description: 'Spanish with accents and multiple meanings',
        user: 'corazón, alma',
        correct: 'corazon, alma',
        expected: true,
      },
      {
        description: 'Russian with ё/е and brackets',
        user: 'тёмный человек',
        correct: 'темный [человек]',
        expected: true,
      },
      {
        description: 'Complex mixed language pattern',
        user: 'café, мир, schön',
        correct: 'cafe, мир [вселенная], schoen',
        expected: true,
      },
      {
        description: 'Verb with reflexive suffix',
        user: 'парковаться',
        correct: 'парковать[ся]',
        expected: true,
      },
      {
        description: 'Multiple alternatives with normalization',
        user: 'mude',
        correct: 'müde|tired|erschöpft',
        expected: true,
      },
    ];

    realWorldTests.forEach(({ description, user, correct, expected }) => {
      it(`${description}: "${user}" vs "${correct}" should be ${expected}`, () => {
        expect(checkAnswer(user, correct)).toBe(expected);
      });
    });
  });
});
