import { initializeQuiz, verifyAnswer, continueQuiz } from '../quiz/quizManager.js';
import { saveQuizState, fetchWordSets } from '../quiz/dataHandler.js';
import {
  currentTranslationId,
  quizTranslations,
  toggleDirection,
  getDirectionText,
  updateDirectionToggleTitle,
} from '../app.js';
import { updateWordSetsDisplay } from './displayManager.js';

function setFeedback(message, isError = false) {
  const feedbackElement = document.getElementById('feedback');
  if (feedbackElement) {
    feedbackElement.textContent = message;
    feedbackElement.classList.toggle('error', isError);
    feedbackElement.classList.toggle('success', !isError);
  } else {
    console.error('Feedback element not found');
  }
}

async function loadWordsFromAPI(wordListName) {
  try {
    const token = localStorage.getItem('token');
    if (!token) {
      throw new Error('User is not authenticated');
    }

    await fetchWordSets(token, wordListName);
    const startTime = initializeQuiz();
    if (startTime) {
      updateWordSetsDisplay();
    }
  } catch (error) {
    console.error(`Error loading words for ${wordListName}:`, error);
    setFeedback(`Failed to load word set. Please try again.`, true);
  }
}

async function handleSaveQuiz() {
  try {
    const token = localStorage.getItem('token');
    if (!token) {
      throw new Error('User is not authenticated');
    }

    await saveQuizState(token);
  } catch (error) {
    console.error('Error saving quiz state:', error);
    setFeedback('Failed to save quiz state. Please try again.', true);
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
  const answerInput = document.getElementById('answer');

  if (!answerInput) {
    console.error('Answer input not found');
    return;
  }

  const userAnswer = answerInput.value;
  const startTime = new Date();
  const isAnswerCorrect = verifyAnswer(userAnswer, startTime);

  const translation = quizTranslations.get(currentTranslationId);
  if (isAnswerCorrect) {
    setFeedback('Correct!', false);
  } else {
    setFeedback(`Wrong. '${translation.source_word}' - '${translation.target_word}'`, true);
  }

  document.getElementById('source-word-usage').textContent =
    translation.source_word_usage_example || 'No example available';
  document.getElementById('target-word-usage').textContent =
    translation.target_word_usage_example || 'No example available';

  answerInput.value = '';

  answerInput.blur();
  setTimeout(() => {
    answerInput.focus();
  }, 0);

  await continueQuiz();
  updateWordSetsDisplay();
  answerInput.focus();

  // Automatically save quiz state after each answer
  await handleSaveQuiz();
}

function handleDirectionToggle() {
  const oldDirection = getDirectionText();
  const newDirection = toggleDirection();
  if (oldDirection !== newDirection) {
    // eslint-disable-next-line max-len
    updateDirectionToggleTitle();
    continueQuiz();
    updateWordSetsDisplay();
  }
}

function handleQuizSelect(event) {
  const selectedQuiz = event.target.value;
  if (selectedQuiz) {
    loadWordsFromAPI(selectedQuiz);
  }
}

document.addEventListener('DOMContentLoaded', () => {
  const elements = {
    'quiz-select': (e) => handleQuizSelect(e),
    answer: (e) => handleEnterKey(e),
    submit: submitAnswer,
    'direction-toggle': handleDirectionToggle,
  };

  Object.entries(elements).forEach(([id, handler]) => {
    const element = document.getElementById(id);
    if (element) {
      if (id === 'answer') {
        element.addEventListener('keydown', handler);
      } else if (id === 'direction-toggle' || id === 'quiz-select') {
        element.addEventListener('click', handler);
      } else {
        element.addEventListener('click', handler);
      }
    } else {
      console.error(`Element with id '${id}' not found`);
    }
  });

  // Set initial direction text
  const directionToggleBtn = document.getElementById('direction-toggle');
  if (directionToggleBtn) {
    // eslint-disable-next-line max-len
    directionToggleBtn.innerHTML = `<i class="fas fa-exchange-alt"></i> ${getDirectionText()} Direction`;
  }
});
