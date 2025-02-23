import { errorHandler } from './utils/errorHandler.js';

// Constants for word statuses
export const STATUS = {
  LEVEL_1: 'LEVEL_1',
  LEVEL_2: 'LEVEL_2',
  LEVEL_3: 'LEVEL_3',
  LEVEL_0: 'LEVEL_0',
};

// Constants for quiz directions
export const DIRECTION = {
  NORMAL: true,
  REVERSE: false,
};

// Magic number constants
export const MAX_FOCUS_WORDS = 20;
export const MAX_LAST_ASKED_WORDS = 7;
export const TOP_WORDS_LIMIT = 10;
export const CORRECT_ANSWERS_TO_MASTER = 3;
export const MAX_MISTAKES_BEFORE_DEGRADATION = 3;
export const MILLISECONDS_IN_SECOND = 1000;

export class App {
  quizTranslations = new Map();

  wordStatusSets = {
    [STATUS.LEVEL_1]: new Set(),
    [STATUS.LEVEL_2]: new Set(),
    [STATUS.LEVEL_3]: new Set(),
    [STATUS.LEVEL_0]: new Set(),
  };

  currentTranslationId = null;

  sourceLanguage = '';

  targetLanguage = '';

  direction = DIRECTION.NORMAL;

  lastAskedWords = [];

  consecutiveMistakes = new Map();

  stats = {
    totalAttempts: 0,
    correctAnswers: 0,
    incorrectAnswers: 0,
    attemptsPerTranslationIdAndDirection: {},
    incorrectPerTranslationIdAndDirection: {},
    timePerTranslationIdAndDirection: {},
    timePerQuestion: [],
  };

  constructor(data) {
    this.initializeData(data);
    this.populateFocusWords();
  }

  initializeData(data) {
    if (!Array.isArray(data) || data.length < 1) {
      throw new Error('Invalid or insufficient data provided.');
    }

    this.sourceLanguage = data[0].sourceLanguage;
    this.targetLanguage = data[0].targetLanguage;

    data.forEach((entry) => {
      if (typeof entry !== 'object' || !entry.wordPairId) {
        console.warn('Invalid word entry:', entry);
        return;
      }

      const { wordPairId } = entry;
      const status = entry.status || STATUS.LEVEL_0;

      this.quizTranslations.set(wordPairId, { ...entry, status });
      this.moveWordToStatus(wordPairId, status);
    });

    if (this.quizTranslations.size === 0) {
      throw new Error('No valid entries added to quizTranslations');
    }
  }

  moveWordToStatus(wordPairId, newStatus) {
    Object.values(STATUS).forEach((status) => {
      this.wordStatusSets[status].delete(wordPairId);
    });

    if (this.wordStatusSets[newStatus]) {
      this.wordStatusSets[newStatus].add(wordPairId);
    } else {
      console.warn(
        `Unknown status '${newStatus}' for wordPairId '${wordPairId}'. Defaulting to 'LEVEL_0'.`
      );
      this.wordStatusSets[STATUS.LEVEL_0].add(wordPairId);
      // eslint-disable-next-line no-param-reassign
      newStatus = STATUS.LEVEL_0;
    }

    const wordPair = this.quizTranslations.get(wordPairId);
    if (wordPair) {
      wordPair.status = newStatus;
    } else {
      console.error(`Word ${wordPairId} not found in quizTranslations!`);
    }
  }

  populateFocusWords() {
    const focusSet = this.wordStatusSets[STATUS.LEVEL_1];
    const upcomingSet = this.wordStatusSets[STATUS.LEVEL_0];
    const spacesAvailable = MAX_FOCUS_WORDS - focusSet.size;

    if (spacesAvailable > 0 && upcomingSet.size > 0) {
      const upcomingArray = Array.from(upcomingSet);
      const wordsToMove = Math.min(spacesAvailable, upcomingSet.size);
      for (let i = 0; i < wordsToMove; i += 1) {
        const randomIndex = Math.floor(Math.random() * upcomingArray.length);
        const selectedWordId = upcomingArray[randomIndex];
        this.moveWordToStatus(selectedWordId, STATUS.LEVEL_1);
        upcomingArray.splice(randomIndex, 1);
      }
    }
  }

  toggleDirection() {
    const hasMasteredOneDirection = this.wordStatusSets[STATUS.LEVEL_2].size > 0;

    if (!hasMasteredOneDirection) {
      this.direction = DIRECTION.NORMAL;
    } else {
      this.direction = !this.direction;
    }

    return this.direction === DIRECTION.NORMAL ? 'Normal' : 'Reverse';
  }

  getNextQuestion() {
    if (this.direction === DIRECTION.REVERSE && this.wordStatusSets[STATUS.LEVEL_2].size === 0) {
      this.direction = DIRECTION.NORMAL;
    }

    const currentSet =
      this.direction === DIRECTION.NORMAL
        ? this.wordStatusSets[STATUS.LEVEL_1]
        : this.wordStatusSets[STATUS.LEVEL_2];

    if (currentSet.size === 0) {
      return null; // No words available in the current set
    }

    const nextTranslationId = this.selectNextTranslationId(currentSet);
    this.currentTranslationId = nextTranslationId;

    const translation = this.quizTranslations.get(nextTranslationId);
    this.updateLastAskedWords(nextTranslationId);

    return {
      word: this.direction === DIRECTION.NORMAL ? translation.sourceWord : translation.targetWord,
      translationId: nextTranslationId,
    };
  }

  selectNextTranslationId(wordSet) {
    const incorrectCounts = this.aggregateIncorrectCounts();
    const sortedWords = Array.from(wordSet).sort(
      (a, b) => (incorrectCounts[a] || 0) - (incorrectCounts[b] || 0)
    );

    const topFewWords = sortedWords.slice(0, TOP_WORDS_LIMIT);
    const availableWords = topFewWords.filter((wordId) => !this.lastAskedWords.includes(wordId));

    const selectionPool = availableWords.length > 0 ? availableWords : topFewWords;
    const randomIndex = Math.floor(Math.random() * selectionPool.length);

    return selectionPool[randomIndex];
  }

  aggregateIncorrectCounts() {
    const counts = {};
    // eslint-disable-next-line no-restricted-syntax
    for (const [key, value] of Object.entries(this.stats.incorrectPerTranslationIdAndDirection)) {
      const [translationId] = key.split('-');
      counts[translationId] = (counts[translationId] || 0) + value;
    }
    return counts;
  }

  updateLastAskedWords(wordId) {
    this.lastAskedWords.push(wordId);
    if (this.lastAskedWords.length > MAX_LAST_ASKED_WORDS) {
      this.lastAskedWords.shift();
    }
  }

  // eslint-disable-next-line class-methods-use-this
  getMistakesKey(wordId, direction) {
    return `${wordId}-${direction ? 'normal' : 'reverse'}`;
  }

  resetMistakesCounter(wordId, direction) {
    const key = this.getMistakesKey(wordId, direction);
    this.consecutiveMistakes.set(key, 0);
  }

  incrementMistakesCounter(wordId, direction) {
    const key = this.getMistakesKey(wordId, direction);
    const currentMistakes = this.consecutiveMistakes.get(key) || 0;
    const newMistakes = currentMistakes + 1;
    this.consecutiveMistakes.set(key, newMistakes);

    return newMistakes;
  }

  degradeWordLevel(wordId) {
    const word = this.quizTranslations.get(wordId);
    if (!word) {
      console.error(`Word ${wordId} not found in quizTranslations!`);
      return false;
    }

    if (word.status === STATUS.LEVEL_0) {
      console.warn(`Word ${wordId} is already at LEVEL_0`);
      return false;
    }

    const levelMapping = {
      [STATUS.LEVEL_3]: STATUS.LEVEL_2,
      [STATUS.LEVEL_2]: STATUS.LEVEL_1,
      [STATUS.LEVEL_1]: STATUS.LEVEL_0,
    };

    const newLevel = levelMapping[word.status];

    if (newLevel) {
      this.moveWordToStatus(wordId, newLevel);
      word.status = newLevel;
      this.populateFocusWords();

      const mistakesKey = this.getMistakesKey(wordId, this.direction);
      this.consecutiveMistakes.set(mistakesKey, 0);
      return true;
    }

    return false;
  }

  async submitAnswer(userAnswer, shouldGetNextQuestion = true) {
    try {
      const startTime = Date.now();
      const isCorrect = this.verifyAnswer(userAnswer);

      this.updateStats(isCorrect, startTime);

      if (isCorrect) {
        this.resetMistakesCounter(this.currentTranslationId, this.direction);
        this.handleCorrectAnswer();
      } else {
        const mistakes = this.incrementMistakesCounter(this.currentTranslationId, this.direction);
        if (mistakes >= MAX_MISTAKES_BEFORE_DEGRADATION) {
          const wasWordDegraded = this.degradeWordLevel(this.currentTranslationId);
          if (wasWordDegraded) {
            this.resetMistakesCounter(this.currentTranslationId, this.direction);
          }
        }
      }

      const feedback = this.generateFeedback(isCorrect);
      const usageExamples = this.getUsageExamples();
      let questionData = null;

      if (shouldGetNextQuestion) {
        questionData = this.getNextQuestion();
      }

      return { feedback, usageExamples, questionData };
    } catch (error) {
      console.error('Error submitting answer:', error);
      return {
        feedback: { message: 'An error occurred. Please try again.', isSuccess: false },
        usageExamples: { source: 'N/A', target: 'N/A' },
        questionData: null,
      };
    }
  }

  verifyAnswer(userAnswer) {
    const translation = this.quizTranslations.get(this.currentTranslationId);
    if (!translation) {
      throw new Error(`Translation not found for ID ${this.currentTranslationId}`);
    }
    const correctAnswer =
      this.direction === DIRECTION.NORMAL ? translation.targetWord : translation.sourceWord;
    return this.compareAnswers(userAnswer, correctAnswer);
  }

  // eslint-disable-next-line class-methods-use-this
  compareAnswers(userAnswer, correctAnswer) {
    const normalize = (answer) => {
      if (!answer) return '';
      return answer
        .toLowerCase()
        .normalize('NFD')
        .replace(/\p{M}/gu, '') // Remove diacritical marks
        .replace(/[^\p{Letter}]/gu, '') // Keep only letters
        .trim();
    };

    return normalize(userAnswer) === normalize(correctAnswer);
  }

  updateStats(isCorrect, startTime) {
    const timeSpentOnAnswer = (Date.now() - startTime) / MILLISECONDS_IN_SECOND;
    this.stats.totalAttempts += 1;
    this.stats.timePerQuestion.push(timeSpentOnAnswer);

    const translationDirection = this.direction === DIRECTION.NORMAL ? 'normal' : 'reverse';
    const wordDirectionKey = `${this.currentTranslationId}-${translationDirection}`;

    if (!this.stats.attemptsPerTranslationIdAndDirection[wordDirectionKey]) {
      this.stats.attemptsPerTranslationIdAndDirection[wordDirectionKey] = {
        attempts: 0,
        correct: 0,
        incorrect: 0,
      };
      this.stats.timePerTranslationIdAndDirection[wordDirectionKey] = [];
    }

    const wordStats = this.stats.attemptsPerTranslationIdAndDirection[wordDirectionKey];
    wordStats.attempts += 1;
    this.stats.timePerTranslationIdAndDirection[wordDirectionKey].push(timeSpentOnAnswer);

    if (isCorrect) {
      this.stats.correctAnswers += 1;
      wordStats.correct += 1;
    } else {
      this.stats.incorrectAnswers += 1;
      wordStats.incorrect += 1;
    }
  }

  handleCorrectAnswer() {
    const sourceToTargetStatsKey = `${this.currentTranslationId}-normal`;
    const targetToSourceStatsKey = `${this.currentTranslationId}-reverse`;

    const correctSourceToTarget =
      this.stats.attemptsPerTranslationIdAndDirection[sourceToTargetStatsKey]?.correct || 0;
    const correctTargetToSource =
      this.stats.attemptsPerTranslationIdAndDirection[targetToSourceStatsKey]?.correct || 0;

    const wordCurrentStatus = this.quizTranslations.get(this.currentTranslationId).status;

    // Upgrade from LEVEL_1 (Learning) to LEVEL_2 (One Way Mastered)
    if (
      wordCurrentStatus === STATUS.LEVEL_1 &&
      correctSourceToTarget >= CORRECT_ANSWERS_TO_MASTER
    ) {
      this.moveWordToStatus(this.currentTranslationId, STATUS.LEVEL_2);
      this.populateFocusWords();
    }

    // Upgrade from LEVEL_2 (One Way Mastered) to LEVEL_3 (Both Ways Mastered)
    if (
      wordCurrentStatus === STATUS.LEVEL_2 &&
      correctTargetToSource >= CORRECT_ANSWERS_TO_MASTER
    ) {
      this.moveWordToStatus(this.currentTranslationId, STATUS.LEVEL_3);
    }
  }

  generateFeedback(isCorrect) {
    const translation = this.quizTranslations.get(this.currentTranslationId);
    if (isCorrect) {
      return { message: 'Correct!', isSuccess: true };
    }
    return {
      message: `Wrong. '${translation.sourceWord}' - '${translation.targetWord}'`,
      isSuccess: false,
    };
  }

  getUsageExamples() {
    const translation = this.quizTranslations.get(this.currentTranslationId);
    return {
      source: translation.sourceWordUsageExample || 'No example available',
      target: translation.targetWordUsageExample || 'No example available',
    };
  }
}

export function createApp(data) {
  try {
    return new App(data);
  } catch (error) {
    console.error('Error creating App instance:', error);
    errorHandler.handleApiError(error);
    throw error;
  }
}
