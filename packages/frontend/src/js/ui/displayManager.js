import { stats } from '../utils/statsManager.js';
import {
  quizTranslations,
  focusTranslationIds,
  masteredOneDirectionTranslationIds,
  masteredVocabularyTranslationIds,
  upcomingTranslationIds,
  currentTranslationId,
} from '../app.js';

function updateSetDisplay(elementId, translationSet) {
  const container = document.getElementById(elementId);
  if (!container) {
    console.error('updateSetDisplay: Failed to find element with ID', elementId);
    return;
  }

  container.innerHTML = '';

  const translationArray = Array.from(translationSet);
  translationArray.forEach((id) => {
    const translation = quizTranslations.get(id);
    const listItem = document.createElement('li');
    const displayText =
      elementId === 'focus-words-list' && id === currentTranslationId
        ? `${translation.source_word} (translation hidden)`
        : `${translation.source_word} (${translation.target_word})`;
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
  updateSetDisplay('focus-words-list', focusTranslationIds);
  updateSetDisplay('mastered-one-direction-list', masteredOneDirectionTranslationIds);
  updateSetDisplay('mastered-vocabulary-list', masteredVocabularyTranslationIds);
  updateSetDisplay('upcoming-words-list', upcomingTranslationIds);
}
