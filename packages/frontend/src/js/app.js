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

export function setSourceLanguage(language) {
  sourceLanguage = language;
}

export function setTargetLanguage(language) {
  targetLanguage = language;
}

document.addEventListener('DOMContentLoaded', initAuth);
