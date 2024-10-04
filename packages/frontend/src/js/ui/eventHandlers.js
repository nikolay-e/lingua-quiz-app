import { QuizManager } from '../quiz/quizManager.js';
import { fetchWordSets, fetchWordLists } from '../quiz/dataHandler.js';
import {
  displayQuestion,
  updateDirectionToggleTitle,
  updateWordSetsDisplay,
} from './displayManager.js';
import { appInstance } from '../app.js';
import { moveToMasteredOneDirection, moveToMasteredVocabulary } from '../quiz/wordSetManager.js';

const quizManager = new QuizManager(appInstance);

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

    await fetchWordSets(appInstance, token, wordListName);

    updateDirectionToggleTitle(appInstance);
    const questionData = quizManager.getNextQuestion();
    displayQuestion(questionData);
    updateWordSetsDisplay(appInstance);
  } catch (error) {
    console.error(`Error loading words for ${wordListName}:`, error);
    setFeedback('Failed to load word set. Please try again.', false);
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
    const startTime = new Date();

    const isAnswerCorrect = quizManager.verifyAnswer(userAnswer, startTime);

    if (isAnswerCorrect) {
      const normalKey = `${appInstance.currentTranslationId}-normal`;
      const reverseKey = `${appInstance.currentTranslationId}-reverse`;
      const normalCorrect =
        appInstance.stats.attemptsPerTranslationIdAndDirection[normalKey]?.correct || 0;
      const reverseCorrect =
        appInstance.stats.attemptsPerTranslationIdAndDirection[reverseKey]?.correct || 0;

      if (
        appInstance.focusTranslationIds.has(appInstance.currentTranslationId) &&
        normalCorrect >= 3
      ) {
        moveToMasteredOneDirection(appInstance, appInstance.currentTranslationId);
      }

      if (
        appInstance.masteredOneDirectionTranslationIds.has(appInstance.currentTranslationId) &&
        reverseCorrect >= 3
      ) {
        moveToMasteredVocabulary(appInstance, appInstance.currentTranslationId);
      }
    }

    const translation = appInstance.quizTranslations.get(appInstance.currentTranslationId);
    if (isAnswerCorrect) {
      setFeedback('Correct!', true);
    } else {
      setFeedback(`Wrong. '${translation.sourceWord}' - '${translation.targetWord}'`, false);
    }

    document.getElementById('source-word-usage').textContent =
      translation.sourceWordUsageExample || 'No example available';
    document.getElementById('target-word-usage').textContent =
      translation.targetWordUsageExample || 'No example available';

    answerInput.value = '';
    answerInput.blur();
    setTimeout(() => {
      answerInput.focus();
    }, 0);

    const questionData = quizManager.getNextQuestion();
    displayQuestion(questionData);
    updateWordSetsDisplay(appInstance);
    answerInput.focus();
  } catch (error) {
    console.error('Error submitting answer:', error);
    setFeedback('An error occurred. Please try again.', false);
  }
}

function handleDirectionToggle() {
  const oldDirection = appInstance.getDirectionText();
  const newDirection = appInstance.toggleDirection();
  if (oldDirection !== newDirection) {
    updateDirectionToggleTitle(appInstance);
    const questionData = quizManager.getNextQuestion();
    displayQuestion(questionData);
    updateWordSetsDisplay(appInstance);
  }
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
    setFeedback('Failed to load word lists. Please try again.', false);
  }
}

export function initEventHandlers() {
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
  updateDirectionToggleTitle(appInstance);

  // Populate word lists when the page loads
  populateWordLists();
}
