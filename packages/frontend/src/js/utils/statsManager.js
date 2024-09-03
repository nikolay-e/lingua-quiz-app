import {
  quizTranslations,
  focusTranslationIds,
  masteredOneDirectionTranslationIds,
  masteredVocabularyTranslationIds,
  upcomingTranslationIds,
  toggleDirection,
} from '../app.js';

export const stats = {
  totalAttempts: 0,
  correctAnswers: 0,
  incorrectAnswers: 0,
  attemptsPerTranslationIdAndDirection: {},
  incorrectPerTranslationIdAndDirection: {},
  timePerTranslationIdAndDirection: {},
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

export function updateStats(isTheAnswerCorrect, translationId, startTime, direction) {
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

  if (isTheAnswerCorrect) {
    stats.correctAnswers += 1;
    translationStats.correct += 1;

    const wordPair = quizTranslations.get(translationId);
    if (wordPair) {
      const normalKey = `${translationId}-normal`;
      const reverseKey = `${translationId}-reverse`;
      const normalCorrect = stats.attemptsPerTranslationIdAndDirection[normalKey]?.correct || 0;
      const reverseCorrect = stats.attemptsPerTranslationIdAndDirection[reverseKey]?.correct || 0;

      if (focusTranslationIds.has(translationId) && normalCorrect >= 3) {
        masteredOneDirectionTranslationIds.add(translationId);
        focusTranslationIds.delete(translationId);
        wordPair.status = 'Mastered One Direction';
        moveFromUpcomingToFocus();
      } else if (masteredOneDirectionTranslationIds.has(translationId) && reverseCorrect >= 3) {
        masteredVocabularyTranslationIds.add(translationId);
        masteredOneDirectionTranslationIds.delete(translationId);
        wordPair.status = 'Mastered Vocabulary';
        moveFromUpcomingToFocus();
        if (masteredOneDirectionTranslationIds.size === 0) {
          toggleDirection();
        }
      }
    }
  } else {
    stats.incorrectAnswers += 1;
    translationStats.incorrect += 1;
    stats.incorrectPerTranslationIdAndDirection[key] =
      (stats.incorrectPerTranslationIdAndDirection[key] || 0) + 1;
  }
}

export function getIncorrectPerWord() {
  const incorrectPerWord = {};
  // eslint-disable-next-line no-restricted-syntax
  for (const [key, value] of Object.entries(stats.incorrectPerTranslationIdAndDirection)) {
    const [translationId] = key.split('-');
    incorrectPerWord[translationId] = (incorrectPerWord[translationId] || 0) + value;
  }
  return incorrectPerWord;
}
