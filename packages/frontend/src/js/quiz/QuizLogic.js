// packages/frontend/src/js/quiz/QuizLogic.js
import {
  STATUS,
  DIRECTION,
  MAX_LAST_ASKED_WORDS,
  TOP_WORDS_LIMIT,
  CORRECT_ANSWERS_TO_MASTER,
  MAX_MISTAKES_BEFORE_DEGRADATION,
} from '../constants.js';

/**
 * Contains the core logic for quiz flow, question selection, and answer verification.
 * Operates on a QuizState instance.
 */
export class QuizLogic {
  /** @type {import('./QuizState.js').QuizState} */
  quizState;
  /** @type {import('./StatsManager.js').StatsManager} */
  statsManager;

  constructor(quizState, statsManager) {
    if (!quizState || !statsManager) {
      throw new Error('QuizLogic requires valid QuizState and StatsManager instances.');
    }
    this.quizState = quizState;
    this.statsManager = statsManager;
  }

  /**
   * Selects the next word ID based on current state and logic.
   * @param {Set<number>} wordSet - The set of candidate word IDs (e.g., LEVEL_1 or LEVEL_2).
   * @returns {number | null} - The ID of the next question word, or null if none available.
   */
  selectNextTranslationId(wordSet) {
    if (wordSet.size === 0) return null;

    const incorrectCounts = this.statsManager.aggregateIncorrectCounts();
    const sortedWords = [...wordSet].sort((a, b) => {
      const countA = incorrectCounts[a] || 0;
      const countB = incorrectCounts[b] || 0;
      if (countB !== countA) {
        return countB - countA; // Higher incorrect count first
      }
      return Math.random() - 0.5; // Randomize ties
    });

    const topFewWords = sortedWords.slice(0, TOP_WORDS_LIMIT);
    const availableWords = topFewWords.filter(
      (wordId) => !this.quizState.lastAskedWords.includes(wordId)
    );

    const selectionPool = availableWords.length > 0 ? availableWords : topFewWords;

    if (selectionPool.length === 0) {
      // Fallback if all top words were recently asked
      const lessRecentAvailable = sortedWords.filter(
        (wordId) => !this.quizState.lastAskedWords.includes(wordId)
      );
      if (lessRecentAvailable.length > 0) {
        return lessRecentAvailable[0];
      }
      // If absolutely all words in the set were asked recently, pick the most incorrect
      return sortedWords.length > 0 ? sortedWords[0] : null; // Handle empty sortedWords case
    }

    const randomIndex = Math.floor(Math.random() * selectionPool.length);
    return selectionPool[randomIndex];
  }

  /**
   * Updates the list of recently asked words.
   * @param {number} wordId
   */
  updateLastAskedWords(wordId) {
    this.quizState.lastAskedWords = this.quizState.lastAskedWords.filter((id) => id !== wordId);
    this.quizState.lastAskedWords.push(wordId);
    if (this.quizState.lastAskedWords.length > MAX_LAST_ASKED_WORDS) {
      this.quizState.lastAskedWords.shift();
    }
  }

  /**
   * Verifies the user's answer against the correct answer for the current word.
   * @param {string} userAnswer
   * @returns {boolean}
   */
  verifyAnswer(userAnswer) {
    const translation = this.quizState.getWordPair(this.quizState.currentTranslationId);
    if (!translation) {
      throw new Error(
        `Translation not found for ID ${this.quizState.currentTranslationId} during verification.`
      );
    }
    const correctAnswer =
      this.quizState.direction === DIRECTION.NORMAL
        ? translation.targetWord
        : translation.sourceWord;
    return this.compareAnswers(userAnswer, correctAnswer);
  }

  /**
   * Compares answers, normalizing them first.
   * @param {string} userAnswer
   * @param {string} correctAnswer
   * @returns {boolean}
   */
  compareAnswers(userAnswer, correctAnswer) {
    // Ensure both answers are strings before processing
    if (typeof userAnswer !== 'string') {
      userAnswer = String(userAnswer || '');
    }

    if (typeof correctAnswer !== 'string') {
      correctAnswer = String(correctAnswer || '');
    }

    const normalize = (answer) => {
      if (!answer || typeof answer !== 'string') return '';
      return answer
        .toLowerCase()
        .normalize('NFD')
        .replaceAll(/\p{M}/gu, '')
        .replaceAll(/[^\p{L}\p{N}\s]/gu, '')
        .replaceAll(/\s+/g, ' ')
        .trim();
    };
    return normalize(userAnswer) === normalize(correctAnswer);
  }

  // --- Mistake Handling ---

  getMistakesKey(wordId, direction) {
    return `${wordId}-${direction === DIRECTION.NORMAL ? 'normal' : 'reverse'}`;
  }

  resetMistakesCounter(wordId, direction) {
    const key = this.getMistakesKey(wordId, direction);
    this.quizState.consecutiveMistakes.set(key, 0);
  }

  resetBothMistakeCounters(wordId) {
    this.resetMistakesCounter(wordId, DIRECTION.NORMAL);
    this.resetMistakesCounter(wordId, DIRECTION.REVERSE);
  }

  incrementMistakesCounter(wordId, direction) {
    const key = this.getMistakesKey(wordId, direction);
    const currentMistakes = this.quizState.consecutiveMistakes.get(key) || 0;
    const newMistakes = currentMistakes + 1;
    this.quizState.consecutiveMistakes.set(key, newMistakes);
    return newMistakes;
  }
}
