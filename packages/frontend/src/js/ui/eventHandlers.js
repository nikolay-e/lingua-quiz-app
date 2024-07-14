// js/ui/eventHandlers.js

import { initializeQuiz, verifyAnswer, continueQuiz } from '../quiz/quizManager.js';
import { generateJSON, parseJSON, validateJSONStructure } from '../quiz/dataHandler.js';
import { quizWords, setDirection, direction } from '../app.js';
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

async function loadWords(filename) {
  setLoadingState(true);
  try {
    const response = await fetch(`data/${filename}`);
    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`);
    }
    const data = await response.json();
    validateJSONStructure(data);
    parseJSON(JSON.stringify(data));
    const startTime = initializeQuiz(data);
    if (startTime) {
      updateStatsDisplay();
      updateWordSetsDisplay();
    }
  } catch (error) {
    console.error(`Error loading ${filename}:`, error);
    setFeedback(`Failed to load ${filename}. Please try again.`, true);
  } finally {
    setLoadingState(false);
  }
}

async function handleFileUpload() {
  const fileInput = document.getElementById('file-input');
  if (!fileInput) {
    console.error('File input element not found');
    return;
  }

  const file = fileInput.files[0];
  if (file) {
    if (file.type !== 'application/json') {
      setFeedback('Please upload a JSON file.', true);
      fileInput.value = ''; // Clear the file input
      return;
    }
    setLoadingState(true);
    try {
      const data = await file.text();
      const jsonData = JSON.parse(data);
      validateJSONStructure(jsonData);
      parseJSON(data);
      const startTime = initializeQuiz(jsonData);
      if (startTime) {
        updateStatsDisplay();
        updateWordSetsDisplay();
      }
    } catch (error) {
      console.error('Error reading file:', error);
      setFeedback(`Error reading file: ${error.message}`, true);
    } finally {
      setLoadingState(false);
      fileInput.value = ''; // Clear the file input
    }
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
  const wordElement = document.getElementById('word');

  if (!answerInput || !wordElement) {
    console.error('Answer input or word element not found');
    return;
  }

  const userAnswer = answerInput.value;
  const originalWord = wordElement.textContent;
  const startTime = new Date();
  const isAnswerCorrect = verifyAnswer(userAnswer, startTime);

  if (isAnswerCorrect) {
    setFeedback('Correct!', false);
  } else {
    const translation = direction ? quizWords.get(originalWord) : quizWords.getKey(originalWord);
    setFeedback(`Wrong. '${originalWord}' - '${translation}'`, true);
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
    'spanish-english': () => loadWords('SpanishEnglish.json'),
    'spanish-russian': () => loadWords('SpanishRussian.json'),
    'german-russian': () => loadWords('GermanRussian.json'),
    'treasure-island-english-russian': () => loadWords('TreasureIslandEnglishRussian.json'),
    'file-input': handleFileUpload,
    answer: (e) => handleEnterKey(e),
    submit: submitAnswer,
    'download-quiz': generateJSON,
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
