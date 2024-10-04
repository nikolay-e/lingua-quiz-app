/* eslint-disable no-param-reassign */
import serverAddress from '../config.js';

export function getIncorrectPerWord(stats) {
  const incorrectPerWord = {};
  Object.entries(stats.incorrectPerTranslationIdAndDirection).forEach(([key, value]) => {
    const [translationId] = key.split('-');
    incorrectPerWord[translationId] = (incorrectPerWord[translationId] || 0) + value;
  });
  return incorrectPerWord;
}

export function getRandomTranslationIdFromTopFew(stats, wordSet, lastAskedWords) {
  const incorrectPerWord = getIncorrectPerWord(stats);
  const sortedWords = Array.from(wordSet).map((word) => [word, incorrectPerWord[word] || 0]);

  sortedWords.sort((a, b) => a[1] - b[1]);

  const topFewWords = sortedWords.slice(0, 10).map((item) => item[0]);
  const availableWords = topFewWords.filter((word) => !lastAskedWords.includes(word));

  let selectedWord;
  if (availableWords.length > 0) {
    selectedWord = availableWords[Math.floor(Math.random() * availableWords.length)];
  } else {
    selectedWord = topFewWords[Math.floor(Math.random() * topFewWords.length)];
  }

  return selectedWord;
}

export async function saveQuizState(appState, token) {
  const statusSets = {
    'Mastered Vocabulary': new Set(),
    'Mastered One Direction': new Set(),
    'Focus Words': new Set(),
  };

  appState.quizTranslations.forEach((translation, id) => {
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

export function moveToFocusWords(appState, translationId) {
  if (appState.upcomingTranslationIds.has(translationId)) {
    appState.focusTranslationIds.add(translationId);
    appState.upcomingTranslationIds.delete(translationId);
    const wordPair = appState.quizTranslations.get(translationId);
    wordPair.status = 'Focus Words';
    const token = localStorage.getItem('token');
    saveQuizState(appState, token);
  }
}

export function moveToMasteredOneDirection(appState, translationId) {
  if (appState.focusTranslationIds.has(translationId)) {
    appState.masteredOneDirectionTranslationIds.add(translationId);
    appState.focusTranslationIds.delete(translationId);
    const wordPair = appState.quizTranslations.get(translationId);
    wordPair.status = 'Mastered One Direction';
    const token = localStorage.getItem('token');
    saveQuizState(appState, token);
  }
}

export function moveToMasteredVocabulary(appState, translationId) {
  if (appState.masteredOneDirectionTranslationIds.has(translationId)) {
    appState.masteredVocabularyTranslationIds.add(translationId);
    appState.masteredOneDirectionTranslationIds.delete(translationId);
    const wordPair = appState.quizTranslations.get(translationId);
    wordPair.status = 'Mastered Vocabulary';
    const token = localStorage.getItem('token');
    saveQuizState(appState, token);
  }
}

export function updateStats(stats, isCorrect, translationId, startTime, direction) {
  const endTime = new Date();
  const timeTaken = (endTime - startTime) / 1000;
  stats.totalAttempts += 1;
  stats.timePerQuestion.push(timeTaken);

  const key = `${translationId}-${direction ? 'normal' : 'reverse'}`;

  if (!stats.attemptsPerTranslationIdAndDirection[key]) {
    stats.attemptsPerTranslationIdAndDirection[key] = {
      attempts: 0,
      correct: 0,
      incorrect: 0,
    };
    stats.timePerTranslationIdAndDirection[key] = [];
  }

  const translationStats = stats.attemptsPerTranslationIdAndDirection[key];
  translationStats.attempts += 1;
  stats.timePerTranslationIdAndDirection[key].push(timeTaken);

  if (isCorrect) {
    stats.correctAnswers += 1;
    translationStats.correct += 1;
  } else {
    stats.incorrectAnswers += 1;
    translationStats.incorrect += 1;
    stats.incorrectPerTranslationIdAndDirection[key] =
      (stats.incorrectPerTranslationIdAndDirection[key] || 0) + 1;
  }
}
