// ui/displayManager.js

import { stats } from '../utils/statsManager.js';
import {
  quizWords,
  focusWordsSet,
  masteredOneDirectionSet,
  masteredVocabularySet,
  upcomingWordsSet,
  currentWord,
  direction,
} from '../app.js';

function updateSetDisplay(elementId, wordSet) {
  const container = document.getElementById(elementId);
  if (!container) {
    console.error('updateSetDisplay: Failed to find element with ID', elementId);
    return;
  }

  container.innerHTML = '';

  const wordsArray = Array.from(wordSet);
  if (elementId === 'focus-words-list' && stats && stats.incorrectPerWord) {
    wordsArray.sort((a, b) => (stats.incorrectPerWord[a] || 0) - (stats.incorrectPerWord[b] || 0));
  }

  wordsArray.forEach((word) => {
    const listItem = document.createElement('li');
    const translation = direction
      ? quizWords.get(word)
      : quizWords.getKey(word) || 'No translation available';
    const displayText =
      elementId === 'focus-words-list' && word === currentWord
        ? `${word} (translation hidden)`
        : `${word} (${translation})`;
    listItem.textContent = displayText;
    container.appendChild(listItem);
  });
}

export function updateStatsDisplay() {
  const elements = {
    'total-attempts': stats.totalAttempts,
    'correct-answers': stats.correctAnswers,
    'incorrect-answers': stats.incorrectAnswers,
    'correct-percentage': `${((stats.correctAnswers / stats.totalAttempts) * 100).toFixed(2)}%`,
    'average-time': (
      stats.timePerQuestion.reduce((a, b) => a + b, 0) / stats.timePerQuestion.length
    ).toFixed(2),
  };

  Object.entries(elements).forEach(([id, value]) => {
    document.getElementById(id).textContent = value;
  });
}

export function updateWordSetsDisplay() {
  updateSetDisplay('focus-words-list', focusWordsSet);
  updateSetDisplay('mastered-one-direction-list', masteredOneDirectionSet);
  updateSetDisplay('mastered-vocabulary-list', masteredVocabularySet);
  updateSetDisplay('upcoming-words-list', upcomingWordsSet);
}
