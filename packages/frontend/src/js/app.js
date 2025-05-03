// packages/frontend/src/js/app.js
import {
  STATUS,
  DIRECTION,
  MAX_FOCUS_WORDS,
  CORRECT_ANSWERS_TO_MASTER,
  MAX_MISTAKES_BEFORE_DEGRADATION,
} from './constants.js';
import { QuizLogic } from './quiz/QuizLogic.js';
import { QuizState } from './quiz/QuizState.js';
import { StatsManager } from './quiz/StatsManager.js';
import { errorHandler } from './utils/errorHandler.js';

export class App {
  /** @type {QuizState} */
  quizState;
  /** @type {StatsManager} */
  statsManager;
  /** @type {QuizLogic} */
  quizLogic;

  constructor(data) {
    this.quizState = new QuizState();
    this.statsManager = new StatsManager();
    this.quizLogic = new QuizLogic(this.quizState, this.statsManager);

    this.initializeData(data);
    this.populateFocusWords(); // Initial population of learning words
  }

  // --- Initialization ---

  initializeData(data) {
    console.debug('[App] Initializing data with:', Array.isArray(data) ? `${data.length} items` : 'non-array data');
    
    if (!Array.isArray(data) || data.length === 0) {
      console.error('[App] Invalid data format:', data);
      throw new Error('Invalid or insufficient data provided.');
    }

    try {
      // Log the first entry to check properties
      console.debug('[App] First data entry:', JSON.stringify(data[0]));
      
      // More robust handling of language data with detailed logging
      try {
        const firstItem = data[0];
        
        // Safe access to properties with fallbacks
        this.quizState.sourceLanguage = firstItem.sourceLanguage || firstItem.source || 'Source';
        this.quizState.targetLanguage = firstItem.targetLanguage || firstItem.target || 'Target';
        
        console.debug(`[App] Languages set: ${this.quizState.sourceLanguage} → ${this.quizState.targetLanguage}`);
      } catch (error) {
        console.error(`[App] Error setting languages:`, error);
        this.quizState.sourceLanguage = 'Source';
        this.quizState.targetLanguage = 'Target';
      }

      for (const entry of data) {
        // Debug individual entry properties
        if (entry && typeof entry === 'object') {
          console.debug(`[App] Processing entry: wordPairId=${entry.wordPairId}, source=${entry.sourceWord}, ` + 
                        `target=${entry.targetWord}, status=${entry.status}`);
        }
        
        if (
          typeof entry !== 'object' ||
          entry.wordPairId === undefined ||
          entry.wordPairId === null
        ) {
          console.warn('[App] Invalid word entry (missing or null wordPairId):', entry);
          continue;
        }

        const { wordPairId } = entry;
        // Ensure status is valid, default to LEVEL_0 otherwise
        const status = Object.values(STATUS).includes(entry.status) ? entry.status : STATUS.LEVEL_0;

        // Store the full translation data in the map
        this.quizState.quizTranslations.set(wordPairId, { ...entry, status }); // Ensure status in map is correct
        // Add the word ID to the appropriate status set
        this.addWordToStatusSet(wordPairId, status);
      }

      console.debug(`[App] Added ${this.quizState.quizTranslations.size} valid translations`);
      
      if (this.quizState.quizTranslations.size === 0) {
        console.error('[App] No valid entries found in data');
        throw new Error('No valid entries added to quizTranslations');
      }
    } catch (error) {
      console.error('[App] Error initializing data:', error);
      throw error;
    }
  }

  // Helper to add word to a set during init (doesn't remove from others)
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

  // --- State Management ---

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
   * @returns {boolean} - True if any words were moved from L0 to L1, false otherwise.
   */
  populateFocusWords() {
    const focusSet = this.quizState.wordStatusSets[STATUS.LEVEL_1];
    const upcomingSet = this.quizState.wordStatusSets[STATUS.LEVEL_0];
    const spacesAvailable = MAX_FOCUS_WORDS - focusSet.size;
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
    const quizLogic = this.quizLogic;

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
        quizLogic.resetBothMistakeCounters(wordId);
        return true; // Status changed
      }
    } else {
      console.warn(
        `Could not determine new level for degradation from ${currentLevel} for word ${wordId}`
      );
    }
    return false; // No change occurred
  }

  /**
   * Handles logic for correct answers, potentially upgrading word status.
   * @returns {boolean} - True if the word's status was changed, false otherwise.
   */
  handleCorrectAnswer() {
    let statusChanged = false;
    const wordId = this.quizState.currentTranslationId;
    const word = this.quizState.quizTranslations.get(wordId);
    if (!word) return false;

    const correctSourceToTarget = this.statsManager.getCorrectCount(wordId, DIRECTION.NORMAL);
    const correctTargetToSource = this.statsManager.getCorrectCount(wordId, DIRECTION.REVERSE);
    const wordCurrentStatus = word.status;
    const currentDirection = this.quizState.direction;

    // --- Promotion Logic ---
    // L1 -> L2 (Must be correct in Normal direction)
    if (
      wordCurrentStatus === STATUS.LEVEL_1 &&
      currentDirection === DIRECTION.NORMAL &&
      correctSourceToTarget >= CORRECT_ANSWERS_TO_MASTER
    ) {
      statusChanged = this.moveWordToStatus(wordId, STATUS.LEVEL_2) || statusChanged;
    }
    // L2 -> L3 (Must be correct in Reverse direction AND Normal direction must also be mastered)
    else if (
      wordCurrentStatus === STATUS.LEVEL_2 &&
      currentDirection === DIRECTION.REVERSE &&
      correctTargetToSource >= CORRECT_ANSWERS_TO_MASTER
    ) {
      // Double check if Normal was mastered (should be implicit by being L2)
      if (correctSourceToTarget >= CORRECT_ANSWERS_TO_MASTER) {
        statusChanged = this.moveWordToStatus(wordId, STATUS.LEVEL_3) || statusChanged;
      } else {
        console.warn(
          `Word ${wordId} in LEVEL_2 but normal direction mastery count (${correctSourceToTarget}) is low.`
        );
      }
    }
    // Handle potential direct jump L1 -> L3 (less common)
    else if (
      wordCurrentStatus === STATUS.LEVEL_1 &&
      correctSourceToTarget >= CORRECT_ANSWERS_TO_MASTER &&
      correctTargetToSource >= CORRECT_ANSWERS_TO_MASTER
    ) {
      statusChanged = this.moveWordToStatus(wordId, STATUS.LEVEL_3) || statusChanged;
    }

    return statusChanged;
  }
  // --- Quiz Flow ---

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
      // This might be confusing - reconsider if direction should permanently flip here.
      // For now, just use L1 set but keep state direction REVERSE conceptually.
      // The question word selection below handles this.
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
        if (this.populateFocusWords()) {
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
      // Remove potentially bad ID from sets? Risky. Just try getting another question.
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

  // --- Answer Processing ---

  async submitAnswer(userAnswer, shouldGetNextQuestion = true) {
    let statusChanged = false;
    const startTime = Date.now();
    const currentWordId = this.quizState.currentTranslationId;
    const currentDirection = this.quizState.direction;

    if (currentWordId === null) {
      console.error('submitAnswer called but currentTranslationId is null.');
      // Try to get a question first if possible
      const nextQ = this.getNextQuestion();
      if (nextQ) {
        return {
          feedback: { message: 'Starting quiz...', isSuccess: true },
          usageExamples: this.getUsageExamples(), // Examples for the new word
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
        const promoted = this.handleCorrectAnswer(); // Checks stats and potentially calls moveWordToStatus
        statusChanged = promoted || statusChanged;

        // Only populate focus words after a promotion, not after degradation
        if (statusChanged) {
          this.populateFocusWords();
        }
      } else {
        const mistakes = this.quizLogic.incrementMistakesCounter(currentWordId, currentDirection);
        if (mistakes >= MAX_MISTAKES_BEFORE_DEGRADATION) {
          const degraded = this.degradeWordLevel(currentWordId); // Handles moveWordToStatus and mistake reset
          statusChanged = degraded || statusChanged;
          // Do not call populateFocusWords here to prevent moving the degraded word back up
        }
      }

      const feedback = this.generateFeedback(isCorrect);
      const usageExamples = this.getUsageExamples(); // Get examples for the *current* word
      let questionData = null;

      if (shouldGetNextQuestion) {
        questionData = this.getNextQuestion(); // Get the *next* question data
      }

      // Return state *after* processing the answer and potentially getting the next question
      return { feedback, usageExamples, questionData, statusChanged };
    } catch (error) {
      console.error('Error submitting answer:', error);
      errorHandler.handleApiError(error);
      return {
        feedback: { message: 'An error occurred processing the answer.', isSuccess: false },
        usageExamples: this.getUsageExamples() || { source: 'N/A', target: 'N/A' },
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

  /**
   * Retrieves usage examples for the current translation.
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

  // --- Getters for external use (e.g., UI updates) ---
  get currentDirectionLabel() {
    return this.quizState.direction === DIRECTION.NORMAL ? 'Normal' : 'Reverse';
  }

  get currentWordStatusSets() {
    return this.quizState.wordStatusSets;
  }

  get currentQuizTranslations() {
    return this.quizState.quizTranslations;
  }
} // End App Class

// --- Factory Function ---
export function createApp(data) {
  console.debug('[createApp] Attempting to create App with data:', 
                data ? `${Array.isArray(data) ? data.length : 'non-array'} data item(s)` : 'null/undefined data');
  
  // Check data validity before proceeding
  if (!data) {
    const error = new Error('[createApp] No data provided to createApp');
    console.error(error.message);
    errorHandler.handleApiError(error);
    throw error;
  }
  
  if (!Array.isArray(data)) {
    const error = new Error(`[createApp] Expected array but got ${typeof data}`);
    console.error(error.message, data);
    errorHandler.handleApiError(error);
    throw error;
  }
  
  if (data.length === 0) {
    const error = new Error('[createApp] Empty array provided to createApp');
    console.error(error.message);
    errorHandler.handleApiError(error);
    throw error;
  }
  
  // Check for specific data issues that could cause the "source" property error
  const problemItems = [];
  data.forEach((item, index) => {
    if (!item) {
      console.error(`[createApp] Item at index ${index} is null or undefined`);
      problemItems.push({ index, error: 'null or undefined', value: item });
    } else if (typeof item !== 'object') {
      console.error(`[createApp] Item at index ${index} is not an object: ${typeof item}`);
      problemItems.push({ index, error: `not an object, but ${typeof item}`, value: item });
    } else if (!item.sourceWord) { 
      console.error(`[createApp] Item at index ${index} is missing sourceWord:`, item);
      problemItems.push({ index, error: 'missing sourceWord', value: item });
    } else if (!item.targetWord) {
      console.error(`[createApp] Item at index ${index} is missing targetWord:`, item);
      problemItems.push({ index, error: 'missing targetWord', value: item });
    } else if (!item.wordPairId && item.wordPairId !== 0) {
      console.error(`[createApp] Item at index ${index} is missing wordPairId:`, item);
      problemItems.push({ index, error: 'missing wordPairId', value: item });
    }
  });
  
  if (problemItems.length > 0) {
    console.warn(`[createApp] Found ${problemItems.length} problem items in data:`, 
      JSON.stringify(problemItems.slice(0, 3)));
    
    if (problemItems.length === data.length) {
      const error = new Error('[createApp] All items in data are invalid');
      console.error(error.message);
      errorHandler.handleApiError(error);
      throw error;
    }
    
    // Print the first valid item as an example of proper format
    const validExample = data.find((item, index) => !problemItems.some(p => p.index === index));
    if (validExample) {
      console.info('[createApp] Example of valid item format:', JSON.stringify(validExample));
    }
  }
  
  try {
    const app = new App(data);
    console.debug('[createApp] Successfully created App instance');
    return app;
  } catch (error) {
    console.error('[createApp] Error creating App instance:', error);
    // Log call stack to help diagnose where the error is coming from
    console.error('[createApp] Error stack:', error.stack);
    errorHandler.handleApiError(error);
    throw error; // Re-throw to indicate failure
  }
}
