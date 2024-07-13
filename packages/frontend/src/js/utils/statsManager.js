// statsManager.js

import {
  focusWordsSet,
  masteredOneDirectionSet,
  upcomingWordsSet,
  masteredVocabularySet,
} from '../app.js';

export const stats = {
  totalAttempts: 0,
  correctAnswers: 0,
  incorrectAnswers: 0,
  attemptsPerWord: {},
  correctPerWord: {},
  incorrectPerWord: {},
  timePerWord: {},
  timePerQuestion: [],
};

export function updateStats(isTheAnswerCorrect, originalWord, startTime, direction) {
  const endTime = new Date();
  const timeTaken = (endTime - startTime) / 1000;
  stats.totalAttempts += 1;
  stats.timePerQuestion.push(timeTaken);

  if (!stats.attemptsPerWord[originalWord]) {
    stats.attemptsPerWord[originalWord] = { attempts: 0, correct: 0, incorrect: 0 };
    stats.timePerWord[originalWord] = [];
  }

  const wordStats = stats.attemptsPerWord[originalWord];
  wordStats.attempts += 1;
  stats.timePerWord[originalWord].push(timeTaken);

  if (isTheAnswerCorrect) {
    stats.correctAnswers += 1;
    wordStats.correct += 1;

    if (direction) {
      if (wordStats.correct === 3 && focusWordsSet.has(originalWord)) {
        masteredOneDirectionSet.add(originalWord);
        focusWordsSet.delete(originalWord);
        if (upcomingWordsSet.size > 0) {
          const newWord = upcomingWordsSet.values().next().value;
          focusWordsSet.add(newWord);
          upcomingWordsSet.delete(newWord);
        }
      }
    } else if (wordStats.correct === 6 && masteredOneDirectionSet.has(originalWord)) {
      masteredVocabularySet.add(originalWord);
      masteredOneDirectionSet.delete(originalWord);
      if (masteredOneDirectionSet.size > 0) {
        const newWord = masteredOneDirectionSet.values().next().value;
        focusWordsSet.add(newWord);
        masteredOneDirectionSet.delete(newWord);
      }
    }
  } else {
    stats.incorrectAnswers += 1;
    wordStats.incorrect += 1;
    stats.incorrectPerWord[originalWord] = (stats.incorrectPerWord[originalWord] || 0) + 1;
  }
}

export function getIncorrectPerWord() {
  return stats.incorrectPerWord;
}
