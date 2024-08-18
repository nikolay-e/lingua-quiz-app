import {
  quizTranslations,
  focusTranslationIds,
  masteredOneDirectionTranslationIds,
  masteredVocabularyTranslationIds,
  upcomingTranslationIds,
} from '../app.js';

export const stats = {
  totalAttempts: 0,
  correctAnswers: 0,
  incorrectAnswers: 0,
  attemptsPerTranslationId: {},
  incorrectPerTranslationId: {},
  timePerTranslationId: {},
  timePerQuestion: [],
};

function moveFromUpcomingToFocus() {
  if (upcomingTranslationIds.size > 0) {
    const nextTranslationId = upcomingTranslationIds.values().next().value;
    focusTranslationIds.add(nextTranslationId);
    upcomingTranslationIds.delete(nextTranslationId);
    const wordPair = quizTranslations.get(nextTranslationId);
    if (wordPair) {
      wordPair.status = 'Focus Words';
    }
  }
}

function moveFromMasteredOneDirectionToFocus() {
  if (masteredOneDirectionTranslationIds.size > 0) {
    const nextTranslationId = masteredOneDirectionTranslationIds.values().next().value;
    focusTranslationIds.add(nextTranslationId);
    masteredOneDirectionTranslationIds.delete(nextTranslationId);
    const wordPair = quizTranslations.get(nextTranslationId);
    if (wordPair) {
      wordPair.status = 'Focus Words';
    }
  }
}

export function updateStats(isTheAnswerCorrect, translationId, startTime, direction) {
  const endTime = new Date();
  const timeTaken = (endTime - startTime) / 1000;
  stats.totalAttempts += 1;
  stats.timePerQuestion.push(timeTaken);

  if (!stats.attemptsPerTranslationId[translationId]) {
    stats.attemptsPerTranslationId[translationId] = {
      attempts: 0,
      correct: 0,
      incorrect: 0,
    };
    stats.timePerTranslationId[translationId] = [];
  }

  const translationStats = stats.attemptsPerTranslationId[translationId];
  translationStats.attempts += 1;
  stats.timePerTranslationId[translationId].push(timeTaken);

  if (isTheAnswerCorrect) {
    stats.correctAnswers += 1;
    translationStats.correct += 1;

    const wordPair = quizTranslations.get(translationId);
    if (wordPair) {
      if (direction) {
        if (translationStats.correct === 3 && focusTranslationIds.has(translationId)) {
          masteredOneDirectionTranslationIds.add(translationId);
          focusTranslationIds.delete(translationId);
          wordPair.status = 'Mastered One Direction';
          moveFromUpcomingToFocus();
        }
      } else if (
        translationStats.correct === 6 &&
        masteredOneDirectionTranslationIds.has(translationId)
      ) {
        masteredVocabularyTranslationIds.add(translationId);
        masteredOneDirectionTranslationIds.delete(translationId);
        wordPair.status = 'Mastered Vocabulary';
        moveFromMasteredOneDirectionToFocus();
      }
    }
  } else {
    stats.incorrectAnswers += 1;
    translationStats.incorrect += 1;
    stats.incorrectPerTranslationId[translationId] =
      (stats.incorrectPerTranslationId[translationId] || 0) + 1;
  }
}

export function getIncorrectPerWord() {
  return stats.incorrectPerTranslationId;
}
