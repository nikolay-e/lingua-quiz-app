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

// packages/frontend/src/js/app.js
import {
  STATUS,
  DIRECTION,
  MAX_FOCUS_WORDS,
  CORRECT_ANSWERS_TO_MASTER,
  MAX_MISTAKES_BEFORE_DEGRADATION,
} from './constants.js';
import { AppAnswerProcessor } from './quiz/AppAnswerProcessor.js';
import { AppInitializer } from './quiz/AppInitializer.js';
import { AppQuizFlow } from './quiz/AppQuizFlow.js';
import { AppStateManager } from './quiz/AppStateManager.js';
import { QuizLogic } from './quiz/QuizLogic.js';
import { QuizState } from './quiz/QuizState.js';
import { StatsManager } from './quiz/StatsManager.js';
import { errorHandler } from './utils/errorHandler.js';

/**
 * Main application class that coordinates all quiz functionality.
 */
export class App {
  /** @type {QuizState} */
  quizState;
  /** @type {StatsManager} */
  statsManager;
  /** @type {QuizLogic} */
  quizLogic;
  /** @type {AppStateManager} */
  stateManager;
  /** @type {AppQuizFlow} */
  quizFlow;
  /** @type {AppAnswerProcessor} */
  answerProcessor;
  /** @type {AppInitializer} */
  initializer;

  constructor(data) {
    // Initialize core components
    this.quizState = new QuizState();
    this.statsManager = new StatsManager();
    this.quizLogic = new QuizLogic(this.quizState, this.statsManager);

    // Initialize component managers
    this.stateManager = new AppStateManager(this.quizState, this.quizLogic);
    this.quizFlow = new AppQuizFlow(
      this.quizState,
      this.quizLogic,
      this.stateManager,
      this.statsManager
    );
    this.quizFlow.setMaxFocusWords(MAX_FOCUS_WORDS);

    this.answerProcessor = new AppAnswerProcessor(
      this.quizState,
      this.quizLogic,
      this.stateManager,
      this.statsManager,
      this.quizFlow,
      CORRECT_ANSWERS_TO_MASTER,
      MAX_MISTAKES_BEFORE_DEGRADATION
    );

    this.initializer = new AppInitializer(this.quizState, this.stateManager);

    // Initialize data and populate initial focus words
    this.initializer.initializeData(data);
    this.stateManager.populateFocusWords(MAX_FOCUS_WORDS);
  }

  // --- Public API Methods ---

  /**
   * Toggles the quiz direction between normal and reverse.
   * @returns {string} - The new direction label.
   */
  toggleDirection() {
    return this.quizFlow.toggleDirection();
  }

  /**
   * Gets the next question to display.
   * @returns {Object|null} - Question data or null if no question available.
   */
  getNextQuestion() {
    return this.quizFlow.getNextQuestion();
  }

  /**
   * Processes a user's answer and prepares the next question.
   * @param {string} userAnswer - The user's answer.
   * @param {boolean} shouldGetNextQuestion - Whether to get the next question.
   * @returns {Promise<Object>} - Feedback, examples, next question, and status info.
   */
  async submitAnswer(userAnswer, shouldGetNextQuestion = true) {
    return this.answerProcessor.submitAnswer(userAnswer, shouldGetNextQuestion);
  }

  // --- Getters for external use (e.g., UI updates) ---

  /**
   * @returns {string} Current direction label (Normal or Reverse).
   */
  get currentDirectionLabel() {
    return this.quizState.direction === DIRECTION.NORMAL ? 'Normal' : 'Reverse';
  }

  /**
   * @returns {Object} Current word status sets.
   */
  get currentWordStatusSets() {
    return this.quizState.wordStatusSets;
  }

  /**
   * @returns {Map} Current quiz translations.
   */
  get currentQuizTranslations() {
    return this.quizState.quizTranslations;
  }
}

/**
 * Factory function to create an App instance with validated data.
 * @param {Array} data - Array of translation entries.
 * @returns {App} - A new App instance.
 */
export function createApp(data) {
  return AppInitializer.validateDataAndCreateApp(data, (validatedData) => new App(validatedData));
}
