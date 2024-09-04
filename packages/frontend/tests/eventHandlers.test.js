import { initEventHandlers } from '../src/js/ui/eventHandlers.js';
import { App } from '../src/js/app.js';
import { QuizManager } from '../src/js/quiz/quizManager.js';

// Mock the QuizManager class
jest.mock('../src/js/quiz/quizManager.js');

describe('EventHandlers Functions', () => {
  let appState;
  let quizManagerMock;

  beforeEach(() => {
    appState = new App();
    quizManagerMock = new QuizManager(appState);
    QuizManager.mockImplementation(() => quizManagerMock);

    // Populate quizTranslations and set currentTranslationId
    appState.quizTranslations.set(2, {
      wordPairId: 2,
      sourceWord: 'next',
      targetWord: 'siguiente',
    });
    appState.setCurrentTranslationId(2);

    // Mock getNextQuestion to return translationId 2
    quizManagerMock.getNextQuestion.mockReturnValue({ word: 'next', translationId: 2 });

    // Mock verifyAnswer
    quizManagerMock.verifyAnswer.mockReturnValue(true);

    document.body.innerHTML = `
      <input id="answer" />
      <button id="submit"></button>
      <button id="direction-toggle"></button>
      <select id="quiz-select"></select>
      <div id="feedback"></div>
      <div id="source-word-usage"></div>
      <div id="target-word-usage"></div>
    `;

    initEventHandlers();
  });

  it('should initialize event handlers', () => {
    const answerInput = document.getElementById('answer');
    const submitButton = document.getElementById('submit');
    const directionToggleBtn = document.getElementById('direction-toggle');
    const quizSelect = document.getElementById('quiz-select');

    expect(answerInput).not.toBeNull();
    expect(submitButton).not.toBeNull();
    expect(directionToggleBtn).not.toBeNull();
    expect(quizSelect).not.toBeNull();
  });

  it('should handle submit answer', () => {
    const answerInput = document.getElementById('answer');
    const submitButton = document.getElementById('submit');
    const feedbackElement = document.getElementById('feedback');

    answerInput.value = 'test';
    // Ensure verifyAnswer is mocked to return true
    quizManagerMock.verifyAnswer.mockReturnValue(true);

    submitButton.click();

    expect(quizManagerMock.verifyAnswer).toHaveBeenCalledWith('test', expect.any(Date));
    expect(feedbackElement.textContent).toBe('Correct!');
    expect(document.getElementById('source-word-usage').textContent).toBe('siguiente');
    expect(document.getElementById('target-word-usage').textContent).toBe('siguiente');

    // Ensure getNextQuestion is called and display is updated
    expect(quizManagerMock.getNextQuestion).toHaveBeenCalled();
  });

  it('should handle direction toggle', () => {
    const directionToggleBtn = document.getElementById('direction-toggle');
    appState.direction = true;
    appState.masteredOneDirectionTranslationIds.add(1);

    directionToggleBtn.click();

    expect(appState.direction).toBe(false);
    expect(quizManagerMock.getNextQuestion).toHaveBeenCalled();
  });
});
