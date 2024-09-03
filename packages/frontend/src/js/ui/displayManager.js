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

// eslint-disable-next-line import/prefer-default-export
export function updateWordSetsDisplay() {
  updateSetDisplay('focus-words-list', focusTranslationIds);
  updateSetDisplay('mastered-one-direction-list', masteredOneDirectionTranslationIds);
  updateSetDisplay('mastered-vocabulary-list', masteredVocabularyTranslationIds);
  updateSetDisplay('upcoming-words-list', upcomingTranslationIds);
}
