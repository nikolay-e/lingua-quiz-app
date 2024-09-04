import { App } from '../src/js/app.js';
import { updateDirectionToggleTitle, updateWordSetsDisplay } from '../src/js/ui/displayManager.js';

describe('DisplayManager Functions', () => {
  let appState;

  beforeEach(() => {
    appState = new App();
    document.body.innerHTML = `
      <button id="direction-toggle"></button>
      <ul id="focus-words-list"></ul>
      <ul id="mastered-one-direction-list"></ul>
      <ul id="mastered-vocabulary-list"></ul>
      <ul id="upcoming-words-list"></ul>
    `;
  });

  it('should update direction toggle title', () => {
    appState.sourceLanguage = 'English';
    appState.targetLanguage = 'Spanish';
    appState.direction = true;

    updateDirectionToggleTitle(appState);

    const directionToggleBtn = document.getElementById('direction-toggle');
    expect(directionToggleBtn.innerHTML).toContain('English -&gt; Spanish');
  });

  it('should update word sets display', () => {
    // Set up quizTranslations and focusTranslationIds
    appState.quizTranslations.set(1, {
      wordPairId: 1,
      sourceWord: 'hello',
      targetWord: 'hola',
    });
    appState.focusTranslationIds.add(1);

    updateWordSetsDisplay(appState);

    const focusWordsList = document.getElementById('focus-words-list');
    expect(focusWordsList.innerHTML).toContain('hello (hola)');

    // Other lists should be empty
    const masteredOneDirectionList = document.getElementById('mastered-one-direction-list');
    const masteredVocabularyList = document.getElementById('mastered-vocabulary-list');
    const upcomingWordsList = document.getElementById('upcoming-words-list');

    expect(masteredOneDirectionList.innerHTML).toBe('');
    expect(masteredVocabularyList.innerHTML).toBe('');
    expect(upcomingWordsList.innerHTML).toBe('');
  });

  it('should handle missing DOM elements gracefully', () => {
    document.body.innerHTML = ''; // Remove all elements
    expect(() => updateWordSetsDisplay(appState)).not.toThrow();
  });
});
