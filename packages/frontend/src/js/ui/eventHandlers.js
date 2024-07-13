// js/ui/eventHandlers.js

import { initializeQuiz, verifyAnswer, continueQuiz } from '../quiz/quizManager.js';
import { generateCSV } from '../quiz/csvHandler.js';
import { quizWords, setDirection, direction } from '../app.js';
import { updateStatsDisplay, updateWordSetsDisplay } from './displayManager.js';

async function loadWords(filename) {
  try {
    const response = await fetch(`data/${filename}`);
    const data = await response.text();
    const startTime = initializeQuiz(data);
    if (startTime) {
      updateStatsDisplay();
      updateWordSetsDisplay();
    }
  } catch (error) {
    console.error(`Error loading ${filename}:`, error);
  }
}

async function handleFileUpload() {
  const file = document.getElementById('file-input').files[0];
  if (file) {
    try {
      const data = await file.text();
      const startTime = initializeQuiz(data);
      if (startTime) {
        updateStatsDisplay();
        updateWordSetsDisplay();
      }
    } catch (error) {
      console.error('Error reading file:', error);
    }
  }
}

function handleEnterKey(event) {
  if (event.key === 'Enter') {
    event.preventDefault();
    document.getElementById('submit').click();
  }
}

function submitAnswer() {
  const userAnswer = document.getElementById('answer').value;
  const originalWord = document.getElementById('word').textContent;
  const startTime = new Date(); // Get the current time as the start time
  const isAnswerCorrect = verifyAnswer(userAnswer, startTime);

  const feedbackElement = document.getElementById('feedback');
  if (isAnswerCorrect) {
    feedbackElement.textContent = 'Correct!';
    feedbackElement.classList.remove('error');
    feedbackElement.classList.add('success');
  } else {
    const translation = direction ? quizWords.get(originalWord) : quizWords.getKey(originalWord);
    feedbackElement.textContent = `Wrong. '${originalWord}' - '${translation}'`;
    feedbackElement.classList.remove('success');
    feedbackElement.classList.add('error');
  }

  document.getElementById('answer').value = '';
  continueQuiz();
  updateStatsDisplay();
  updateWordSetsDisplay();
  document.getElementById('answer').focus();
}

function handleDirectionSwitch() {
  const switchElement = document.getElementById('direction-switch');
  const label = document.getElementById('direction-label');
  const newDirection = switchElement.checked;
  setDirection(!newDirection); // Reverse the direction
  label.textContent = newDirection ? 'Reverse' : 'Normal';
  continueQuiz();
  updateWordSetsDisplay();
}

document.addEventListener('DOMContentLoaded', () => {
  document
    .getElementById('spanish-english')
    .addEventListener('click', () => loadWords('SpanishEnglish.csv'));
  document
    .getElementById('spanish-russian')
    .addEventListener('click', () => loadWords('SpanishRussian.csv'));
  document
    .getElementById('german-russian')
    .addEventListener('click', () => loadWords('GermanRussian.csv'));
  document
    .getElementById('treasure-island-english-russian')
    .addEventListener('click', () => loadWords('TreasureIslandEnglishRussian.csv'));
  document.getElementById('file-input').addEventListener('change', handleFileUpload);
  document.getElementById('answer').addEventListener('keydown', handleEnterKey);
  document.getElementById('submit').addEventListener('click', submitAnswer);
  document.getElementById('download-quiz').addEventListener('click', generateCSV);
  document.getElementById('direction-switch').addEventListener('change', handleDirectionSwitch);
});
