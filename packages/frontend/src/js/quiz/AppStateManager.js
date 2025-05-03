// packages/frontend/src/js/quiz/AppStateManager.js
import { STATUS } from '../constants.js';

/**
 * Manages state-related operations for the App, particularly related to moving words
 * between different status sets and populating focus words.
 */
export class AppStateManager {
  /**
   * @param {import('./QuizState.js').QuizState} quizState
   * @param {import('./QuizLogic.js').QuizLogic} quizLogic
   */
  constructor(quizState, quizLogic) {
    if (!quizState || !quizLogic) {
      throw new Error('AppStateManager requires valid QuizState and QuizLogic instances.');
    }
    this.quizState = quizState;
    this.quizLogic = quizLogic;
  }

  /**
   * Helper to add word to a set during init (doesn't remove from others)
   * @param {number} wordPairId - The ID of the word pair.
   * @param {string} status - The status to add the word to.
   */
  addWordToStatusSet(wordPairId, status) {
    const targetSet = this.quizState.wordStatusSets[status];
    if (targetSet) {
      targetSet.add(wordPairId);
    } else {
      // This case should be prevented by the status validation in initializeData,
      // but kept as a fallback.
      console.warn(
        `Unknown status '${status}' during init for wordPairId '${wordPairId}'. Adding to LEVEL_0.`
      );
      this.quizState.wordStatusSets[STATUS.LEVEL_0].add(wordPairId);
      // Correct status in the main map too if it was invalid
      const wordPair = this.quizState.quizTranslations.get(wordPairId);
      if (wordPair && wordPair.status !== STATUS.LEVEL_0) wordPair.status = STATUS.LEVEL_0;
    }
  }

  /**
   * Moves a word to a new status set, removing it from others.
   * Updates both the Set membership and the status property in quizTranslations.
   * @param {number} wordPairId - The ID of the word pair.
   * @param {string} newStatus - The target status (must be a valid STATUS).
   * @returns {boolean} - True if the status was actually changed, false otherwise.
   */
  moveWordToStatus(wordPairId, newStatus) {
    const wordPair = this.quizState.quizTranslations.get(wordPairId);
    if (!wordPair) {
      console.error(`Word ${wordPairId} not found in quizTranslations! Cannot move status.`);
      return false;
    }

    const oldStatus = wordPair.status;

    // Ensure the new status is valid. If not, log error and don't change.
    if (!this.quizState.wordStatusSets[newStatus]) {
      console.error(
        `Attempted to move word ${wordPairId} to invalid status '${newStatus}'. Aborting move.`
      );
      return false;
    }

    if (oldStatus === newStatus) {
      return false; // No change needed
    }

    // Remove from the old set
    if (this.quizState.wordStatusSets[oldStatus]) {
      this.quizState.wordStatusSets[oldStatus].delete(wordPairId);
    } else {
      console.warn(`Word ${wordPairId} had an unknown old status '${oldStatus}' during move.`);
      // Attempt removal from all sets just in case
      for (const set of Object.values(this.quizState.wordStatusSets)) set.delete(wordPairId);
    }

    // Add to the new set
    this.quizState.wordStatusSets[newStatus].add(wordPairId);

    // Update status property in the main map
    wordPair.status = newStatus;

    return true; // Status was changed
  }

  /**
   * Populates the LEVEL_1 (focus) set from LEVEL_0 (upcoming) if space is available.
   * @param {number} maxFocusWords - Maximum number of words to keep in focus.
   * @returns {boolean} - True if any words were moved from L0 to L1, false otherwise.
   */
  populateFocusWords(maxFocusWords) {
    const focusSet = this.quizState.wordStatusSets[STATUS.LEVEL_1];
    const upcomingSet = this.quizState.wordStatusSets[STATUS.LEVEL_0];
    const spacesAvailable = maxFocusWords - focusSet.size;
    let movedCount = 0;

    if (spacesAvailable > 0 && upcomingSet.size > 0) {
      const upcomingWords = [...upcomingSet];
      // Shuffle upcoming words to add randomness
      const shuffled = upcomingWords.sort(() => 0.5 - Math.random());
      const wordsToMove = shuffled.slice(0, spacesAvailable);

      for (const wordId of wordsToMove) {
        // moveWordToStatus handles sets and the map status property
        if (this.moveWordToStatus(wordId, STATUS.LEVEL_1)) {
          movedCount += 1;
        }
      }
    }
    return movedCount > 0;
  }

  /**
   * Degrades a word's level based on mistakes. Handles moving the word
   * and resetting mistake counters.
   * @param {number} wordId - The ID of the word pair.
   * @returns {boolean} - True if the status was actually changed, false otherwise.
   */
  degradeWordLevel(wordId) {
    const word = this.quizState.quizTranslations.get(wordId);
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
      // The critical part: actually perform the move to update both Sets and Map
      const statusActuallyChanged = this.moveWordToStatus(wordId, newLevel);

      if (statusActuallyChanged) {
        // Reset mistakes counter for *both* directions upon degradation
        this.quizLogic.resetBothMistakeCounters(wordId);
        return true; // Status changed
      }
    } else {
      console.warn(
        `Could not determine new level for degradation from ${currentLevel} for word ${wordId}`
      );
    }
    return false; // No change occurred
  }
}
