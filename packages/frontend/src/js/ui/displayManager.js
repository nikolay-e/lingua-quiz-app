export function updateDirectionToggleTitle(appState) {
  const directionToggleBtn = document.getElementById('direction-toggle');
  if (directionToggleBtn) {
    directionToggleBtn.innerHTML = `<i class="fas fa-exchange-alt"></i> ${
      appState.direction
        ? `${appState.sourceLanguage} -> ${appState.targetLanguage}`
        : `${appState.targetLanguage} -> ${appState.sourceLanguage}`
    }`;
  }
}

function updateSetDisplay(elementId, translationSet, appState) {
  const container = document.getElementById(elementId);
  if (!container) {
    console.error('updateSetDisplay: Failed to find element with ID', elementId);
    return;
  }

  container.innerHTML = '';

  const translationArray = Array.from(translationSet);
  translationArray.forEach((id) => {
    const translation = appState.quizTranslations.get(id);
    const listItem = document.createElement('li');
    listItem.textContent =
      elementId === 'focus-words-list' && id === appState.currentTranslationId
        ? `${translation.sourceWord} (translation hidden)`
        : `${translation.sourceWord} (${translation.targetWord})`;
    container.appendChild(listItem);
  });
}

export function updateWordSetsDisplay(appState) {
  updateSetDisplay('focus-words-list', appState.focusTranslationIds, appState);
  updateSetDisplay(
    'mastered-one-direction-list',
    appState.masteredOneDirectionTranslationIds,
    appState
  );
  updateSetDisplay('mastered-vocabulary-list', appState.masteredVocabularyTranslationIds, appState);
  updateSetDisplay('upcoming-words-list', appState.upcomingTranslationIds, appState);
}

export function displayQuestion(questionData) {
  const wordElement = document.getElementById('word');
  if (wordElement) {
    wordElement.textContent = questionData.word;
  } else {
    console.error('Word element not found');
  }
}
