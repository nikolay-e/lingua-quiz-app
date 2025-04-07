/* eslint-disable class-methods-use-this */
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
      this.addWordToStatusSet(wordPairId, status); // Use helper
    });

    if (this.quizTranslations.size === 0) {
      throw new Error('No valid entries added to quizTranslations');
    }
  }

  // Helper to add word to a set without removing from others (used in init)
  addWordToStatusSet(wordPairId, status) {
    if (this.wordStatusSets[status]) {
      this.wordStatusSets[status].add(wordPairId);
    } else {
      console.warn(`Unknown status '${status}' during init for wordPairId '${wordPairId}'. Defaulting to 'LEVEL_0'.`);
      this.wordStatusSets[STATUS.LEVEL_0].add(wordPairId);
      const wordPair = this.quizTranslations.get(wordPairId);
      if (wordPair) wordPair.status = STATUS.LEVEL_0; // Correct status in map too
    }
  }

  /**
   * Moves a word to a new status set, removing it from others.
   * @param {number} wordPairId - The ID of the word pair.
   * @param {string} newStatus - The target status (e.g., STATUS.LEVEL_1).
   * @returns {boolean} - True if the status was actually changed, false otherwise.
   */
  moveWordToStatus(wordPairId, newStatus) {
    const wordPair = this.quizTranslations.get(wordPairId);
    if (!wordPair) {
      console.error(`Word ${wordPairId} not found in quizTranslations! Cannot move status.`);
      return false;
    }

    const oldStatus = wordPair.status;

    // Ensure the new status is valid, default to LEVEL_0 if not
    if (!this.wordStatusSets[newStatus]) {
      console.warn(`Unknown status '${newStatus}' for wordPairId '${wordPairId}'. Defaulting to 'LEVEL_0'.`);
      // eslint-disable-next-line no-param-reassign
      newStatus = STATUS.LEVEL_0;
    }

    // Only proceed if the status is actually different
    if (oldStatus === newStatus) {
      return false; // No change occurred
    }

    // Remove from all sets first
    Object.values(STATUS).forEach((status) => {
      this.wordStatusSets[status].delete(wordPairId);
    });

    // Add to the new set
    this.wordStatusSets[newStatus].add(wordPairId);

    // Update status in the main map
    wordPair.status = newStatus;

    return true; // Status changed
  }

  populateFocusWords() {
    const focusSet = this.wordStatusSets[STATUS.LEVEL_1];
    const upcomingSet = this.wordStatusSets[STATUS.LEVEL_0];
    const spacesAvailable = MAX_FOCUS_WORDS - focusSet.size;
    let movedCount = 0; // Track how many words were actually moved

    if (spacesAvailable > 0 && upcomingSet.size > 0) {
      const upcomingWords = Array.from(upcomingSet);
      // Simple shuffle - sort is often good enough for pseudo-randomness here
      const shuffled = upcomingWords.sort(() => 0.5 - Math.random());
      const wordsToMove = shuffled.slice(0, spacesAvailable);
      wordsToMove.forEach((wordId) => {
        // moveWordToStatus handles adding/removing and updating the map status
        if (this.moveWordToStatus(wordId, STATUS.LEVEL_1)) {
          movedCount += 1;
        }
      });
    }
    // Return true if any words were actually moved (status changed)
    return movedCount > 0;
  }

  toggleDirection() {
    const canDoReverse = this.wordStatusSets[STATUS.LEVEL_2].size > 0;

    if (this.direction === DIRECTION.NORMAL) {
      if (canDoReverse) {
        this.direction = DIRECTION.REVERSE;
      }
    } else {
      this.direction = DIRECTION.NORMAL;
    }
    return this.direction === DIRECTION.NORMAL ? 'Normal' : 'Reverse';
  }

  getNextQuestion() {
    // If in reverse but no words are ready for it, switch back to normal
    if (this.direction === DIRECTION.REVERSE && this.wordStatusSets[STATUS.LEVEL_2].size === 0) {
      this.direction = DIRECTION.NORMAL;
    }

    // Determine the primary set to draw from based on direction
    const primarySet =
      this.direction === DIRECTION.NORMAL
        ? this.wordStatusSets[STATUS.LEVEL_1] // Normal: Focus on LEVEL_1
        : this.wordStatusSets[STATUS.LEVEL_2]; // Reverse: Focus on LEVEL_2

    // If primary set is empty, try the other set (LEVEL_1 for reverse, LEVEL_2 for normal if allowed)
    let candidateSet = primarySet;
    if (candidateSet.size === 0) {
      if (this.direction === DIRECTION.REVERSE) {
        // If reverse is empty, fall back to LEVEL_1 (which would be normal direction practice)
        candidateSet = this.wordStatusSets[STATUS.LEVEL_1];
      }
      // No explicit fallback from NORMAL to LEVEL_2 needed here, as LEVEL_2 implies reverse practice readiness.
    }

    if (candidateSet.size === 0) {
      // Before returning null, check if maybe *all* words are mastered
      if (this.wordStatusSets[STATUS.LEVEL_3].size === this.quizTranslations.size) {
        return null; // Truly finished
      }
      // Or maybe some words are only in LEVEL_0?
      if (this.wordStatusSets[STATUS.LEVEL_0].size > 0 && this.wordStatusSets[STATUS.LEVEL_1].size === 0) {
        this.populateFocusWords();
        // Retry getting a question immediately after populating
        return this.getNextQuestion();
      }

      return null; // No words available
    }

    const nextTranslationId = this.selectNextTranslationId(candidateSet);
    this.currentTranslationId = nextTranslationId;

    const translation = this.quizTranslations.get(nextTranslationId);
    if (!translation) {
      console.error(`Selected translation ID ${nextTranslationId} not found in map!`);
      // Attempt to recover by getting another question
      return this.getNextQuestion();
    }
    this.updateLastAskedWords(nextTranslationId);

    // Determine the question word based on the *actual* status and *intended* direction
    let questionWord;
    // If we fell back from REVERSE (L2 empty) to NORMAL (L1), use source word
    if (this.direction === DIRECTION.REVERSE && candidateSet === this.wordStatusSets[STATUS.LEVEL_1]) {
      questionWord = translation.sourceWord;
    } else {
      // Otherwise, use the standard direction logic
      questionWord = this.direction === DIRECTION.NORMAL ? translation.sourceWord : translation.targetWord;
    }

    return {
      word: questionWord,
      translationId: nextTranslationId,
    };
  }

  selectNextTranslationId(wordSet) {
    const incorrectCounts = this.aggregateIncorrectCounts();
    // Sort primarily by incorrect count (descending), then perhaps randomly or by ID for ties
    const sortedWords = Array.from(wordSet).sort((a, b) => {
      const countA = incorrectCounts[a] || 0;
      const countB = incorrectCounts[b] || 0;
      if (countB !== countA) {
        return countB - countA; // Higher incorrect count first
      }
      return Math.random() - 0.5; // Randomize ties
    });

    // Prioritize words *not* recently asked from the top (most incorrect) words
    const topFewWords = sortedWords.slice(0, TOP_WORDS_LIMIT);
    const availableWords = topFewWords.filter((wordId) => !this.lastAskedWords.includes(wordId));

    // If all top words were recently asked, fall back to the full top list
    const selectionPool = availableWords.length > 0 ? availableWords : topFewWords;

    // Handle edge case where the entire wordSet is smaller than lastAskedWords capacity
    if (selectionPool.length === 0 && sortedWords.length > 0) {
      // Fall back to any word in the set not recently asked, or just the most incorrect if all were recent
      const lessRecentAvailable = sortedWords.filter((wordId) => !this.lastAskedWords.includes(wordId));
      if (lessRecentAvailable.length > 0) {
        return lessRecentAvailable[0]; // Pick the most incorrect among those not recently asked
      }
      // If *all* words in the set were recently asked, just return the most incorrect one overall
      return sortedWords[0];
    }

    // Select randomly from the prioritized pool
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
    // Remove the word if it already exists, then add to end
    this.lastAskedWords = this.lastAskedWords.filter((id) => id !== wordId);
    this.lastAskedWords.push(wordId);
    // Keep only the last N words
    if (this.lastAskedWords.length > MAX_LAST_ASKED_WORDS) {
      this.lastAskedWords.shift();
    }
  }

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

  /**
   * Degrades a word's level based on mistakes.
   * @param {number} wordId - The ID of the word pair.
   * @returns {boolean} - True if the status was actually changed, false otherwise.
   */
  degradeWordLevel(wordId) {
    const word = this.quizTranslations.get(wordId);
    if (!word) {
      console.error(`Word ${wordId} not found for degradation!`);
      return false;
    }

    const currentLevel = word.status;
    if (currentLevel === STATUS.LEVEL_0) {
      console.warn(`Word ${wordId} is already at LEVEL_0, cannot degrade further.`);
      return false; // Cannot degrade further
    }

    const levelMapping = {
      [STATUS.LEVEL_3]: STATUS.LEVEL_2,
      [STATUS.LEVEL_2]: STATUS.LEVEL_1,
      [STATUS.LEVEL_1]: STATUS.LEVEL_0,
    };

    const newLevel = levelMapping[currentLevel];

    if (newLevel) {
      const statusActuallyChanged = this.moveWordToStatus(wordId, newLevel);
      if (statusActuallyChanged) {
        // Reset mistakes counter for *both* directions upon degradation
        this.resetMistakesCounter(wordId, DIRECTION.NORMAL);
        this.resetMistakesCounter(wordId, DIRECTION.REVERSE);
        return true; // Status changed
      }
    }
    return false; // No change occurred (e.g., already at lowest level)
  }

  /**
   * Processes the user's answer, updates stats and word status.
   * @param {string} userAnswer - The answer provided by the user.
   * @param {boolean} [shouldGetNextQuestion=true] - Whether to fetch the next question.
   * @returns {Promise<object>} - Result object containing feedback, examples, next question data, and statusChanged flag.
   */
  async submitAnswer(userAnswer, shouldGetNextQuestion = true) {
    // *** Initialize statusChanged flag ***
    let statusChanged = false;
    const startTime = Date.now();

    if (this.currentTranslationId === null) {
      console.error('submitAnswer called but currentTranslationId is null.');
      return {
        feedback: { message: 'Error: No current question selected.', isSuccess: false },
        usageExamples: { source: 'N/A', target: 'N/A' },
        questionData: null,
        statusChanged: false, // No change
      };
    }

    try {
      const isCorrect = this.verifyAnswer(userAnswer);

      this.updateStats(isCorrect, startTime);

      if (isCorrect) {
        this.resetMistakesCounter(this.currentTranslationId, this.direction);
        // *** Capture status change from handleCorrectAnswer ***
        const correctCausedChange = this.handleCorrectAnswer();
        statusChanged = correctCausedChange || statusChanged;
      } else {
        const mistakes = this.incrementMistakesCounter(this.currentTranslationId, this.direction);
        if (mistakes >= MAX_MISTAKES_BEFORE_DEGRADATION) {
          // *** Capture status change from degradeWordLevel ***
          const wasWordDegraded = this.degradeWordLevel(this.currentTranslationId);
          statusChanged = wasWordDegraded || statusChanged;
          // No need to reset counter here, degradeWordLevel does it
        }
      }

      // *** Capture status change from populateFocusWords ***
      // Only populate if a word was potentially moved *out* of L0 or L1 (due to degradation/promotion)
      if (statusChanged) {
        const populateCausedChange = this.populateFocusWords();
        // Note: populateFocusWords itself might cause further status changes from L0->L1
        // We consider *any* change within this submitAnswer call as significant
        statusChanged = populateCausedChange || statusChanged;
      }

      const feedback = this.generateFeedback(isCorrect);
      const usageExamples = this.getUsageExamples();
      let questionData = null;

      if (shouldGetNextQuestion) {
        questionData = this.getNextQuestion();
      }

      // *** Return the statusChanged flag ***
      return { feedback, usageExamples, questionData, statusChanged };
    } catch (error) {
      console.error('Error submitting answer:', error);
      errorHandler.handleApiError(error); // Log error centrally
      return {
        feedback: { message: 'An error occurred processing the answer.', isSuccess: false },
        usageExamples: this.getUsageExamples() || { source: 'N/A', target: 'N/A' }, // Try to get examples even on error
        questionData: null,
        statusChanged: false, // Assume no reliable change on error
      };
    }
  }

  verifyAnswer(userAnswer) {
    const translation = this.quizTranslations.get(this.currentTranslationId);
    if (!translation) {
      throw new Error(`Translation not found for ID ${this.currentTranslationId}`);
    }
    const correctAnswer = this.direction === DIRECTION.NORMAL ? translation.targetWord : translation.sourceWord;
    return this.compareAnswers(userAnswer, correctAnswer);
  }

  compareAnswers(userAnswer, correctAnswer) {
    const normalize = (answer) => {
      if (!answer) return '';
      // Improved normalization: lowercase, remove diacritics, remove punctuation/symbols, trim
      return answer
        .toLowerCase()
        .normalize('NFD')
        .replace(/\p{M}/gu, '') // Remove diacritical marks (accents, etc.)
        .replace(/[^\p{L}\p{N}\s]/gu, '') // Remove punctuation/symbols, keep letters, numbers, spaces
        .replace(/\s+/g, ' ') // Collapse multiple spaces
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
    }
    if (!this.stats.incorrectPerTranslationIdAndDirection[wordDirectionKey]) {
      this.stats.incorrectPerTranslationIdAndDirection[wordDirectionKey] = 0; // Initialize incorrect count per direction
    }
    if (!this.stats.timePerTranslationIdAndDirection[wordDirectionKey]) {
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
      this.stats.incorrectPerTranslationIdAndDirection[wordDirectionKey] += 1; // Increment specific incorrect count
    }
  }

  /**
   * Handles logic for correct answers, potentially upgrading word status.
   * @returns {boolean} - True if the word's status was changed, false otherwise.
   */
  handleCorrectAnswer() {
    let statusChanged = false;
    const wordId = this.currentTranslationId;
    const word = this.quizTranslations.get(wordId);
    if (!word) return false; // Should not happen

    const sourceToTargetStatsKey = `${wordId}-normal`;
    const targetToSourceStatsKey = `${wordId}-reverse`;

    const correctSourceToTarget = this.stats.attemptsPerTranslationIdAndDirection[sourceToTargetStatsKey]?.correct || 0;
    const correctTargetToSource = this.stats.attemptsPerTranslationIdAndDirection[targetToSourceStatsKey]?.correct || 0;

    const wordCurrentStatus = word.status;

    // --- Promotion Logic ---

    // Upgrade from LEVEL_1 (Learning) to LEVEL_2 (One Way Mastered - Normal Direction)
    if (
      wordCurrentStatus === STATUS.LEVEL_1 &&
      this.direction === DIRECTION.NORMAL && // Must be correct in Normal direction
      correctSourceToTarget >= CORRECT_ANSWERS_TO_MASTER
    ) {
      statusChanged = this.moveWordToStatus(wordId, STATUS.LEVEL_2) || statusChanged;
    }

    // Upgrade from LEVEL_2 (One Way Mastered) to LEVEL_3 (Both Ways Mastered)
    // This requires having enough correct answers in the *reverse* direction *while* being in LEVEL_2
    if (
      wordCurrentStatus === STATUS.LEVEL_2 &&
      this.direction === DIRECTION.REVERSE && // Must be correct in Reverse direction
      correctTargetToSource >= CORRECT_ANSWERS_TO_MASTER
    ) {
      // Check if NORMAL direction was also mastered previously (implicit in being LEVEL_2)
      if (correctSourceToTarget >= CORRECT_ANSWERS_TO_MASTER) {
        statusChanged = this.moveWordToStatus(wordId, STATUS.LEVEL_3) || statusChanged;
      } else {
        // This case might indicate a logic issue or race condition if L2 is reached without L1 mastery?
        console.warn(`Word ${wordId} in LEVEL_2 but normal direction mastery count (${correctSourceToTarget}) is low.`);
      }
    }

    // Handle potential direct jump from LEVEL_1 to LEVEL_3 if both directions mastered quickly? (Less common)
    if (
      wordCurrentStatus === STATUS.LEVEL_1 &&
      correctSourceToTarget >= CORRECT_ANSWERS_TO_MASTER &&
      correctTargetToSource >= CORRECT_ANSWERS_TO_MASTER
    ) {
      statusChanged = this.moveWordToStatus(wordId, STATUS.LEVEL_3) || statusChanged;
    }

    return statusChanged;
  }

  generateFeedback(isCorrect) {
    const translation = this.quizTranslations.get(this.currentTranslationId);
    if (!translation) {
      // Handle case where translation might be missing (though should be caught earlier)
      return { message: 'Error: Could not retrieve translation details.', isSuccess: false };
    }
    if (isCorrect) {
      return { message: 'Correct!', isSuccess: true };
    }
    // Provide the correct answer pair in feedback for incorrect answers
    return {
      message: `Wrong. The correct pair is: '${translation.sourceWord}' ↔ '${translation.targetWord}'`,
      isSuccess: false,
    };
  }

  getUsageExamples() {
    const translation = this.quizTranslations.get(this.currentTranslationId);
    if (!translation) {
      return { source: 'N/A', target: 'N/A' };
    }
    return {
      source: translation.sourceWordUsageExample || 'No source example available',
      target: translation.targetWordUsageExample || 'No target example available',
    };
  }
}

export function createApp(data) {
  try {
    return new App(data);
  } catch (error) {
    console.error('Error creating App instance:', error);
    errorHandler.handleApiError(error); // Use central error handling
    // Re-throw or return null/undefined based on how you want calling code to handle this
    throw error; // Re-throwing might be better to halt execution if app init fails
  }
}
