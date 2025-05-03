// packages/frontend/src/js/quiz/StatsManager.js
import { DIRECTION, MILLISECONDS_IN_SECOND } from '../constants.js';

/**
 * Manages statistics for the quiz session.
 */
export class StatsManager {
  stats = {
    totalAttempts: 0,
    correctAnswers: 0,
    incorrectAnswers: 0,
    // Key: `${wordPairId}-${direction}`, Value: { attempts, correct, incorrect }
    attemptsPerTranslationIdAndDirection: {},
    // Key: `${wordPairId}-${direction}`, Value: count
    incorrectPerTranslationIdAndDirection: {},
    // Key: `${wordPairId}-${direction}`, Value: Array<timeInSeconds>
    timePerTranslationIdAndDirection: {},
    // Array of time spent per question attempt
    timePerQuestion: [],
  };

  constructor() {
    // Initialization, if needed
  }

  /**
   * Updates the statistics based on the result of an answer.
   * @param {boolean} isCorrect - Whether the answer was correct.
   * @param {number} wordPairId - The ID of the word pair answered.
   * @param {boolean} direction - The direction the question was asked in (DIRECTION.NORMAL or DIRECTION.REVERSE).
   * @param {number} startTime - The timestamp (Date.now()) when the question was presented.
   */
  updateStats(isCorrect, wordPairId, direction, startTime) {
    const timeSpentOnAnswer = (Date.now() - startTime) / MILLISECONDS_IN_SECOND;
    this.stats.totalAttempts += 1;
    this.stats.timePerQuestion.push(timeSpentOnAnswer);

    const translationDirection = direction === DIRECTION.NORMAL ? 'normal' : 'reverse';
    const wordDirectionKey = `${wordPairId}-${translationDirection}`;

    // Initialize stat objects if they don't exist
    if (!this.stats.attemptsPerTranslationIdAndDirection[wordDirectionKey]) {
      this.stats.attemptsPerTranslationIdAndDirection[wordDirectionKey] = {
        attempts: 0,
        correct: 0,
        incorrect: 0,
      };
    }
    if (!this.stats.incorrectPerTranslationIdAndDirection[wordDirectionKey]) {
      // Separate count specifically for incorrect answers per direction
      this.stats.incorrectPerTranslationIdAndDirection[wordDirectionKey] = 0;
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
      // Increment the specific incorrect count
      this.stats.incorrectPerTranslationIdAndDirection[wordDirectionKey] += 1;
    }
  }

  /**
   * Aggregates incorrect counts across both directions for each word.
   * @returns {Object<number, number>} - Map of wordPairId to total incorrect count.
   */
  aggregateIncorrectCounts() {
    const counts = {};
    for (const [key, value] of Object.entries(this.stats.incorrectPerTranslationIdAndDirection)) {
      // Extract wordPairId (assuming format 'id-direction')
      const [translationId] = key.split('-');
      // Ensure translationId is treated as a number if keys might be strings
      const idNum = Number.parseInt(translationId, 10);
      if (!isNaN(idNum)) {
        counts[idNum] = (counts[idNum] || 0) + value;
      }
    }
    return counts;
  }

  /**
   * Gets the number of correct answers for a specific word and direction.
   * @param {number} wordPairId
   * @param {boolean} direction
   * @returns {number}
   */
  getCorrectCount(wordPairId, direction) {
    const translationDirection = direction === DIRECTION.NORMAL ? 'normal' : 'reverse';
    const wordDirectionKey = `${wordPairId}-${translationDirection}`;
    return this.stats.attemptsPerTranslationIdAndDirection[wordDirectionKey]?.correct || 0;
  }

  // Add other getter methods for stats if needed
}
