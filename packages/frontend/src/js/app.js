export class App {
  constructor() {
    this.quizTranslations = new Map();
    this.focusTranslationIds = new Set();
    this.masteredOneDirectionTranslationIds = new Set();
    this.masteredVocabularyTranslationIds = new Set();
    this.upcomingTranslationIds = new Set();

    this.currentTranslationId = null;
    this.sourceLanguage = '';
    this.targetLanguage = '';
    this.direction = true;
  }

  setCurrentTranslationId(id) {
    this.currentTranslationId = id;
  }

  setDirection(newDirection) {
    this.direction = newDirection;
  }

  toggleDirection() {
    if (this.masteredOneDirectionTranslationIds.size === 0) {
      this.direction = true;
      return 'Normal';
    }

    this.direction = !this.direction;
    return this.getDirectionText();
  }

  getDirectionText() {
    return this.direction ? 'Normal' : 'Reverse';
  }

  setSourceLanguage(language) {
    this.sourceLanguage = language;
  }

  setTargetLanguage(language) {
    this.targetLanguage = language;
  }
}

// Export a singleton instance of App
export const appInstance = new App();
