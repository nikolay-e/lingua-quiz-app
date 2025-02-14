import { errorHandler } from './utils/errorHandler.js';

// Constants for word statuses
export const STATUS = {
  FOCUS: 'level_1',
  MASTERED_ONE_DIRECTION: 'level_2',
  MASTERED_VOCABULARY: 'level_3',
  UPCOMING: 'level_0',
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
export const MILLISECONDS_IN_SECOND = 1000;

export class App {
  quizTranslations = new Map();

  wordStatusSets = {
    [STATUS.FOCUS]: new Set(),
    [STATUS.MASTERED_ONE_DIRECTION]: new Set(),
    [STATUS.MASTERED_VOCABULARY]: new Set(),
    [STATUS.UPCOMING]: new Set(),
  };

  currentTranslationId = null;

  sourceLanguage = '';

  targetLanguage = '';

  direction = DIRECTION.NORMAL;

  lastAskedWords = [];

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
      const status = entry.status || STATUS.UPCOMING;

      this.quizTranslations.set(wordPairId, { ...entry, status });
      this.moveWordToStatus(wordPairId, status);
    });

    if (this.quizTranslations.size === 0) {
      throw new Error('No valid entries added to quizTranslations');
    }
  }

  moveWordToStatus(wordPairId, newStatus) {
    // Remove from all status sets
    Object.values(STATUS).forEach((status) => {
      this.wordStatusSets[status].delete(wordPairId);
    });

    // Add to the new status set
    if (this.wordStatusSets[newStatus]) {
      this.wordStatusSets[newStatus].add(wordPairId);
    } else {
      console.warn(
        // eslint-disable-next-line max-len
        `Unknown status '${newStatus}' for wordPairId '${wordPairId}'. Defaulting to 'LEVEL_0'.`
      );
      this.wordStatusSets[STATUS.UPCOMING].add(wordPairId);
      // eslint-disable-next-line no-param-reassign
      newStatus = STATUS.UPCOMING;
    }

    // Update the status in the word pair
    const wordPair = this.quizTranslations.get(wordPairId);
    if (wordPair) {
      wordPair.status = newStatus;
    }
  }

  populateFocusWords() {
    const focusSet = this.wordStatusSets[STATUS.FOCUS];
    const upcomingSet = this.wordStatusSets[STATUS.UPCOMING];
    const spacesAvailable = MAX_FOCUS_WORDS - focusSet.size;

    if (spacesAvailable > 0 && upcomingSet.size > 0) {
      const upcomingArray = Array.from(upcomingSet);
      const wordsToMove = Math.min(spacesAvailable, upcomingSet.size);
      for (let i = 0; i < wordsToMove; i += 1) {
        const randomIndex = Math.floor(Math.random() * upcomingArray.length);
        const selectedWordId = upcomingArray[randomIndex];
        this.moveWordToStatus(selectedWordId, STATUS.FOCUS);
        upcomingArray.splice(randomIndex, 1);
      }
    }
  }

  toggleDirection() {
    const hasMasteredOneDirection = this.wordStatusSets[STATUS.MASTERED_ONE_DIRECTION].size > 0;

    if (!hasMasteredOneDirection) {
      this.direction = DIRECTION.NORMAL;
    } else {
      this.direction = !this.direction;
    }

    return this.direction === DIRECTION.NORMAL ? 'Normal' : 'Reverse';
  }

  getNextQuestion() {
    if (
      this.direction === DIRECTION.REVERSE &&
      this.wordStatusSets[STATUS.MASTERED_ONE_DIRECTION].size === 0
    ) {
      this.direction = DIRECTION.NORMAL;
    }

    const currentSet =
      this.direction === DIRECTION.NORMAL
        ? this.wordStatusSets[STATUS.FOCUS]
        : this.wordStatusSets[STATUS.MASTERED_ONE_DIRECTION];

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

  async submitAnswer(userAnswer, shouldGetNextQuestion = true) {
    try {
      const startTime = Date.now();
      const isCorrect = this.verifyAnswer(userAnswer);
      this.updateStats(isCorrect, startTime);

      if (isCorrect) {
        this.handleCorrectAnswer();
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
    const endTime = Date.now();
    const timeTaken = (endTime - startTime) / MILLISECONDS_IN_SECOND;
    this.stats.totalAttempts += 1;
    this.stats.timePerQuestion.push(timeTaken);

    const directionKey = this.direction === DIRECTION.NORMAL ? 'normal' : 'reverse';
    const statKey = `${this.currentTranslationId}-${directionKey}`;

    if (!this.stats.attemptsPerTranslationIdAndDirection[statKey]) {
      this.stats.attemptsPerTranslationIdAndDirection[statKey] = {
        attempts: 0,
        correct: 0,
        incorrect: 0,
      };
      this.stats.timePerTranslationIdAndDirection[statKey] = [];
    }

    const translationStats = this.stats.attemptsPerTranslationIdAndDirection[statKey];
    translationStats.attempts += 1;
    this.stats.timePerTranslationIdAndDirection[statKey].push(timeTaken);

    if (isCorrect) {
      this.stats.correctAnswers += 1;
      translationStats.correct += 1;
    } else {
      this.stats.incorrectAnswers += 1;
      translationStats.incorrect += 1;
      this.stats.incorrectPerTranslationIdAndDirection[statKey] =
        (this.stats.incorrectPerTranslationIdAndDirection[statKey] || 0) + 1;
    }
  }

  handleCorrectAnswer() {
    const normalKey = `${this.currentTranslationId}-normal`;
    const reverseKey = `${this.currentTranslationId}-reverse`;

    const normalCorrect = this.stats.attemptsPerTranslationIdAndDirection[normalKey]?.correct || 0;
    const reverseCorrect =
      this.stats.attemptsPerTranslationIdAndDirection[reverseKey]?.correct || 0;

    const currentStatus = this.quizTranslations.get(this.currentTranslationId).status;

    if (currentStatus === STATUS.FOCUS && normalCorrect >= CORRECT_ANSWERS_TO_MASTER) {
      this.moveWordToStatus(this.currentTranslationId, STATUS.MASTERED_ONE_DIRECTION);
      this.populateFocusWords();
    }

    if (
      currentStatus === STATUS.MASTERED_ONE_DIRECTION &&
      reverseCorrect >= CORRECT_ANSWERS_TO_MASTER
    ) {
      this.moveWordToStatus(this.currentTranslationId, STATUS.MASTERED_VOCABULARY);
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
