import { fetchWordSets, fetchWordLists } from '../quiz/dataHandler.js';
import {
  displayQuestion,
  updateDirectionToggleTitle,
  updateWordSetsDisplay,
} from './displayManager.js';
import { saveQuizState } from '../quiz/wordSetManager.js';
import { errorHandler } from '../utils/errorHandler.js';

let app = null;

function setFeedback(message, isSuccess = true) {
  const feedbackElement = document.getElementById('feedback');
  const feedbackMessage = feedbackElement.querySelector('.feedback-message');
  if (feedbackElement && feedbackMessage) {
    feedbackMessage.textContent = message;
    feedbackElement.className = isSuccess ? 'feedback-text success' : 'feedback-text error';
  } else {
    console.error('Feedback element or message not found');
  }
}

async function loadWordsFromAPI(wordListName) {
  try {
    const token = localStorage.getItem('token');
    if (!token) {
      throw new Error('User is not authenticated');
    }

    app = await fetchWordSets(token, wordListName);

    updateDirectionToggleTitle(app);
    const questionData = app.getNextQuestion();
    displayQuestion(questionData);
    updateWordSetsDisplay(app);
  } catch (error) {
    console.error(`Error loading words for ${wordListName}:`, error);
    errorHandler.handleApiError(error);
  }
}

function handleEnterKey(event) {
  if (event.key === 'Enter') {
    event.preventDefault();
    const submitButton = document.getElementById('submit');
    if (submitButton) {
      submitButton.click();
    } else {
      console.error('Submit button not found');
    }
  }
}

async function submitAnswer() {
  try {
    const answerInput = document.getElementById('answer');

    if (!answerInput) {
      console.error('Answer input not found');
      return;
    }

    const userAnswer = answerInput.value;
    const { feedback, usageExamples, questionData } = await app.submitAnswer(userAnswer);

    // Update UI with feedback and usage examples
    setFeedback(feedback.message, feedback.isSuccess);
    document.getElementById('source-word-usage').textContent = usageExamples.source;
    document.getElementById('target-word-usage').textContent = usageExamples.target;

    // Display next question
    displayQuestion(questionData);
    updateWordSetsDisplay(app);

    // Clear and focus input
    answerInput.value = '';
    answerInput.focus();

    // Save quiz state
    const token = localStorage.getItem('token');
    await saveQuizState(app, token);
  } catch (error) {
    console.error('Error submitting answer:', error);
    setFeedback('An error occurred. Please try again.', false);
    errorHandler.handleApiError(error);
  }
}

function handleDirectionToggle() {
  app.toggleDirection();
  updateDirectionToggleTitle(app);
  const questionData = app.getNextQuestion();
  displayQuestion(questionData);
  updateWordSetsDisplay(app);
}

function handleQuizSelect(event) {
  const selectedQuiz = event.target.value;
  if (selectedQuiz) {
    loadWordsFromAPI(selectedQuiz);
  }
}

export async function populateWordLists() {
  try {
    const token = localStorage.getItem('token');
    if (!token) {
      throw new Error('User is not authenticated');
    }

    const wordLists = await fetchWordLists(token);
    const quizSelect = document.getElementById('quiz-select');

    wordLists.forEach((list) => {
      const option = document.createElement('option');
      option.value = list.name;
      option.textContent = list.name;
      quizSelect.appendChild(option);
    });
  } catch (error) {
    console.error('Error populating word lists:', error);
    errorHandler.handleApiError(error);
  }
}

export function initEventHandlers() {
  errorHandler.init();

  const answerInput = document.getElementById('answer');
  if (answerInput) {
    answerInput.addEventListener('keydown', handleEnterKey);
  }

  const submitButton = document.getElementById('submit');
  if (submitButton) {
    submitButton.addEventListener('click', submitAnswer);
  }

  const directionToggleBtn = document.getElementById('direction-toggle');
  if (directionToggleBtn) {
    directionToggleBtn.addEventListener('click', handleDirectionToggle);
  }

  const quizSelect = document.getElementById('quiz-select');
  if (quizSelect) {
    quizSelect.addEventListener('change', handleQuizSelect);
  }

  // Set initial direction text
  if (app) {
    updateDirectionToggleTitle(app);
  }

  // Populate word lists when the page loads
  populateWordLists();
}
