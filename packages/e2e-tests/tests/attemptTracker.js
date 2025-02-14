const { expect } = require('@playwright/test');

class AttemptTracker {
  constructor(testWords, focusWords) {
    this.testWords = testWords;
    this.correctAttempts = {
      original: {},
      reverse: {},
    };
    this.incorrectAttempts = {};
    this.wordStatus = {};

    testWords.forEach((word) => {
      this.correctAttempts.original[word.sourceWord] = 0;
      this.correctAttempts.reverse[word.targetWord] = 0;
      this.incorrectAttempts[word.sourceWord] = 0;

      if (focusWords.includes(word.sourceWord)) {
        this.wordStatus[word.sourceWord] = 'focus';
      } else {
        this.wordStatus[word.sourceWord] = 'upcoming';
      }
    });
  }

  incrementCorrect(word, direction) {
    if (direction === 'original') {
      this.correctAttempts.original[word] += 1;
    } else if (direction === 'reverse') {
      this.correctAttempts.reverse[word] += 1;
    }
  }

  incrementIncorrect(word) {
    this.incorrectAttempts[word] += 1;
  }

  getCorrectAttempts(word, direction) {
    if (direction === 'original') {
      return this.correctAttempts.original[word];
    } else if (direction === 'reverse') {
      return this.correctAttempts.reverse[word];
    }
  }

  checkAndMoveToList(word) {
    const correctOriginal = this.getCorrectAttempts(word.sourceWord, 'original');
    const correctReverse = this.getCorrectAttempts(word.sourceWord, 'reverse');

    if (correctOriginal >= 3 && correctReverse >= 3) {
      this.wordStatus[word.sourceWord] = 'mastered';
    } else if (correctOriginal >= 3) {
      this.wordStatus[word.sourceWord] = 'mastered-one-direction';
    }
  }

  getWordStatus(word) {
    return this.wordStatus[word];
  }

  setWordStatus(word, status) {
    this.wordStatus[word.sourceWord] = status;
  }

  async answerCorrectly(page, word, direction = 'original') {
    const displayedWord = await page.locator('#word').innerText();
    let answer;
    if (direction === 'original') {
      answer = word.sourceWord === displayedWord ? word.targetWord : null;
    } else {
      answer = word.targetWord === displayedWord ? word.sourceWord : null;
    }

    if (answer) {
      await page.fill('#answer', answer);
      await page.click('#submit');

      await expect(page.locator('#feedback')).toContainText('Correct!');

      this.incrementCorrect(word.sourceWord, direction);
      await expect(page.locator('#word')).not.toContainText(word.sourceWord);

      this.checkAndMoveToList(word);
      await this.assertWordPosition(page, word);
    }
  }

  async answerIncorrectly(page, word) {
    const displayedWord = await page.locator('#word').innerText();
    await page.fill('#answer', 'incorrect answer');
    await page.click('#submit');

    await expect(page.locator('#feedback')).toContainText('Wrong');

    this.incrementIncorrect(word.sourceWord);
    await expect(page.locator('#word')).not.toContainText(displayedWord);

    await this.assertWordPosition(page, word);
  }

  async assertWordPosition(page, word) {
    const status = this.getWordStatus(word.sourceWord);

    switch (status) {
      case 'mastered-one-direction':
        await expect(page.locator('#level-2-list')).toContainText(word.sourceWord);
        break;
      case 'mastered':
        await expect(page.locator('#level-3-list')).toContainText(word.sourceWord);
        break;
      case 'focus':
        await expect(page.locator('#level-1-list')).toContainText(word.sourceWord);
        break;
      default:
        await expect(page.locator('#level-0-list')).toContainText(word.sourceWord);
    }
  }
}

module.exports = AttemptTracker;
