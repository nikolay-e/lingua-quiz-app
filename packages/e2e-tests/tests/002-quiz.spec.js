const { test, expect } = require('@playwright/test');
const { register, login, logout } = require('./helpers');

test.describe('Quiz Functionality', () => {
  const testUser = `testuser${Date.now()}@example.com`;
  const testPassword = 'TestPassword123!';

  test.beforeAll(async ({ browser }) => {
    // Create a new browser context and page
    const context = await browser.newContext();
    const page = await context.newPage();
    // Perform registration via GUI
    await register(page, testUser, testPassword, true);
    // Close the context
    await context.close();
  });

  test.beforeEach(async ({ page }) => {
    await login(page, testUser, testPassword);
  });

  test.afterEach(async ({ page }) => {
    await logout(page);
  });

  test('should master all words in the selected quiz', async ({ page }) => {
    test.setTimeout(2000000);

    // Wait for the quiz select dropdown to be available
    const quizSelect = page.locator('#quiz-select');
    await quizSelect.waitFor({ state: 'visible', timeout: 5000 });

    // Check if there are quizzes available
    const quizOptions = await quizSelect.locator('option').all();
    if (quizOptions.length <= 1) {
      console.error('No quizzes available for selection.');
      return;
    }

    // Select the first available quiz (skip the default option)
    const quizValue = await quizOptions[1].getAttribute('value');
    await quizSelect.selectOption(quizValue);

    // Trigger the change event manually
    await page.evaluate(() => {
      const selectElement = document.getElementById('quiz-select');
      const event = new Event('change', { bubbles: true });
      selectElement.dispatchEvent(event);
    });

    // Wait for the word lists to load
    await page.waitForSelector('#focus-words-list li', { timeout: 10000 });

    // Function to extract words from a given list
    async function getWordsFromList(listId) {
      const words = [];
      const listItems = await page.locator(`#${listId} li`).allTextContents();
      for (const text of listItems) {
        // Each item is in the format: 'sourceWord (targetWord)'
        const match = text.match(/(.+?)\s+\((.+?)\)/);
        if (match) {
          const sourceWord = match[1].trim();
          const targetWord = match[2].trim();
          words.push({ sourceWord, targetWord });
        }
      }
      return words;
    }

    // Gather initial words from all lists
    let focusWords = await getWordsFromList('focus-words-list');
    let masteredOneDirectionWords = await getWordsFromList('mastered-one-direction-list');
    let masteredVocabularyWords = await getWordsFromList('mastered-vocabulary-list');
    let upcomingWords = await getWordsFromList('upcoming-words-list');

    // Combine all words into one array
    let allWords = [
      ...focusWords,
      ...masteredOneDirectionWords,
      ...masteredVocabularyWords,
      ...upcomingWords,
    ];

    // Ensure we have words to work with
    if (allWords.length === 0) {
      console.error('No words available in any word list.');
      return;
    }

    // Initialize a flag to track if we've toggled the direction
    let directionToggled = false;

    // Loop until all words are mastered completely
    while (masteredVocabularyWords.length < allWords.length) {
      // Get the current question word
      const questionWordElement = page.locator('#word');
      const previousQuestionWord = await questionWordElement.innerText();

      // Check if the question word is valid
      if (
        !previousQuestionWord ||
        previousQuestionWord.trim() === '' ||
        previousQuestionWord.includes('No more questions')
      ) {
        console.log('No more questions available in current direction.');

        if (!directionToggled) {
          // Toggle direction
          console.log('Toggling direction...');
          await page.click('#direction-toggle');

          // Wait for the question word to update
          await page.waitForFunction(
            async (oldWord) => {
              const newWord = document.querySelector('#word')?.innerText;
              return newWord && newWord !== oldWord;
            },
            previousQuestionWord,
            { timeout: 5000 }
          );

          // Set flag
          directionToggled = true;
          continue; // Continue the loop in new direction
        } else {
          // No more questions in both directions
          console.log('No more questions in both directions.');
          break; // Exit the loop
        }
      }

      // Try to find the word pair in the current direction
      let wordPair;
      let answer = '';

      if (!directionToggled) {
        // Initial direction (e.g., source to target)
        wordPair = allWords.find((wp) => wp.sourceWord === previousQuestionWord);
        if (wordPair) {
          answer = wordPair.targetWord;
        }
      } else {
        // After toggling direction (e.g., target to source)
        wordPair = allWords.find((wp) => wp.targetWord === previousQuestionWord);
        if (wordPair) {
          answer = wordPair.sourceWord;
        }
      }

      if (!wordPair) {
        console.error(`Could not find the answer for the question word: ${previousQuestionWord}`);
        // Skip this iteration if the word is not found
        // Go to next question
        await page.click('#submit');
        continue;
      }

      // Input the answer and submit
      const answerInput = page.locator('#answer');

      // Wait for the answer input to be visible and enabled
      await answerInput.waitFor({ state: 'visible', timeout: 5000 });

      // Fill the answer input
      await answerInput.fill(answer);

      // Click submit
      await page.click('#submit');

      // Verify the feedback
      await page.waitForSelector('#feedback .feedback-message');
      const feedbackText = await page.locator('#feedback .feedback-message').innerText();
      if (feedbackText.includes('Correct!')) {
        // Success
        expect(feedbackText).toContain('Correct!');
      } else {
        // Failure
        console.error(`Expected 'Correct!', but got '${feedbackText}'`);
        expect(feedbackText).toContain('Correct!');
      }

      // Wait for the next question to load by waiting for the #word text to change
      await page.waitForFunction(
        async (oldWord) => {
          const newWord = document.querySelector('#word')?.innerText;
          return newWord && newWord !== oldWord;
        },
        previousQuestionWord,
        { timeout: 5000 }
      );

      // Refresh the word lists to get updated statuses
      focusWords = await getWordsFromList('focus-words-list');
      masteredOneDirectionWords = await getWordsFromList('mastered-one-direction-list');
      masteredVocabularyWords = await getWordsFromList('mastered-vocabulary-list');
      upcomingWords = await getWordsFromList('upcoming-words-list');

      // Update allWords in case new words have been moved into focus
      allWords = [
        ...focusWords,
        ...masteredOneDirectionWords,
        ...masteredVocabularyWords,
        ...upcomingWords,
      ];
    }

    // At this point, all words should be mastered
    expect(masteredVocabularyWords.length).toBe(allWords.length);
  });
});
