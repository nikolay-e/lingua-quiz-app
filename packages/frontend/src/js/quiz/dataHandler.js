import {
  quizTranslations,
  focusTranslationIds,
  masteredOneDirectionTranslationIds,
  masteredVocabularyTranslationIds,
  upcomingTranslationIds,
  setSourceLanguage,
  setTargetLanguage,
} from '../app.js';
import serverAddress from '../config.js';

function detectLanguages(data) {
  const firstElement = data[0];
  return [firstElement.source_language_id, firstElement.target_language_id];
}

export function parseData(data) {
  if (!data || !Array.isArray(data)) {
    throw new Error('Invalid data structure in JSON');
  }

  const existingStatuses = new Map();
  quizTranslations.forEach((value, key) => {
    existingStatuses.set(key, value.status);
  });

  quizTranslations.clear();
  [
    focusTranslationIds,
    masteredOneDirectionTranslationIds,
    masteredVocabularyTranslationIds,
    upcomingTranslationIds,
  ].forEach((set) => set.clear());

  const detectedLanguages = detectLanguages(data);
  if (detectedLanguages.length < 2) {
    throw new Error('At least two supported languages must be present in the data');
  }

  setSourceLanguage(detectedLanguages[0]);
  setTargetLanguage(detectedLanguages[1]);

  data.forEach((entry) => {
    if (typeof entry === 'object') {
      const existingStatus = existingStatuses.get(entry.word_pair_id);
      // eslint-disable-next-line no-param-reassign
      entry.status = existingStatus || entry.status;

      quizTranslations.set(entry.word_pair_id, entry);

      const currentSet = {
        'Focus Words': focusTranslationIds,
        'Mastered One Direction': masteredOneDirectionTranslationIds,
        'Mastered Vocabulary': masteredVocabularyTranslationIds,
        'Upcoming Words': upcomingTranslationIds,
      }[entry.status];

      if (currentSet) currentSet.add(entry.word_pair_id);
    } else {
      console.warn('Invalid word entry:', entry);
    }
  });

  if (quizTranslations.size === 0) {
    throw new Error('No valid entries added to quizTranslations');
  }

  // Ensure Focus Words has at least 20 words if possible
  while (focusTranslationIds.size < 20 && upcomingTranslationIds.size > 0) {
    const idToMove = upcomingTranslationIds.values().next().value;
    focusTranslationIds.add(idToMove);
    upcomingTranslationIds.delete(idToMove);
    const wordPair = quizTranslations.get(idToMove);
    if (wordPair) {
      wordPair.status = 'Focus Words';
    }
  }
}

export async function fetchWordSets(token, wordListName) {
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
    return parseData(data);
  } catch (error) {
    console.error('Error fetching word sets:', error);
    throw error;
  }
}

export async function saveQuizState(token) {
  const statusSets = {
    'Focus Words': new Set(),
    'Mastered One Direction': new Set(),
    'Mastered Vocabulary': new Set(),
  };

  quizTranslations.forEach((translation, id) => {
    if (statusSets[translation.status]) {
      statusSets[translation.status].add(id);
    }
  });

  try {
    const promises = Object.entries(statusSets).map(([status, set]) => {
      const wordPairIds = Array.from(set);

      return fetch(`${serverAddress}/user/word-sets`, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          status,
          wordPairIds,
        }),
      }).then((response) => {
        if (!response.ok) {
          throw new Error(`Failed to save quiz state for ${status}`);
        }
      });
    });

    await Promise.all(promises);
  } catch (error) {
    console.error('Error saving quiz state:', error);
    throw error;
  }
}
