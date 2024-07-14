// app.js

import BidirectionalMap from './utils/BidirectionalMap.js';

export const quizWords = new BidirectionalMap();
export const focusWordsSet = new Set();
export const masteredOneDirectionSet = new Set();
export const masteredVocabularySet = new Set();
export const upcomingWordsSet = new Set();

export let currentWord = '';
export let sourceLanguage = '';
export let targetLanguage = '';
export let direction = true;

export const supportedLanguages = ['english', 'spanish', 'russian', 'german'];

export function setCurrentWord(word) {
  currentWord = word;
}

export function setDirection(newDirection) {
  direction = newDirection;
}

export function setSourceLanguage(language) {
  sourceLanguage = language;
}

export function setTargetLanguage(language) {
  targetLanguage = language;
}

// Initialize the quiz
document.addEventListener('DOMContentLoaded', () => {
  // Add initialization code here
});
