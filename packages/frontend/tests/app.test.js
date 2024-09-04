import { App } from '../src/js/app.js';

describe('App Class', () => {
  let app;

  beforeEach(() => {
    app = new App();
  });

  it('should initialize with default values', () => {
    expect(app.quizTranslations.size).toBe(0);
    expect(app.focusTranslationIds.size).toBe(0);
    expect(app.masteredOneDirectionTranslationIds.size).toBe(0);
    expect(app.masteredVocabularyTranslationIds.size).toBe(0);
    expect(app.upcomingTranslationIds.size).toBe(0);
    expect(app.currentTranslationId).toBeNull();
    expect(app.sourceLanguage).toBe('');
    expect(app.targetLanguage).toBe('');
    expect(app.direction).toBe(true);
  });

  it('should set current translation ID', () => {
    app.setCurrentTranslationId(5);
    expect(app.currentTranslationId).toBe(5);
  });

  it('should set direction', () => {
    app.setDirection(false);
    expect(app.direction).toBe(false);
  });

  it('should toggle direction when mastered words exist', () => {
    app.masteredOneDirectionTranslationIds.add(1);
    const newDirection = app.toggleDirection();
    expect(newDirection).toBe('Reverse');
    expect(app.direction).toBe(false);
  });

  it('should not toggle direction when no mastered words', () => {
    const newDirection = app.toggleDirection();
    expect(newDirection).toBe('Normal');
    expect(app.direction).toBe(true);
  });

  it('should get correct direction text', () => {
    app.direction = true;
    expect(app.getDirectionText()).toBe('Normal');
    app.direction = false;
    expect(app.getDirectionText()).toBe('Reverse');
  });

  it('should set source language', () => {
    app.setSourceLanguage('English');
    expect(app.sourceLanguage).toBe('English');
  });

  it('should set target language', () => {
    app.setTargetLanguage('Spanish');
    expect(app.targetLanguage).toBe('Spanish');
  });
});
