import serverAddress from '../config.js';
import { STATUS } from '../constants.js'; // *** ADDED: Import STATUS constants ***
import {
  displayQuestion,
  updateDirectionToggleTitle,
  updateWordSetsDisplay,
} from './displayManager.js';
import { fetchWordSets, fetchWordLists } from '../quiz/dataHandler.js';
import { saveQuizState } from '../quiz/wordSetManager.js';
import { AuthUtils } from '../utils/authUtils.js';
import { errorHandler } from '../utils/errorHandler.js';

let app = null; // The single instance of our App class

function setFeedback(message, isSuccess = true) {
  const feedbackElement = document.querySelector('#feedback');
  if (!feedbackElement) {
    console.error('Feedback container element not found');
    return;
  }
  const feedbackMessage = feedbackElement.querySelector('.feedback-message');
  const feedbackIcon = feedbackElement.querySelector('.feedback-icon');

  if (!feedbackMessage || !feedbackIcon) {
    console.error('Feedback message or icon span not found');
    return;
  }

  feedbackMessage.textContent = message;
  feedbackElement.className = isSuccess ? 'feedback-text success' : 'feedback-text error';
  feedbackIcon.textContent = isSuccess ? '✓' : '✗';
  feedbackIcon.className = isSuccess ? 'feedback-icon success-icon' : 'feedback-icon error-icon';

  feedbackElement.style.display = message ? 'flex' : 'none';
  feedbackElement.style.opacity = '1';

  setTimeout(() => {
    if (feedbackMessage.textContent === message) {
      feedbackElement.style.opacity = '0';
      setTimeout(() => {
        if (feedbackElement.style.opacity === '0') {
          feedbackElement.style.display = 'none';
          feedbackMessage.textContent = '';
          feedbackIcon.textContent = '';
        }
      }, 300);
    }
  }, 5000);
}

function displayUsageExamples(examples) {
  const sourceUsageEl = document.querySelector('#source-word-usage');
  const targetUsageEl = document.querySelector('#target-word-usage');
  const examplesContainer = document.querySelector('#usage-examples');
  const feedbackContainer = document.querySelector('.feedback-container');

  if (!sourceUsageEl || !targetUsageEl || !examplesContainer || !feedbackContainer) {
    console.error('Usage example elements not found');
    return;
  }

  // Defensive programming: handle null/undefined examples properly
  if (!examples) {
    sourceUsageEl.textContent = 'N/A';
    targetUsageEl.textContent = 'N/A';
    examplesContainer.style.display = 'none';
    feedbackContainer.classList.remove('has-examples');
    return;
  }

  // Now we know examples is defined, safely check for source/target
  const hasSource = examples.source && examples.source !== 'No source example available';
  const hasTarget = examples.target && examples.target !== 'No target example available';

  // Use optional chaining to safely access properties
  sourceUsageEl.textContent = examples.source || 'N/A';
  targetUsageEl.textContent = examples.target || 'N/A';

  if (hasSource || hasTarget) {
    examplesContainer.style.display = 'block';
    feedbackContainer.classList.add('has-examples');
  } else {
    examplesContainer.style.display = 'none';
    feedbackContainer.classList.remove('has-examples');
  }
}

async function loadWordsFromAPI(wordListName) {
  console.debug(`[eventHandlers] Loading words for "${wordListName}"`);
  displayQuestion({ word: 'Loading...' });
  setFeedback('');
  // Properly handle the case where we have no usage examples yet
  displayUsageExamples({ source: 'N/A', target: 'N/A' });
  updateWordSetsDisplay({
    wordStatusSets: {
      [STATUS.LEVEL_0]: new Set(), // Use STATUS directly
      [STATUS.LEVEL_1]: new Set(),
      [STATUS.LEVEL_2]: new Set(),
      [STATUS.LEVEL_3]: new Set(),
    },
    quizTranslations: new Map(),
  });

  try {
    // Check authentication and handle token expiration in one atomic operation
    if (AuthUtils.handleTokenExpiration() === false) {
      console.error('[eventHandlers] Attempted to load words but user is not authenticated.');
      setFeedback('Please log in to access quizzes.', false);
      return;
    }

    // Get token after handling expiration to ensure it's still valid
    const token = AuthUtils.getToken();
    console.debug(`[eventHandlers] Token present: ${!!token}`);

    // Debug log word list name encoding
    const encodedWordListName = encodeURIComponent(wordListName);
    console.debug(
      `[eventHandlers] Encoded word list name: "${wordListName}" -> "${encodedWordListName}"`
    );

    app = await fetchWordSets(token, wordListName);

    if (!app) {
      console.error('[eventHandlers] Failed to initialize app instance after fetching word sets.');
      setFeedback('Error loading quiz data. Please try another quiz.', false);
      displayQuestion({ word: 'Error Loading Quiz' });
      return;
    }

    console.debug(`[eventHandlers] App created successfully: ${!!app}`);

    // Debug log app status
    console.debug(
      `[eventHandlers] App wordStatusSets sizes:`,
      Object.entries(app.currentWordStatusSets)
        .map(([k, v]) => `${k}: ${v.size}`)
        .join(', ')
    );

    updateDirectionToggleTitle(app);
    const questionData = app.getNextQuestion();
    console.debug(`[eventHandlers] Next question data:`, questionData);

    displayQuestion(questionData);
    updateWordSetsDisplay(app);
    setFeedback('');
    document.querySelector('#answer')?.focus();
  } catch (error) {
    console.error(`[eventHandlers] Error loading words for "${wordListName}":`, error);
    errorHandler.handleApiError(error);
    setFeedback('Failed to load quiz. Please try again or select another quiz.', false);
    displayQuestion({ word: 'Load Error' });
    document.querySelector('#answer')?.setAttribute('disabled', 'true');
    document.querySelector('#submit')?.setAttribute('disabled', 'true');
    document.querySelector('#direction-toggle')?.setAttribute('disabled', 'true');
  }
}

function handleEnterKey(event) {
  if (event.key === 'Enter' && !event.shiftKey && !event.ctrlKey && !event.altKey) {
    event.preventDefault();
    const submitButton = document.querySelector('#submit');
    if (submitButton && !submitButton.disabled) {
      submitButton.click();
    }
  }
}

async function submitAnswer() {
  const answerInput = document.querySelector('#answer');
  const submitButton = document.querySelector('#submit');

  if (!answerInput || !app) {
    console.error('Answer input not found or app not initialized');
    setFeedback('Cannot submit answer. App not ready.', false);
    return;
  }

  if (app.quizState.currentTranslationId === null) {
    const nextQ = app.getNextQuestion();
    if (!nextQ) {
      setFeedback('Quiz finished! Select another or review.', true);
      displayQuestion(null);
      displayUsageExamples({ source: 'N/A', target: 'N/A' });
      return;
    }
    app.quizState.currentTranslationId = nextQ.translationId;
    displayQuestion(nextQ);
  }

  const userAnswer = answerInput.value;

  answerInput.disabled = true;
  if (submitButton) submitButton.disabled = true;
  setFeedback('Checking...', true);

  await new Promise((resolve) => setTimeout(resolve, 50));

  try {
    const { feedback, usageExamples, questionData, statusChanged } =
      await app.submitAnswer(userAnswer);

    setFeedback(feedback.message, feedback.isSuccess);
    displayUsageExamples(usageExamples);
    displayQuestion(questionData);
    updateWordSetsDisplay(app);

    answerInput.value = '';

    if (statusChanged) {
      // Handle token validation, clearing, and redirection in one atomic operation
      if (AuthUtils.handleTokenExpiration() === false) {
        console.warn('Cannot save state: token invalid/expired.');
        return;
      }

      // Get token after validation to ensure it's still valid
      const token = AuthUtils.getToken();
      saveQuizState(app, token).catch((saveError) => {
        console.error('Background save quiz state failed:', saveError);
        errorHandler.handleApiError(saveError);
      });
    }

    if (questionData === null) {
      const finished =
        app.quizState.wordStatusSets[STATUS.LEVEL_0].size === 0 &&
        app.quizState.wordStatusSets[STATUS.LEVEL_1].size === 0 &&
        app.quizState.wordStatusSets[STATUS.LEVEL_2].size === 0;
      if (finished) {
        setFeedback('Quiz finished! All words mastered.', true);
      } else {
        setFeedback('No more questions in this direction. Try toggling.', true);
      }
    }
  } catch (error) {
    console.error('Error during answer submission or state saving:', error);
    setFeedback('An error occurred. Please try again.', false);
    errorHandler.handleApiError(error);
  } finally {
    answerInput.disabled = false;
    if (submitButton) submitButton.disabled = false;
    const wordElement = document.querySelector('#word');
    if (
      wordElement &&
      wordElement.textContent &&
      !wordElement.textContent.includes('No more questions')
    ) {
      answerInput.focus();
    }
  }
}

function handleDirectionToggle() {
  if (!app) {
    console.warn('Cannot toggle direction, app not initialized.');
    return;
  }
  app.toggleDirection();
  updateDirectionToggleTitle(app);
  const questionData = app.getNextQuestion();
  displayQuestion(questionData);
  updateWordSetsDisplay(app);
  setFeedback('');

  // Use proper empty usage examples
  displayUsageExamples({ source: 'N/A', target: 'N/A' });

  document.querySelector('#answer')?.focus();
}

function handleQuizSelect(event) {
  const selectedQuiz = event.target.value;
  const answerInput = document.querySelector('#answer');
  const submitButton = document.querySelector('#submit');
  const directionButton = document.querySelector('#direction-toggle');

  if (selectedQuiz) {
    if (answerInput) answerInput.disabled = false;
    if (submitButton) submitButton.disabled = false;
    if (directionButton) directionButton.disabled = false;
    loadWordsFromAPI(selectedQuiz);
  } else {
    app = null;
    displayQuestion({ word: '' });
    setFeedback('');
    displayUsageExamples({ source: 'N/A', target: 'N/A' });
    updateWordSetsDisplay({
      wordStatusSets: {
        [STATUS.LEVEL_0]: new Set(),
        [STATUS.LEVEL_1]: new Set(),
        [STATUS.LEVEL_2]: new Set(),
        [STATUS.LEVEL_3]: new Set(),
      },
      quizTranslations: new Map(),
    });
    if (answerInput) answerInput.disabled = true;
    if (submitButton) submitButton.disabled = true;
    if (directionButton) directionButton.disabled = true;
    if (directionButton)
      directionButton.innerHTML = `<i class="fas fa-exchange-alt"></i> Direction`;
  }
}

// --- Delete Account Handler ---
async function handleDeleteAccount() {
  const confirmation = window.confirm(
    'Are you absolutely sure you want to delete your account?\n\nTHIS ACTION CANNOT BE UNDONE.'
  );

  if (!confirmation) {
    return; // User cancelled
  }

  // Check authentication with our encapsulated method
  if (AuthUtils.handleTokenExpiration() === false) {
    errorHandler.showError('You are not logged in.');
    return;
  }

  // Get token after validation
  const token = AuthUtils.getToken();

  const deleteButton = document.querySelector('#delete-account-btn');
  if (deleteButton) deleteButton.disabled = true;
  setFeedback('Deleting account...', true);

  try {
    const response = await fetch(`${serverAddress}/api/auth/delete-account`, {
      method: 'DELETE',
      headers: {
        Authorization: `Bearer ${token}`,
      },
    });

    if (response.ok) {
      // Success!

      alert('Account deleted successfully.');
      // Use AuthUtils to clear auth data and handle redirection
      AuthUtils.clearAuth();
      // After clearing auth, redirect to login page (don't use handleTokenExpiration
      // since we've already deliberately cleared the auth data)
      AuthUtils.redirectToLogin();
    } else {
      const errorData = await response
        .json()
        .catch(() => ({ message: 'Failed to delete account.' }));
      errorHandler.showError(errorData.message || `Error: ${response.status}`);
      if (deleteButton) deleteButton.disabled = false;
      setFeedback('', false);
    }
  } catch (error) {
    console.error('Error deleting account:', error);
    errorHandler.handleApiError(error);
    if (deleteButton) deleteButton.disabled = false;
    setFeedback('', false);
  }
}

export async function populateWordLists() {
  const quizSelect = document.querySelector('#quiz-select');
  if (!quizSelect) {
    console.error('Quiz select element not found.');
    return;
  }
  quizSelect.innerHTML = '<option value="">Loading quizzes...</option>';
  quizSelect.disabled = true;

  try {
    const token = AuthUtils.getToken();
    if (!token) {
      console.warn('Cannot populate word lists: user is not authenticated.');
      quizSelect.innerHTML = '<option value="">Please login</option>';
      return;
    }

    const wordLists = await fetchWordLists(token);

    quizSelect.innerHTML = '<option value="">Select a quiz</option>';

    if (wordLists && wordLists.length > 0) {
      for (const list of wordLists) {
        const option = document.createElement('option');
        option.value = list.name;
        option.textContent = list.name;
        quizSelect.append(option);
      }
      quizSelect.disabled = false;
    } else {
      quizSelect.innerHTML = '<option value="">No quizzes available</option>';
      quizSelect.disabled = true;
    }
  } catch (error) {
    console.error('Error populating word lists:', error);
    errorHandler.handleApiError(error);
    quizSelect.innerHTML = '<option value="">Error loading quizzes</option>';
    quizSelect.disabled = true;
  }
}

export function initEventHandlers() {
  const answerInput = document.querySelector('#answer');
  if (answerInput) {
    answerInput.addEventListener('keydown', handleEnterKey);
    answerInput.disabled = true;
  } else {
    console.error('Answer input element not found during init.');
  }

  const submitButton = document.querySelector('#submit');
  if (submitButton) {
    submitButton.addEventListener('click', submitAnswer);
    submitButton.disabled = true;
  } else {
    console.error('Submit button element not found during init.');
  }

  const directionToggleBtn = document.querySelector('#direction-toggle');
  if (directionToggleBtn) {
    directionToggleBtn.addEventListener('click', handleDirectionToggle);
    directionToggleBtn.disabled = true;
  } else {
    console.error('Direction toggle button element not found during init.');
  }

  const quizSelect = document.querySelector('#quiz-select');
  if (quizSelect) {
    quizSelect.addEventListener('change', handleQuizSelect);
  } else {
    console.error('Quiz select element not found during init.');
  }

  const deleteAccountBtn = document.querySelector('#delete-account-btn');
  if (deleteAccountBtn) {
    deleteAccountBtn.addEventListener('click', handleDeleteAccount);
  } else {
    console.warn('Delete account button not found during init (might be ok if on login page).');
  }

  // Use handleTokenExpiration to check validity, clear if invalid,
  // and redirect if needed - all in one atomic operation
  const isAuthenticated = AuthUtils.handleTokenExpiration();

  if (isAuthenticated) {
    populateWordLists();
  } else {
    const selectElement = document.querySelector('#quiz-select');
    if (selectElement) {
      selectElement.innerHTML = '<option value="">Please login to see quizzes</option>';
      selectElement.disabled = true;
    }
  }
}
