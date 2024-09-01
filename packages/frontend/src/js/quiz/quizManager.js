import getRandomTranslationIdFromTopFew from './wordSetManager.js';
import { updateWordSetsDisplay } from '../ui/displayManager.js';
import { updateStats } from '../utils/statsManager.js';
import {
  quizTranslations,
  focusTranslationIds,
  masteredOneDirectionTranslationIds,
  currentTranslationId,
  setCurrentTranslationId,
  direction,
  setDirection,
} from '../app.js';

function askQuestion() {
  const translationSet = direction ? focusTranslationIds : masteredOneDirectionTranslationIds;
  const newTranslationId = getRandomTranslationIdFromTopFew(translationSet);
  setCurrentTranslationId(newTranslationId);
  const translation = quizTranslations.get(newTranslationId);
  document.getElementById('word').textContent = direction
    ? translation.source_word
    : translation.target_word;

  return new Date();
}

export function initializeQuiz() {
  try {
    const startTime = askQuestion();
    updateWordSetsDisplay();
    return startTime;
  } catch (error) {
    console.error('Error initializing quiz:', error);
    return null;
  }
}

export function continueQuiz() {
  const startTime = askQuestion();
  updateWordSetsDisplay();
  return startTime;
}

function normalizeAndSortAnswer(answer) {
  return answer
    .toLowerCase()
    .split(',')
    .map((item) => item.trim().replace(/[^\p{Letter}]/gu, ''))
    .filter((item) => item.length > 0)
    .sort();
}

function compareAnswers(arr1, arr2) {
  return arr1.length === arr2.length && arr1.every((value, index) => value === arr2[index]);
}

export function verifyAnswer(userAnswer, startTime) {
  const translation = quizTranslations.get(currentTranslationId);
  const correctAnswer = direction ? translation.target_word : translation.source_word;

  const normalizedUserAnswer = normalizeAndSortAnswer(userAnswer);
  const normalizedCorrectAnswer = normalizeAndSortAnswer(correctAnswer);

  const isAnswerCorrect = compareAnswers(normalizedUserAnswer, normalizedCorrectAnswer);
  updateStats(isAnswerCorrect, currentTranslationId, startTime, direction);

  return isAnswerCorrect;
}

export function toggleDirection() {
  setDirection(!direction);
  return direction;
}
