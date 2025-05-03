// packages/frontend/src/js/ui/displayManager.js
import { STATUS } from '../constants.js';

export function updateDirectionToggleTitle(app) {
  const directionToggleBtn = document.querySelector('#direction-toggle');
  if (directionToggleBtn) {
    directionToggleBtn.innerHTML = `<i class="fas fa-exchange-alt"></i> ${
      app.quizState.direction === true
        ? `${app.quizState.sourceLanguage} ➔ ${app.quizState.targetLanguage}`
        : `${app.quizState.targetLanguage} ➔ ${app.quizState.sourceLanguage}`
    }`;
  }
}

function updateSetDisplay(elementId, translationSet, app) {
  console.debug(
    `[displayManager] Updating set display for ${elementId} with ${translationSet ? translationSet.size : 'undefined'} items`
  );

  const container = document.getElementById(elementId);
  if (!container) {
    console.error(`[displayManager] updateSetDisplay: Failed to find element with ID ${elementId}`);
    return;
  }

  container.innerHTML = '';

  if (!translationSet) {
    console.error(`[displayManager] Translation set is undefined for ${elementId}`);
    return;
  }

  try {
    const translationArray = [...translationSet];
    console.debug(
      `[displayManager] Processing ${translationArray.length} translations for ${elementId}`
    );

    for (const id of translationArray) {
      if (id === undefined || id === null) {
        console.error(`[displayManager] Invalid translation ID (${id}) in set ${elementId}`);
        continue;
      }

      try {
        const translation = app.quizState.quizTranslations.get(id);
        if (!translation) {
          console.error(
            `[displayManager] Translation with ID ${id} not found in quizTranslations map`
          );
          continue;
        }

        // Check for the specific error condition we're tracking
        if (!translation.sourceWord) {
          console.error(`[displayManager] Translation ${id} is missing sourceWord:`, translation);
          continue;
        }
        if (!translation.targetWord) {
          console.error(`[displayManager] Translation ${id} is missing targetWord:`, translation);
          continue;
        }

        const listItem = document.createElement('li');
        listItem.textContent = `${translation.sourceWord} (${translation.targetWord})`;
        container.append(listItem);
      } catch (itemError) {
        console.error(`[displayManager] Error processing translation ${id}:`, itemError);
      }
    }

    console.debug(
      `[displayManager] Successfully updated ${elementId} with ${container.children.length} items`
    );
  } catch (error) {
    console.error(`[displayManager] Error in updateSetDisplay for ${elementId}:`, error);
    console.error(`[displayManager] Error stack:`, error.stack);
  }
}

export function updateWordSetsDisplay(app) {
  console.debug('[displayManager] Updating word sets display');

  if (!app) {
    console.error('[displayManager] App is null or undefined in updateWordSetsDisplay');
    return;
  }

  // Check for wordStatusSets in either app directly or in app.quizState
  const wordStatusSets = app.quizState?.wordStatusSets || app.wordStatusSets;

  if (!wordStatusSets) {
    console.error('[displayManager] wordStatusSets not found in app or app.quizState');
    // Dump app structure to debug
    try {
      console.error('[displayManager] App properties:', Object.keys(app));
      if (app.quizState) {
        console.error('[displayManager] QuizState properties:', Object.keys(app.quizState));
      }
    } catch (error) {
      console.error('[displayManager] Failed to log app properties:', error);
    }
    return;
  }

  try {
    // Use the correct wordStatusSets reference
    updateSetDisplay('level-1-list', wordStatusSets[STATUS.LEVEL_1], app);
    updateSetDisplay('level-2-list', wordStatusSets[STATUS.LEVEL_2], app);
    updateSetDisplay('level-3-list', wordStatusSets[STATUS.LEVEL_3], app);
    updateSetDisplay('level-0-list', wordStatusSets[STATUS.LEVEL_0], app);
    console.debug('[displayManager] All word sets updated successfully');
  } catch (error) {
    console.error('[displayManager] Error in updateWordSetsDisplay:', error);
    console.error('[displayManager] Error stack:', error.stack);
  }
}

export function displayQuestion(questionData) {
  console.debug(`[displayManager] Displaying question:`, questionData);

  const wordElement = document.querySelector('#word');
  if (!wordElement) {
    console.error('[displayManager] Word element not found');
    return;
  }

  try {
    if (!questionData) {
      wordElement.textContent = 'No more questions available.';
      console.debug('[displayManager] No question data, showing "No more questions available"');
      return;
    }

    // Check for the specific error condition with 'source' property
    if (questionData.word === undefined) {
      console.error('[displayManager] Question data missing word property:', questionData);
      wordElement.textContent = 'Error: Invalid question data';
      return;
    }

    wordElement.textContent = questionData.word;
    console.debug(`[displayManager] Displayed question word: "${questionData.word}"`);
  } catch (error) {
    console.error('[displayManager] Error displaying question:', error);
    console.error('[displayManager] Error stack:', error.stack);
    wordElement.textContent = 'Error displaying question';
  }
}
