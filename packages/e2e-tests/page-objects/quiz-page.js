// packages/e2e-tests/page-objects/quiz-page.js
import { expect } from '@playwright/test';

import BasePage from './base-page';
import { QUIZ_CONSTANTS } from '../utils/constants';
import { selectQuiz, toggleDirection, submitAnswer } from './quiz/quiz-form-handlers.js';
import {
  disableAnimations,
  takeErrorScreenshot,
  getWordCounts,
  getCurrentWord,
} from './quiz/quiz-helpers.js';
import {
  validateListElements,
  getWordsByLevel,
  waitForWordInList,
  monitorWordMovement,
} from './quiz/quiz-list-handlers.js';

/**
 * Page object for quiz functionality
 */
class QuizPage extends BasePage {
  constructor(page) {
    super(page);

    // Define selectors once for reuse
    this.selectors = {
      // Quiz selection and controls
      quizSelect: '#quiz-select',
      directionToggle: '#direction-toggle',
      submitButton: '#submit',
      answerInput: '#answer',

      // Word display and feedback
      wordDisplay: '#word',
      feedbackMessage: '#feedback .feedback-message',

      // Word lists
      level0List: '#level-0-list',
      level1List: '#level-1-list',
      level2List: '#level-2-list',
      level3List: '#level-3-list',

      // List items
      level0Items: '#level-0-list li',
      level1Items: '#level-1-list li',
      level2Items: '#level-2-list li',
      level3Items: '#level-3-list li',
    };

    // Use constants from utils
    this.constants = QUIZ_CONSTANTS;
  }

  /**
   * Navigate to the quiz page (home page)
   */
  async navigate() {
    await this.page.goto('/', { waitUntil: 'domcontentloaded' });
    await this.waitForElement(this.selectors.quizSelect, {
      errorMessage: 'Quiz select not visible after navigation',
    });
    await this.log('Navigated to quiz page');
  }

  /**
   * Disable animations for better test stability
   */
  async disableAnimations() {
    await disableAnimations(this.page, this.log.bind(this));
  }

  /**
   * Select a quiz by name
   * @param {string} quizName - The name of the quiz to select
   * @returns {Promise<string>} - The value of the selected option
   */
  async selectQuiz(quizName) {
    return await selectQuiz(
      this.page,
      this.selectors,
      {
        waitForElement: this.waitForElement.bind(this),
        fillInput: this.fillInput.bind(this),
        clickElement: this.clickElement.bind(this),
      },
      this.timeouts,
      this.constants,
      this.log.bind(this),
      quizName
    );
  }

  /**
   * Toggle the direction between normal and reverse
   * @returns {Promise<string>} - The new direction
   */
  async toggleDirection() {
    return await toggleDirection(
      this.page,
      this.selectors,
      {
        clickElement: this.clickElement.bind(this),
      },
      this.log.bind(this)
    );
  }

  /**
   * Submit an answer in the quiz
   * @param {string} answer - The answer to submit
   * @returns {Promise<Object>} - Result with success flag and feedback
   */
  async submitAnswer(answer) {
    return await submitAnswer(
      this.page,
      this.selectors,
      {
        fillInput: this.fillInput.bind(this),
        clickElement: this.clickElement.bind(this),
      },
      this.timeouts,
      this.constants,
      this.log.bind(this),
      answer
    );
  }

  /**
   * Takes a screenshot with a specific name for errors
   * @param {string} name - The name for the screenshot
   */
  async takeErrorScreenshot(name) {
    await takeErrorScreenshot(this.page, name, this.log.bind(this));
  }

  /**
   * Gets the current word displayed on the page
   * @returns {Promise<string|null>} - The current word or null if not found
   */
  async getCurrentWord() {
    return await getCurrentWord(this.page, this.selectors, this.log.bind(this));
  }

  /**
   * Gets counts of words by level from the UI
   * @returns {Promise<Object>} - Counts for each level and total
   */
  async getWordCounts() {
    return await getWordCounts(this.page, this.selectors, this.log.bind(this));
  }

  /**
   * Validates that list elements are properly initialized
   * @returns {Promise<boolean>} - True if lists are valid
   */
  async validateListElements() {
    return await validateListElements(this.page, this.selectors, this.log.bind(this));
  }

  /**
   * Gets words from a specific level list
   * @param {number} level - The level (0-3)
   * @returns {Promise<Array<string>>} - Array of words in the list
   */
  async getWordsByLevel(level) {
    return await getWordsByLevel(this.page, this.selectors, this.log.bind(this), level);
  }

  /**
   * Waits for a word to appear in a specific level list
   * @param {string} word - The word to look for
   * @param {number} level - The level to check
   * @returns {Promise<boolean>} - True if word was found
   */
  async waitForWordInList(word, level) {
    return await waitForWordInList(
      this.page,
      this.selectors,
      this.timeouts,
      this.log.bind(this),
      word,
      level
    );
  }

  /**
   * Tracks a word's movement between levels after an action
   * @param {string} word - The word to track
   * @param {number} fromLevel - Start level
   * @param {number} toLevel - Target level
   * @returns {Promise<boolean>} - True if word moved correctly
   */
  async monitorWordMovement(word, fromLevel, toLevel) {
    return await monitorWordMovement(
      this.page,
      this.selectors,
      this.timeouts,
      this.log.bind(this),
      word,
      fromLevel,
      toLevel
    );
  }
}

export default QuizPage;
