// packages/frontend/src/js/quiz/AppAnswerProcessor.js
import { DIRECTION } from '../constants.js';
import { errorHandler } from '../utils/errorHandler.js';

/**
 * Processes quiz answers, updating statistics and word statuses.
 */
export class AppAnswerProcessor {
  /**
   * @param {import('./QuizState.js').QuizState} quizState
   * @param {import('./QuizLogic.js').QuizLogic} quizLogic
   * @param {import('./AppStateManager.js').AppStateManager} stateManager
   * @param {import('./StatsManager.js').StatsManager} statsManager
   * @param {import('./AppQuizFlow.js').AppQuizFlow} quizFlow
   * @param {number} correctAnswersToMaster
   * @param {number} maxMistakesBeforeDegradation
   */
  constructor(
    quizState,
    quizLogic,
    stateManager,
    statsManager,
    quizFlow,
    correctAnswersToMaster,
    maxMistakesBeforeDegradation
  ) {
    this.quizState = quizState;
    this.quizLogic = quizLogic;
    this.stateManager = stateManager;
    this.statsManager = statsManager;
    this.quizFlow = quizFlow;
    this.correctAnswersToMaster = correctAnswersToMaster;
    this.maxMistakesBeforeDegradation = maxMistakesBeforeDegradation;
  }

  /**
   * Processes a user's answer, updating statistics and potentially changing word status.
   * @param {string} userAnswer - The user's answer.
   * @param {boolean} shouldGetNextQuestion - Whether to get the next question after processing.
   * @returns {Object} - Feedback, usage examples, next question data, and status change flag.
   */
  async submitAnswer(userAnswer, shouldGetNextQuestion = true) {
    let statusChanged = false;
    const startTime = Date.now();
    const currentWordId = this.quizState.currentTranslationId;
    const currentDirection = this.quizState.direction;

    if (currentWordId === null) {
      console.error('submitAnswer called but currentTranslationId is null.');
      // Try to get a question first if possible
      const nextQ = this.quizFlow.getNextQuestion();
      if (nextQ) {
        return {
          feedback: { message: 'Starting quiz...', isSuccess: true },
          usageExamples: this.quizFlow.getUsageExamples(), // Examples for the new word
          questionData: nextQ,
          statusChanged: false, // No answer processed yet
        };
      } else {
        // No current question, and can't get a new one (quiz likely finished)
        return {
          feedback: { message: 'Quiz finished or no question available.', isSuccess: true },
          usageExamples: { source: 'N/A', target: 'N/A' },
          questionData: null,
          statusChanged: false,
        };
      }
    }

    try {
      const isCorrect = this.quizLogic.verifyAnswer(userAnswer);

      // Update statistics using StatsManager
      this.statsManager.updateStats(isCorrect, currentWordId, currentDirection, startTime);

      if (isCorrect) {
        this.quizLogic.resetMistakesCounter(currentWordId, currentDirection);
        const promoted = this.quizFlow.handleCorrectAnswer(
          currentWordId,
          currentDirection,
          this.correctAnswersToMaster
        );
        statusChanged = promoted || statusChanged;

        // Only populate focus words after a promotion, not after degradation
        if (statusChanged) {
          this.stateManager.populateFocusWords(this.quizFlow.maxFocusWords);
        }
      } else {
        const mistakes = this.quizLogic.incrementMistakesCounter(currentWordId, currentDirection);
        if (mistakes >= this.maxMistakesBeforeDegradation) {
          const degraded = this.stateManager.degradeWordLevel(currentWordId);
          statusChanged = degraded || statusChanged;
          // Do not call populateFocusWords here to prevent moving the degraded word back up
        }
      }

      const feedback = this.generateFeedback(isCorrect);
      const usageExamples = this.quizFlow.getUsageExamples(); // Get examples for the *current* word
      let questionData = null;

      if (shouldGetNextQuestion) {
        questionData = this.quizFlow.getNextQuestion(); // Get the *next* question data
      }

      // Return state *after* processing the answer and potentially getting the next question
      return { feedback, usageExamples, questionData, statusChanged };
    } catch (error) {
      console.error('Error submitting answer:', error);
      errorHandler.handleApiError(error);
      return {
        feedback: { message: 'An error occurred processing the answer.', isSuccess: false },
        usageExamples: this.quizFlow.getUsageExamples() || { source: 'N/A', target: 'N/A' },
        questionData: null, // Don't attempt to provide next question on error
        statusChanged: false,
      };
    }
  }

  /**
   * Generates user feedback based on correctness and current translation.
   * @param {boolean} isCorrect
   * @returns {{message: string, isSuccess: boolean}}
   */
  generateFeedback(isCorrect) {
    const translation = this.quizState.quizTranslations.get(this.quizState.currentTranslationId);
    if (!translation) {
      return { message: 'Error: Could not retrieve translation details.', isSuccess: false };
    }
    return isCorrect
      ? { message: 'Correct!', isSuccess: true }
      : {
          message: `Wrong. The correct pair is: '${translation.sourceWord}' ↔ '${translation.targetWord}'`,
          isSuccess: false,
        };
  }
}
