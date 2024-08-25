import { initializeQuiz, verifyAnswer, continueQuiz } from '../quiz/quizManager.js';
import { saveQuizState, fetchWordSets } from '../quiz/dataHandler.js';
import { quizTranslations, setDirection, currentTranslationId } from '../app.js';
import { updateStatsDisplay, updateWordSetsDisplay } from './displayManager.js';

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

function setLoadingState(isLoading) {
  const loadingElement = document.getElementById('loading-indicator');
  if (loadingElement) {
    loadingElement.style.display = isLoading ? 'block' : 'none';
  } else {
    console.error('Loading indicator element not found');
  }
}

async function loadWordsFromAPI(wordListName) {
  setLoadingState(true);
  try {
    const token = localStorage.getItem('token');
    if (!token) {
      throw new Error('User is not authenticated');
    }

    await fetchWordSets(token, wordListName);
    const startTime = initializeQuiz();
    if (startTime) {
      updateStatsDisplay();
      updateWordSetsDisplay();
    }
  } catch (error) {
    console.error(`Error loading words for ${wordListName}:`, error);
    setFeedback(`Failed to load word set. Please try again.`, true);
  } finally {
    setLoadingState(false);
  }
}

async function handleSaveQuiz() {
  setLoadingState(true);
  try {
    const token = localStorage.getItem('token');
    if (!token) {
      throw new Error('User is not authenticated');
    }

    const wordSets = Array.from(quizTranslations.values());
    await saveQuizState(token, wordSets);
    setFeedback('Quiz state saved successfully.', false);
  } catch (error) {
    console.error('Error saving quiz state:', error);
    setFeedback('Failed to save quiz state. Please try again.', true);
  } finally {
    setLoadingState(false);
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

function submitAnswer() {
  const answerInput = document.getElementById('answer');

  if (!answerInput) {
    console.error('Answer input not found');
    return;
  }

  const userAnswer = answerInput.value;
  const startTime = new Date();
  const isAnswerCorrect = verifyAnswer(userAnswer, startTime);

  if (isAnswerCorrect) {
    setFeedback('Correct!', false);
  } else {
    const translation = quizTranslations.get(currentTranslationId);
    setFeedback(`Wrong. '${translation.source_word}' - '${translation.target_word}'`, true);
  }

  answerInput.value = '';
  continueQuiz();
  updateStatsDisplay();
  updateWordSetsDisplay();
  answerInput.focus();
}

function handleDirectionSwitch() {
  const switchElement = document.getElementById('direction-switch');
  const label = document.getElementById('direction-label');

  if (!switchElement || !label) {
    console.error('Direction switch or label not found');
    return;
  }

  const newDirection = switchElement.checked;
  setDirection(!newDirection); // Reverse the direction
  label.textContent = newDirection ? 'Reverse' : 'Normal';
  continueQuiz();
  updateWordSetsDisplay();
}

document.addEventListener('DOMContentLoaded', () => {
  const elements = {
    'spanish-russian': () => loadWordsFromAPI('spanish-russian'),
    'test-spanish': () => loadWordsFromAPI('Test Spanish'),
    'treasure-island-english-russian': () => loadWordsFromAPI('treasure-island-english-russian'),
    answer: (e) => handleEnterKey(e),
    submit: submitAnswer,
    'save-quiz': handleSaveQuiz,
    'direction-switch': handleDirectionSwitch,
  };

  Object.entries(elements).forEach(([id, handler]) => {
    const element = document.getElementById(id);
    if (element) {
      if (id === 'answer') {
        element.addEventListener('keydown', handler);
      } else if (id === 'direction-switch') {
        element.addEventListener('change', handler);
      } else {
        element.addEventListener('click', handler);
      }
    } else {
      console.error(`Element with id '${id}' not found`);
    }
  });
});
