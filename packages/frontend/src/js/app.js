import initAuth from './ui/loginManager.js';

export const quizTranslations = new Map();
export const focusTranslationIds = new Set();
export const masteredOneDirectionTranslationIds = new Set();
export const masteredVocabularyTranslationIds = new Set();
export const upcomingTranslationIds = new Set();

export let currentTranslationId = null;
export let sourceLanguage = '';
export let targetLanguage = '';
export let direction = true;

export function setCurrentTranslationId(id) {
  currentTranslationId = id;
}

export function setDirection(newDirection) {
  direction = newDirection;
}

export function updateDirectionToggleTitle() {
  const directionToggleBtn = document.getElementById('direction-toggle');
  // eslint-disable-next-line max-len
  directionToggleBtn.innerHTML = `<i class="fas fa-exchange-alt"></i> ${direction ? `${sourceLanguage} -> ${targetLanguage}` : `${targetLanguage} -> ${sourceLanguage}`}`;
}

export function toggleDirection() {
  if (masteredOneDirectionTranslationIds.size === 0) {
    direction = true;
    return 'Normal';
  }

  direction = !direction;
  updateDirectionToggleTitle();
  return direction ? 'Normal' : 'Reverse';
}

export function getDirectionText() {
  return direction ? 'Normal' : 'Reverse';
}

export function setSourceLanguage(language) {
  sourceLanguage = language;
}

export function setTargetLanguage(language) {
  targetLanguage = language;
}

document.addEventListener('DOMContentLoaded', initAuth);
