import serverAddress from '../config.js';
import { moveToFocusWords, saveQuizState } from './wordSetManager.js';

export function parseData(appState, data) {
  if (!data || !Array.isArray(data)) {
    throw new Error('Invalid data structure in JSON');
  }

  const existingStatuses = new Map();
  appState.quizTranslations.forEach((value, key) => {
    existingStatuses.set(key, value.status);
  });

  // Clear current state
  appState.quizTranslations.clear();
  [
    appState.focusTranslationIds,
    appState.masteredOneDirectionTranslationIds,
    appState.masteredVocabularyTranslationIds,
    appState.upcomingTranslationIds,
  ].forEach((set) => set.clear());

  if (data.length < 1) {
    throw new Error('At least two supported languages must be present in the data');
  }

  appState.setSourceLanguage(data[0].sourceLanguage);
  appState.setTargetLanguage(data[0].targetLanguage);

  data.forEach((originalEntry) => {
    if (typeof originalEntry === 'object') {
      const existingStatus = existingStatuses.get(originalEntry.wordPairId);
      const updatedEntry = { ...originalEntry, status: existingStatus || originalEntry.status };

      appState.quizTranslations.set(updatedEntry.wordPairId, updatedEntry);

      const currentSet = {
        'Focus Words': appState.focusTranslationIds,
        'Mastered One Direction': appState.masteredOneDirectionTranslationIds,
        'Mastered Vocabulary': appState.masteredVocabularyTranslationIds,
        'Upcoming Words': appState.upcomingTranslationIds,
      }[updatedEntry.status];

      if (currentSet) currentSet.add(updatedEntry.wordPairId);
    } else {
      console.warn('Invalid word entry:', originalEntry);
    }
  });

  if (appState.quizTranslations.size === 0) {
    throw new Error('No valid entries added to quizTranslations');
  }

  // Ensure Focus Words has at least 20 words if possible
  while (appState.focusTranslationIds.size < 20 && appState.upcomingTranslationIds.size > 0) {
    const idToMove = appState.upcomingTranslationIds.values().next().value;
    moveToFocusWords(appState, idToMove);
  }

  const token = localStorage.getItem('token');
  saveQuizState(appState, token);
}

export async function fetchWordSets(appState, token, wordListName) {
  try {
    const response = await fetch(
      `${serverAddress}/user/word-sets?wordListName=${encodeURIComponent(wordListName)}`,
      {
        method: 'GET',
        headers: {
          Authorization: `Bearer ${token}`,
        },
      }
    );

    if (!response.ok) {
      throw new Error('Failed to fetch word sets');
    }

    const data = await response.json();
    parseData(appState, data);
  } catch (error) {
    console.error('Error fetching word sets:', error);
    throw error;
  }
}

export async function fetchWordLists(token) {
  try {
    const response = await fetch(`${serverAddress}/word-lists`, {
      method: 'GET',
      headers: {
        Authorization: `Bearer ${token}`,
      },
    });

    if (!response.ok) {
      throw new Error('Failed to fetch word lists');
    }

    const data = await response.json();
    return data;
  } catch (error) {
    console.error('Error fetching word lists:', error);
    throw error;
  }
}
