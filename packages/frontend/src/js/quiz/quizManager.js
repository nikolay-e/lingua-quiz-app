import { getRandomTranslationIdFromTopFew, updateStats } from './wordSetManager.js';
import { appInstance } from '../app.js';

// eslint-disable-next-line import/prefer-default-export
export class QuizManager {
  constructor(appState) {
    this.appState = appState;
    this.lastAskedWords = [];
  }

  getNextQuestion() {
    if (
      this.appState.getDirectionText() === 'Reverse' &&
      this.appState.masteredOneDirectionTranslationIds.size === 0
    ) {
      this.appState.toggleDirection();
    }

    const translationSet = this.appState.direction
      ? this.appState.focusTranslationIds
      : this.appState.masteredOneDirectionTranslationIds;

    const newTranslationId = getRandomTranslationIdFromTopFew(
      appInstance.stats,
      translationSet,
      this.lastAskedWords,
      this.appState.quizTranslations
    );
    this.appState.setCurrentTranslationId(newTranslationId);
    const translation = this.appState.quizTranslations.get(newTranslationId);

    // Update last asked words
    this.lastAskedWords.push(newTranslationId);
    if (this.lastAskedWords.length > 7) {
      this.lastAskedWords.shift();
    }

    return {
      word: this.appState.direction ? translation.sourceWord : translation.targetWord,
      translationId: newTranslationId,
    };
  }

  verifyAnswer(userAnswer, startTime) {
    const translation = this.appState.quizTranslations.get(this.appState.currentTranslationId);
    const correctAnswer = this.appState.direction ? translation.targetWord : translation.sourceWord;
    // eslint-disable-next-line no-use-before-define
    const isAnswerCorrect = compareAnswers(userAnswer, correctAnswer);
    updateStats(
      appInstance.stats,
      isAnswerCorrect,
      this.appState.currentTranslationId,
      startTime,
      this.appState.direction
    );
    return isAnswerCorrect;
  }
}

// Helper function to compare answers
function compareAnswers(userAnswer, correctAnswer) {
  const normalizeAndSort = (answer) =>
    answer
      .toLowerCase()
      .split(',')
      .map((item) => item.trim().replace(/[^\p{Letter}]/gu, ''))
      .filter((item) => item.length > 0)
      .sort();

  const normalizedUserAnswer = normalizeAndSort(userAnswer);
  const normalizedCorrectAnswer = normalizeAndSort(correctAnswer);

  return (
    normalizedUserAnswer.length === normalizedCorrectAnswer.length &&
    normalizedUserAnswer.every((value, index) => value === normalizedCorrectAnswer[index])
  );
}
