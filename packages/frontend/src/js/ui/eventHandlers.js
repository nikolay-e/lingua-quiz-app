import { fetchWordSets, fetchWordLists } from '../quiz/dataHandler.js';
import { saveQuizState } from '../quiz/wordSetManager.js'; // Assume this makes API calls
import { AuthUtils } from '../utils/authUtils.js'; // Import AuthUtils
import { errorHandler } from '../utils/errorHandler.js';

import { displayQuestion, updateDirectionToggleTitle, updateWordSetsDisplay } from './displayManager.js';

let app = null; // The single instance of our App class

function setFeedback(message, isSuccess = true) {
  const feedbackElement = document.getElementById('feedback');
  const feedbackMessage = feedbackElement.querySelector('.feedback-message');
  if (feedbackElement && feedbackMessage) {
    feedbackMessage.textContent = message;
    feedbackElement.className = isSuccess ? 'feedback-text success' : 'feedback-text error';
    // Make feedback visible briefly
    feedbackElement.style.opacity = '1';
    setTimeout(() => {
      // Optional: fade out instead of abrupt hide
      // feedbackElement.style.opacity = '0';
    }, 3000); // Hide after 3 seconds
  } else {
    console.error('Feedback element or message span not found');
  }
}

function displayUsageExamples(examples) {
  const sourceUsageEl = document.getElementById('source-word-usage');
  const targetUsageEl = document.getElementById('target-word-usage');
  const examplesContainer = document.getElementById('usage-examples');

  if (sourceUsageEl && targetUsageEl && examplesContainer) {
    sourceUsageEl.textContent = examples.source;
    targetUsageEl.textContent = examples.target;
    // Show container only if examples exist? Or always show with placeholder text?
    examplesContainer.style.display = 'block'; // Or adjust based on content
  } else {
    console.error('Usage example elements not found');
  }
}

async function loadWordsFromAPI(wordListName) {
  // Basic UI reset/loading state
  displayQuestion({ word: 'Loading...' }); // Show loading state
  setFeedback(''); // Clear previous feedback
  displayUsageExamples({ source: '', target: '' }); // Clear examples
  // Clear lists visually while loading
  updateWordSetsDisplay({
    wordStatusSets: {
      LEVEL_0: new Set(),
      LEVEL_1: new Set(),
      LEVEL_2: new Set(),
      LEVEL_3: new Set(),
    },
  });

  try {
    const token = AuthUtils.getToken(); // Use AuthUtils
    if (!token) {
      console.error('Attempted to load words but user is not authenticated.');
      AuthUtils.redirectToLogin(); // Redirect if no token
      return; // Stop execution
    }

    // Fetch and create the App instance
    app = await fetchWordSets(token, wordListName);

    if (!app) {
      console.error('Failed to initialize app instance after fetching word sets.');
      setFeedback('Error loading quiz data.', false);
      displayQuestion({ word: 'Error' });
      return; // Stop if app creation failed
    }

    updateDirectionToggleTitle(app); // Update direction display
    const questionData = app.getNextQuestion(); // Get the first question
    displayQuestion(questionData); // Display the first question
    updateWordSetsDisplay(app); // Display the initial word lists
    document.getElementById('answer').focus(); // Focus input field
  } catch (error) {
    console.error(`Error loading words for "${wordListName}":`, error);
    errorHandler.handleApiError(error); // Use central error handler
    // Display error to user
    setFeedback('Failed to load quiz. Please try again or select another quiz.', false);
    displayQuestion({ word: 'Load Error' });
  }
}

function handleEnterKey(event) {
  if (event.key === 'Enter') {
    event.preventDefault(); // Prevent form submission if applicable
    const submitButton = document.getElementById('submit');
    if (submitButton) {
      submitButton.click(); // Trigger the submit button's click handler
    } else {
      console.error('Submit button not found');
    }
  }
}

async function submitAnswer() {
  const answerInput = document.getElementById('answer');
  const submitButton = document.getElementById('submit'); // Get button reference

  if (!answerInput || !app) {
    console.error('Answer input not found or app not initialized');
    setFeedback('Cannot submit answer. App not ready.', false);
    return;
  }
  if (app.currentTranslationId === null && !app.getNextQuestion()) {
    setFeedback('Quiz finished or no questions available.', true); // Inform user
    return;
  }

  const userAnswer = answerInput.value;

  // Disable input and button during processing
  answerInput.disabled = true;
  if (submitButton) submitButton.disabled = true;

  try {
    // Call the app logic, which now returns statusChanged
    const { feedback, usageExamples, questionData, statusChanged } = await app.submitAnswer(userAnswer);

    // Update UI immediately with feedback and examples
    setFeedback(feedback.message, feedback.isSuccess);
    displayUsageExamples(usageExamples);

    // Display next question (or end state)
    displayQuestion(questionData); // Handles null questionData internally
    updateWordSetsDisplay(app); // Update lists based on potential status changes

    // Clear input for next answer
    answerInput.value = '';

    // *** Conditionally save state ***
    if (statusChanged) {
      const token = AuthUtils.getToken();
      if (token) {
        // Call saveQuizState without awaiting if background saving is acceptable
        // Await if you need to ensure saving completes before proceeding (might slow UI slightly)
        await saveQuizState(app, token).catch((saveError) => {
          console.error('Error saving quiz state:', saveError);
          // Optionally inform the user about save failure
          // Don't block user interaction due to save error
          errorHandler.handleApiError(saveError); // Log centrally
        });
      } else {
        console.warn('Cannot save state: user token not found.');
        // Handle missing token? Maybe redirect? For now, just warn.
        AuthUtils.redirectToLogin();
      }
    }
  } catch (error) {
    // Catch errors specifically from app.submitAnswer or the save operation
    console.error('Error during answer submission or state saving:', error);
    setFeedback('An error occurred. Please try again.', false);
    errorHandler.handleApiError(error); // Log error centrally
  } finally {
    // Re-enable input and button regardless of success/failure
    answerInput.disabled = false;
    if (submitButton) submitButton.disabled = false;
    // Ensure focus returns to the input field for the next answer
    if (document.activeElement !== answerInput) {
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
  updateDirectionToggleTitle(app); // Update button text
  const questionData = app.getNextQuestion(); // Get question for new direction
  displayQuestion(questionData);
  updateWordSetsDisplay(app); // Update lists (might not change visually, but good practice)
  document.getElementById('answer').focus(); // Keep focus on input
}

function handleQuizSelect(event) {
  const selectedQuiz = event.target.value;
  if (selectedQuiz) {
    // Call the main function to load data for the selected quiz
    loadWordsFromAPI(selectedQuiz);
  } else {
    // Handle case where "Select a quiz" is chosen
    app = null; // Reset app instance
    displayQuestion({ word: '' }); // Clear question
    setFeedback('');
    displayUsageExamples({ source: '', target: '' });
    updateWordSetsDisplay({
      wordStatusSets: {
        LEVEL_0: new Set(),
        LEVEL_1: new Set(),
        LEVEL_2: new Set(),
        LEVEL_3: new Set(),
      },
    }); // Clear lists visually
  }
}

export async function populateWordLists() {
  const quizSelect = document.getElementById('quiz-select');
  if (!quizSelect) {
    console.error('Quiz select element not found.');
    return;
  }
  // Add default option while loading
  quizSelect.innerHTML = '<option value="">Loading quizzes...</option>';
  quizSelect.disabled = true;

  try {
    const token = AuthUtils.getToken();
    if (!token) {
      console.warn('Cannot populate word lists: user is not authenticated.');
      quizSelect.innerHTML = '<option value="">Please login</option>';
      // Don't redirect here, let the main auth check handle it
      return;
    }

    const wordLists = await fetchWordLists(token);

    // Clear loading/error message and add default option
    quizSelect.innerHTML = '<option value="">Select a quiz</option>';

    if (wordLists && wordLists.length > 0) {
      wordLists.forEach((list) => {
        const option = document.createElement('option');
        option.value = list.name;
        option.textContent = list.name;
        quizSelect.appendChild(option);
      });
      quizSelect.disabled = false; // Enable select now that options are loaded
    } else {
      quizSelect.innerHTML = '<option value="">No quizzes found</option>';
    }
  } catch (error) {
    console.error('Error populating word lists:', error);
    errorHandler.handleApiError(error); // Log centrally
    quizSelect.innerHTML = '<option value="">Error loading</option>'; // Show error in select
  }
}

export function initEventHandlers() {
  errorHandler.init(); // Initialize global error display

  const answerInput = document.getElementById('answer');
  if (answerInput) {
    answerInput.addEventListener('keydown', handleEnterKey);
  } else {
    console.error('Answer input element not found during init.');
  }

  const submitButton = document.getElementById('submit');
  if (submitButton) {
    submitButton.addEventListener('click', submitAnswer);
  } else {
    console.error('Submit button element not found during init.');
  }

  const directionToggleBtn = document.getElementById('direction-toggle');
  if (directionToggleBtn) {
    directionToggleBtn.addEventListener('click', handleDirectionToggle);
  } else {
    console.error('Direction toggle button element not found during init.');
  }

  const quizSelect = document.getElementById('quiz-select');
  if (quizSelect) {
    quizSelect.addEventListener('change', handleQuizSelect);
  } else {
    console.error('Quiz select element not found during init.');
  }

  // Populate word lists when the page loads (if authenticated)
  if (AuthUtils.isValidToken(AuthUtils.getToken())) {
    populateWordLists();
  } else {
    // eslint-disable-next-line no-shadow
    const quizSelect = document.getElementById('quiz-select');
    if (quizSelect) quizSelect.innerHTML = '<option value="">Please login</option>';
  }
}
