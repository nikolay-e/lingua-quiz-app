import { STATUS } from '../app.js';

export function updateDirectionToggleTitle(app) {
  const directionToggleBtn = document.getElementById('direction-toggle');
  if (directionToggleBtn) {
    directionToggleBtn.innerHTML = `<i class="fas fa-exchange-alt"></i> ${
      app.direction === true
        ? `${app.sourceLanguage} ➔ ${app.targetLanguage}`
        : `${app.targetLanguage} ➔ ${app.sourceLanguage}`
    }`;
  }
}

function updateSetDisplay(elementId, translationSet, app) {
  const container = document.getElementById(elementId);
  if (!container) {
    console.error('updateSetDisplay: Failed to find element with ID', elementId);
    return;
  }

  container.innerHTML = '';

  const translationArray = Array.from(translationSet);
  translationArray.forEach((id) => {
    const translation = app.quizTranslations.get(id);
    const listItem = document.createElement('li');
    listItem.textContent = `${translation.sourceWord} (${translation.targetWord})`;
    container.appendChild(listItem);
  });
}

export function updateWordSetsDisplay(app) {
  updateSetDisplay('level-1-list', app.wordStatusSets[STATUS.FOCUS], app);
  updateSetDisplay('level-2-list', app.wordStatusSets[STATUS.MASTERED_ONE_DIRECTION], app);
  updateSetDisplay('level-3-list', app.wordStatusSets[STATUS.MASTERED_VOCABULARY], app);
  updateSetDisplay('level-0-list', app.wordStatusSets[STATUS.UPCOMING], app);
}

export function displayQuestion(questionData) {
  const wordElement = document.getElementById('word');
  if (wordElement) {
    wordElement.textContent = questionData ? questionData.word : 'No more questions available.';
  } else {
    console.error('Word element not found');
  }
}
