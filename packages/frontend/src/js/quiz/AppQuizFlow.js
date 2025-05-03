/*
 * LinguaQuiz – Copyright © 2025 Nikolay Eremeev
 *
 * Dual-licensed:
 *  – Non-Commercial Source-Available v2  →  see LICENSE-NONCOMMERCIAL.md
 *  – Commercial License v2              →  see LICENSE-COMMERCIAL.md
 *
 * Contact: lingua-quiz@nikolay-eremeev.com
 * Repository: https://github.com/nikolay-e/lingua-quiz
 */

// packages/frontend/src/js/quiz/AppQuizFlow.js
import { DIRECTION, STATUS } from '../constants.js';

/**
 * Manages the quiz flow, including direction toggling, question selection,
 * and answer handling logic.
 */
export class AppQuizFlow {
  /**
   * @param {import('./QuizState.js').QuizState} quizState
   * @param {import('./QuizLogic.js').QuizLogic} quizLogic
   * @param {import('./AppStateManager.js').AppStateManager} stateManager
   * @param {import('./StatsManager.js').StatsManager} statsManager
   */
  constructor(quizState, quizLogic, stateManager, statsManager) {
    if (!quizState || !quizLogic || !stateManager || !statsManager) {
      throw new Error('AppQuizFlow requires all dependency instances.');
    }
    this.quizState = quizState;
    this.quizLogic = quizLogic;
    this.stateManager = stateManager;
    this.statsManager = statsManager;
  }

  /**
   * Toggles the direction of the quiz between NORMAL and REVERSE.
   * @returns {string} - Label for UI update.
   */
  toggleDirection() {
    const canDoReverse = this.quizState.wordStatusSets[STATUS.LEVEL_2].size > 0;

    if (this.quizState.direction === DIRECTION.NORMAL) {
      if (canDoReverse) {
        this.quizState.direction = DIRECTION.REVERSE;
      }
    } else {
      this.quizState.direction = DIRECTION.NORMAL;
    }
    // Return label for UI update
    return this.quizState.direction === DIRECTION.NORMAL ? 'Normal' : 'Reverse';
  }

  /**
   * Gets the next question based on current direction and word sets.
   * @returns {Object|null} - Question data or null if no question available.
   */
  getNextQuestion() {
    // Auto-switch back to Normal if Reverse isn't possible anymore
    if (
      this.quizState.direction === DIRECTION.REVERSE &&
      this.quizState.wordStatusSets[STATUS.LEVEL_2].size === 0
    ) {
      this.quizState.direction = DIRECTION.NORMAL;
    }

    // Determine candidate set based on direction
    let candidateSet =
      this.quizState.direction === DIRECTION.NORMAL
        ? this.quizState.wordStatusSets[STATUS.LEVEL_1]
        : this.quizState.wordStatusSets[STATUS.LEVEL_2];

    // Fallback for Reverse direction if L2 is empty but L1 is not
    if (candidateSet.size === 0 && this.quizState.direction === DIRECTION.REVERSE) {
      candidateSet = this.quizState.wordStatusSets[STATUS.LEVEL_1];
      // If falling back, force direction to Normal for this question's logic
      // (though the state remains REVERSE until potentially toggled back)
    }

    // Check if any candidate set has words
    if (candidateSet.size === 0) {
      // Check if all words are mastered
      if (
        this.quizState.wordStatusSets[STATUS.LEVEL_3].size === this.quizState.getTotalWordCount()
      ) {
        return null;
      }
      // Check if only LEVEL_0 words remain and populate LEVEL_1
      if (
        this.quizState.wordStatusSets[STATUS.LEVEL_0].size > 0 &&
        this.quizState.wordStatusSets[STATUS.LEVEL_1].size === 0 &&
        this.quizState.wordStatusSets[STATUS.LEVEL_2].size === 0
      ) {
        // Ensure L1 and L2 are empty too
        if (this.stateManager.populateFocusWords(this.maxFocusWords)) {
          // Retry getting a question immediately
          return this.getNextQuestion();
        } else {
          console.warn('PopulateFocusWords called but returned false, no words moved.');
          return null; // Still no words available
        }
      }
      return null; // No words available in current/fallback sets
    }

    // Select the next word ID using QuizLogic
    const nextTranslationId = this.quizLogic.selectNextTranslationId(candidateSet);
    if (nextTranslationId === null) {
      console.warn('selectNextTranslationId returned null despite candidateSet having items.');
      return null; // Should not happen if candidateSet is not empty
    }

    this.quizState.currentTranslationId = nextTranslationId;

    const translation = this.quizState.quizTranslations.get(nextTranslationId);
    if (!translation) {
      console.error(
        `Selected translation ID ${nextTranslationId} not found in map! Attempting recovery.`
      );
      this.quizState.currentTranslationId = null; // Reset current ID
      // Try getting another question
      return this.getNextQuestion();
    }

    this.quizLogic.updateLastAskedWords(nextTranslationId); // Update recently asked list

    // Determine the question word
    let questionWord;
    // Handle the specific case where we fell back from REVERSE(L2) to NORMAL(L1)
    if (
      this.quizState.direction === DIRECTION.REVERSE &&
      candidateSet === this.quizState.wordStatusSets[STATUS.LEVEL_1]
    ) {
      questionWord = translation.sourceWord; // Ask the source word even if direction state is REVERSE
    } else {
      // Standard direction logic
      questionWord =
        this.quizState.direction === DIRECTION.NORMAL
          ? translation.sourceWord
          : translation.targetWord;
    }

    return {
      word: questionWord,
      translationId: nextTranslationId,
    };
  }

  /**
   * Handles logic for correct answers, potentially upgrading word status.
   * @param {number} wordId - The ID of the word pair.
   * @param {boolean} direction - The direction the question was asked in.
   * @param {number} correctAnswersToMaster - Number of correct answers required to master.
   * @returns {boolean} - True if the word's status was changed, false otherwise.
   */
  handleCorrectAnswer(wordId, direction, correctAnswersToMaster) {
    let statusChanged = false;
    const word = this.quizState.quizTranslations.get(wordId);
    if (!word) return false;

    const correctSourceToTarget = this.statsManager.getCorrectCount(wordId, DIRECTION.NORMAL);
    const correctTargetToSource = this.statsManager.getCorrectCount(wordId, DIRECTION.REVERSE);
    const wordCurrentStatus = word.status;

    // --- Promotion Logic ---
    // L1 -> L2 (Must be correct in Normal direction)
    if (
      wordCurrentStatus === STATUS.LEVEL_1 &&
      direction === DIRECTION.NORMAL &&
      correctSourceToTarget >= correctAnswersToMaster
    ) {
      statusChanged = this.stateManager.moveWordToStatus(wordId, STATUS.LEVEL_2) || statusChanged;
    }
    // L2 -> L3 (Must be correct in Reverse direction AND Normal direction must also be mastered)
    else if (
      wordCurrentStatus === STATUS.LEVEL_2 &&
      direction === DIRECTION.REVERSE &&
      correctTargetToSource >= correctAnswersToMaster
    ) {
      // Double check if Normal was mastered (should be implicit by being L2)
      if (correctSourceToTarget >= correctAnswersToMaster) {
        statusChanged = this.stateManager.moveWordToStatus(wordId, STATUS.LEVEL_3) || statusChanged;
      } else {
        console.warn(
          `Word ${wordId} in LEVEL_2 but normal direction mastery count (${correctSourceToTarget}) is low.`
        );
      }
    }
    // Handle potential direct jump L1 -> L3 (less common)
    else if (
      wordCurrentStatus === STATUS.LEVEL_1 &&
      correctSourceToTarget >= correctAnswersToMaster &&
      correctTargetToSource >= correctAnswersToMaster
    ) {
      statusChanged = this.stateManager.moveWordToStatus(wordId, STATUS.LEVEL_3) || statusChanged;
    }

    return statusChanged;
  }

  /**
   * Sets the maximum number of focus words allowed.
   * @param {number} maxFocusWords
   */
  setMaxFocusWords(maxFocusWords) {
    this.maxFocusWords = maxFocusWords;
  }

  /**
   * Gets usage examples for the current translation.
   * @returns {{source: string, target: string}}
   */
  getUsageExamples() {
    const translation = this.quizState.quizTranslations.get(this.quizState.currentTranslationId);
    if (!translation) {
      return { source: 'N/A', target: 'N/A' };
    }
    return {
      source: translation.sourceWordUsageExample || 'No source example available',
      target: translation.targetWordUsageExample || 'No target example available',
    };
  }
}
