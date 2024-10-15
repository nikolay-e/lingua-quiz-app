// const { test, expect } = require('@playwright/test');
// const { register, apiLogin, login, selectQuiz, addWordPair, logout } = require('./helpers');
// const AttemptTracker = require('./attemptTracker');
//
// test.describe('Quiz Functionality', () => {
//   const testUser = `test${Date.now()}@example.com`;
//   const testPassword = 'testPassword123!';
//   const testWordList = `TestList_${Date.now()}`;
//   const testWords = [
//     { sourceWord: 'hello', targetWord: 'hola' },
//     { sourceWord: 'goodbye', targetWord: 'adiós' },
//     // ... (rest of the testWords array)
//   ];
//
//   let focusWords = [];
//   let tracker;
//
//   test.beforeAll(async ({ request }) => {
//     await register(request, testUser, testPassword);
//     const loginResponse = await apiLogin(request, testUser, testPassword);
//     const token = loginResponse.token;
//
//     for (const [index, word] of testWords.entries()) {
//       await addWordPair(request, token, testWordList, word.sourceWord, word.targetWord, index);
//     }
//   });
//
//   test.beforeEach(async ({ page }) => {
//     await login(page, testUser, testPassword);
//     await selectQuiz(page, testWordList);
//
//     await expect(page.locator('#focus-words-list')).toBeVisible();
//     await expect(page.locator('#focus-words-list li')).toHaveCount(20);
//
//     await expect(page.locator('#upcoming-words-list')).toBeVisible();
//     await expect(page.locator('#upcoming-words-list li')).toHaveCount(10);
//
//     focusWords = await page.locator('#focus-words-list li').allTextContents();
//     tracker = new AttemptTracker(testWords, focusWords);
//   });
//
//   test.afterEach(async ({ page }) => {
//     await logout(page);
//   });
//
//   test('should master all words by simulating correct and incorrect answers', async ({ page }) => {
//     for (const word of testWords) {
//       for (let i = 0; i < 6; i++) {
//         const isCorrect = Math.random() > 0.3;
//         const direction = Math.random() > 0.5 ? 'original' : 'reverse';
//
//         if (isCorrect) {
//           await tracker.answerCorrectly(page, word, direction);
//         } else {
//           await tracker.answerIncorrectly(page, word);
//         }
//       }
//     }
//
//     for (const word of testWords) {
//       await expect(page.locator('#mastered-vocabulary-list')).toContainText(word.sourceWord);
//     }
//   });
// });
