import getRandomWordFromTopFew from './wordSetManager.js';
import { updateWordSetsDisplay } from '../ui/displayManager.js';
import { updateStats, getIncorrectPerWord } from '../utils/statsManager.js';
import {
  quizWords,
  focusWordsSet,
  masteredOneDirectionSet,
  setCurrentWord,
  direction,
  setDirection,
} from '../app.js';

function askQuestion() {
  const wordSet = direction ? focusWordsSet : masteredOneDirectionSet;
  const newWord = getRandomWordFromTopFew(wordSet, getIncorrectPerWord());
  setCurrentWord(newWord);
  document.getElementById('word').textContent = direction ? newWord : quizWords.get(newWord);
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
  const displayedWord = document.getElementById('word').textContent;
  const correctAnswer = direction ? quizWords.get(displayedWord) : quizWords.getKey(displayedWord);
  const originalWord = direction ? displayedWord : correctAnswer;

  const normalizedUserAnswer = normalizeAndSortAnswer(userAnswer);
  const normalizedCorrectAnswer = normalizeAndSortAnswer(correctAnswer);

  const isAnswerCorrect = compareAnswers(normalizedUserAnswer, normalizedCorrectAnswer);
  updateStats(isAnswerCorrect, originalWord, startTime, direction);

  return isAnswerCorrect;
}

export function toggleDirection() {
  setDirection(!direction);
  return direction;
}
