const { test, expect } = require('@playwright/test');
const { register, login } = require('./helpers');

// --- Configuration ---
const MAX_SUBMIT_RETRIES = 2;
const RETRY_DELAY_MS = 50;
const WAIT_FOR_ELEMENT_TIMEOUT = 10000;
const WAIT_FOR_LIST_TIMEOUT = 15000;
const TEST_TIMEOUT_MS = 2700000;
const MAX_CONSECUTIVE_ERRORS_BEFORE_FAIL = 3;
const FULL_LIST_REFRESH_INTERVAL = 25;

/**
 * Gets word count from the header.
 * @param {import('@playwright/test').Page} page
 * @param {string} levelId - The level container id (e.g., 'level-0', 'level-1')
 * @returns {Promise<number>}
 */
async function getWordCountFromHeader(page, levelId) {
  try {
    const headerText = await page.locator(`#${levelId} h3`).innerText();
    const match = headerText.match(/\((\d+)\)/);
    return match ? parseInt(match[1], 10) : 0;
  } catch (error) {
    console.warn(`Could not get count from header ${levelId}: ${error.message}`);
    return 0;
  }
}

/**
 * Gets words or count from a list.
 * @param {import('@playwright/test').Page} page
 * @param {string} listId
 * @param {boolean} [countOnly=false] - If true, returns only the count.
 * @returns {Promise<Array<{sourceWord: string, targetWord: string}> | number>}
 */
async function getWordsOrCountFromList(page, listId, countOnly = false) {
  try {
    const listLocator = page.locator(`#${listId} li`);
    // Ensure list container exists briefly before checking count or items
    await page
      .locator(`#${listId}`)
      .waitFor({ state: 'attached', timeout: 3000 })
      .catch(() => {});
    
    if (countOnly) {
      const listItems = await listLocator.allTextContents();
      // Filter out empty list messages
      const actualItems = listItems.filter(text => 
        !text.includes('No words') && !text.includes('No new words')
      );
      const count = actualItems.length;
      // console.log(`Count for ${listId}: ${count}`); // Optional debug log
      return count;
    }

    const words = [];
    const listItems = await listLocator.allTextContents();
    for (const text of listItems) {
      // Skip empty list messages
      if (text.includes('No words') || text.includes('No new words')) {
        continue;
      }
      
      const match = text.match(/(.+?)\s+(\(.*)/);

      if (match) {
        const sourceWord = match[1].trim();
        let targetPart = match[2].trim();

        let targetWord = '';
        if (targetPart.startsWith('(') && targetPart.endsWith(')')) {
          targetWord = targetPart.slice(1, -1).trim();
        } else if (targetPart.startsWith('(')) {
          targetWord = targetPart.slice(1).trim();
        } else {
          targetWord = targetPart;
        }

        words.push({ sourceWord: sourceWord, targetWord: targetWord });
      }
    }
    return words;
  } catch (error) {
    console.warn(`Could not get words/count from list ${listId}: ${error.message}`);
    return countOnly ? 0 : []; // Return appropriate default on error
  }
}

async function waitForNextQuestion(page, previousWord) {
  try {
    await page.waitForFunction(
      (prevWord) => {
        const currentWordEl = document.querySelector('#word');
        const currentWord = currentWordEl ? currentWordEl.innerText : '';
        return currentWord && currentWord.trim() !== '' && currentWord !== prevWord;
      },
      previousWord,
      { timeout: WAIT_FOR_ELEMENT_TIMEOUT }
    );
    const newWord = await page.locator('#word').innerText();
  } catch (e) {
    console.warn(`Timeout or error waiting for the next question word after "${previousWord}". Error: ${e.message}`);
    throw e;
  }
}

// --- Test Suite ---
test.describe('Quiz Functionality', () => {
  const testUser = `testuser${Date.now()}@example.com`;
  const testPassword = 'TestPassword123!';

  test('should master all words in the selected quiz', async ({ page }) => {
    test.setTimeout(TEST_TIMEOUT_MS);

    console.log('Starting quiz test...');
    await page.addStyleTag({
      content: `*, *::before, *::after { transition: none !important; animation: none !important; scroll-behavior: auto !important; }`,
    });
    console.log('UI animations disabled.');

    await register(page, testUser, testPassword, true);
    await login(page, testUser, testPassword);
    console.log('User registered and logged in.');

    const quizSelect = page.locator('#quiz-select');
    await quizSelect.waitFor({ state: 'visible', timeout: WAIT_FOR_ELEMENT_TIMEOUT });
    await page.waitForTimeout(5000);
    const quizOptions = await quizSelect.locator('option').all();

    const quizValue = await quizOptions[1].getAttribute('value');
    console.log(`Selecting quiz: "${quizValue}"`);
    await quizSelect.selectOption({ index: 1 });

    try {
      console.log('Waiting for the first question word...');
      await expect(page.locator('#word')).not.toBeEmpty({ timeout: WAIT_FOR_LIST_TIMEOUT });
      console.log('First question word appeared.');
    } catch (e) {
      console.error('Initial question word did not appear after selecting quiz.');
      throw e;
    }
    try {
      console.log('Waiting for initial list population check...');
      await page.waitForSelector('#level-1-list li, #level-0-list li', { timeout: 10000 });
      // Wait a bit for state to stabilize after quiz load
      await page.waitForTimeout(1000);
      console.log('Lists seem populated.');
    } catch (e) {
      console.warn('Initial list population check timed out, proceeding.');
    }

    // --- Initial Data Gathering ---
    console.log('Gathering initial word lists state...');

    let initialListsWords = await Promise.all([
      getWordsOrCountFromList(page, 'level-0-list', false), // false = get words
      getWordsOrCountFromList(page, 'level-1-list', false),
      getWordsOrCountFromList(page, 'level-2-list', false),
      getWordsOrCountFromList(page, 'level-3-list', false),
    ]);
    let allWords = initialListsWords.flat(); // Initial full list for finding pairs

    let masteredOneDirectionCount = await getWordCountFromHeader(page, 'level-2');
    let masteredVocabularyWordsCount = await getWordCountFromHeader(page, 'level-3');

    const totalWordsInQuiz = allWords.length;
    const targetMasteredCount = totalWordsInQuiz;

    if (totalWordsInQuiz === 0) {
      console.error('No words found in the quiz after initial load.');
      test.fail(true, 'No words loaded initially.');
      return;
    }
    console.log(`Quiz Started. Target: Master ${targetMasteredCount} words.`);

    const initialL0Count = await getWordCountFromHeader(page, 'level-0');
    const initialL1Count = await getWordCountFromHeader(page, 'level-1');
    console.log(
      `Initial Counts - L0: ${initialL0Count}, L1: ${initialL1Count}, L2: ${masteredOneDirectionCount}, L3: ${masteredVocabularyWordsCount}`
    );

    // --- Quiz State Variables ---
    let currentDirection = 'Normal'; // Track current direction
    let consecutiveErrorsCount = 0;
    let questionCounter = 0;
    let forceFullRefreshNextLoop = false;

    // --- Main Quiz Loop ---
    while (
      masteredVocabularyWordsCount < targetMasteredCount && // Loop until all words reach L3
      consecutiveErrorsCount < MAX_CONSECUTIVE_ERRORS_BEFORE_FAIL
    ) {
      questionCounter++;

      const currentProgressPoints = masteredOneDirectionCount + masteredVocabularyWordsCount;
      const maxProgressPoints = 2 * targetMasteredCount;
      const progressPercentage = maxProgressPoints > 0 ? ((currentProgressPoints / maxProgressPoints) * 100).toFixed(1) : 'N/A';

      console.log(
        `\n--- Question ${questionCounter} | Progress: ${currentProgressPoints}/${maxProgressPoints} (${progressPercentage}%) [L2:${masteredOneDirectionCount}, L3:${masteredVocabularyWordsCount}] | Errors: ${consecutiveErrorsCount} ---`
      );

      // 1. Get the current question word
      const questionWordElement = page.locator('#word');
      let previousQuestionWord = '';
      try {
        await expect(questionWordElement).toBeVisible({ timeout: WAIT_FOR_ELEMENT_TIMEOUT });
        await expect(questionWordElement).not.toBeEmpty({ timeout: WAIT_FOR_ELEMENT_TIMEOUT });
        previousQuestionWord = await questionWordElement.innerText();
        
        // Detect current direction from the UI
        try {
          const directionButton = page.locator('#direction-toggle');
          const directionText = await directionButton.innerText();
          currentDirection = directionText.includes('➔') && !directionText.includes('Russian ➔') ? 'Normal' : 'Reverse';
        } catch (e) {
          // If can't detect, assume based on L1/L2 counts
          const l1Count = await getWordCountFromHeader(page, 'level-1');
          const l2Count = await getWordCountFromHeader(page, 'level-2');
          currentDirection = (l1Count > 0 || l2Count === 0) ? 'Normal' : 'Reverse';
        }
        
        console.log(`Question word: "${previousQuestionWord}" (Direction: ${currentDirection})`);
      } catch (e) {
        console.error(`Failed to get question word (Attempt ${consecutiveErrorsCount + 1}).`);
        consecutiveErrorsCount++;
        forceFullRefreshNextLoop = true;
        continue;
      }

      // 2. Check for end state or invalid word
      if (!previousQuestionWord || previousQuestionWord.trim() === '' || previousQuestionWord.includes('No more questions')) {
        console.log(`Quiz state indicates no more questions for current direction: "${previousQuestionWord}"`);
        // Update L3 count first to check for completion
        masteredVocabularyWordsCount = await getWordCountFromHeader(page, 'level-3');

        if (masteredVocabularyWordsCount >= targetMasteredCount) {
          console.log("Target reached upon 'No more questions'. Breaking loop.");
          break; // Exit loop - Target Met
        }

        // Target not reached, try toggling if not already done
        if (!directionToggled) {
          console.log('>>> Toggling direction to Reverse...');
          await page.click('#direction-toggle');
          directionToggled = true;
          consecutiveErrorsCount = 0; // Reset errors after successful direction change
          forceFullRefreshNextLoop = true; // Good practice to refresh after toggle

          console.log('Waiting for the first question word in the REVERSE direction...');
          try {
            await page.waitForFunction(
              (prevWord) => {
                const currentWordEl = document.querySelector('#word');
                const currentWord = currentWordEl ? currentWordEl.innerText.trim() : '';
                return currentWord && currentWord !== prevWord && !currentWord.includes('No more questions');
              },
              previousQuestionWord,
              { timeout: WAIT_FOR_ELEMENT_TIMEOUT * 2 }
            );
            const newWord = await page.locator('#word').innerText();
            console.log(`First REVERSE question word appeared: "${newWord}"`);
            continue;
          } catch (e) {
            console.error('Timeout or error waiting for the first REVERSE question word. Assuming stuck.', e);
            masteredOneDirectionCount = await getWordCountFromHeader(page, 'level-2');
            masteredVocabularyWordsCount = await getWordCountFromHeader(page, 'level-3'); // Update count before final log
            const currentL0Count = await getWordCountFromHeader(page, 'level-0');
            const currentL1Count = await getWordCountFromHeader(page, 'level-1');
            console.error(
              `Stuck! Mastered L3: ${masteredVocabularyWordsCount}/${targetMasteredCount}. Remaining L0: ${currentL0Count}, L1: ${currentL1Count}, L2: ${masteredOneDirectionCount}`
            );
            break;
          }
        } else {
          // Already tried Reverse, still "No more questions", and target not met.
          console.log('No more questions available in Reverse. Stuck?');
          masteredOneDirectionCount = await getWordCountFromHeader(page, 'level-2');
          // L3 count already updated above
          const currentL0Count = await getWordCountFromHeader(page, 'level-0');
          const currentL1Count = await getWordCountFromHeader(page, 'level-1');
          console.error(
            `Stuck! Mastered L3: ${masteredVocabularyWordsCount}/${targetMasteredCount}. Remaining L0: ${currentL0Count}, L1: ${currentL1Count}, L2: ${masteredOneDirectionCount}`
          );
          break; // Exit loop as stuck
        }
      } // End of "No more questions" block

      // --- Full List Refresh Logic & Word Finding ---
      let wordPair;
      if (forceFullRefreshNextLoop || (questionCounter > 1 && questionCounter % FULL_LIST_REFRESH_INTERVAL === 0)) {
        console.log(
          `Performing full list refresh (Flag: ${forceFullRefreshNextLoop}, Interval: ${questionCounter % FULL_LIST_REFRESH_INTERVAL === 0})...`
        );

        const lists = await Promise.all([
          getWordsOrCountFromList(page, 'level-0-list', false),
          getWordsOrCountFromList(page, 'level-1-list', false),
          getWordsOrCountFromList(page, 'level-2-list', false),
          getWordsOrCountFromList(page, 'level-3-list', false),
        ]);
        allWords = lists.flat(); // Update the master list of words

        masteredOneDirectionCount = await getWordCountFromHeader(page, 'level-2');
        masteredVocabularyWordsCount = await getWordCountFromHeader(page, 'level-3');

        const currentL0Count = await getWordCountFromHeader(page, 'level-0');
        const currentL1Count = await getWordCountFromHeader(page, 'level-1');
        console.log(
          `Refreshed Counts - L0:${currentL0Count}, L1:${currentL1Count}, L2:${masteredOneDirectionCount}, L3:${masteredVocabularyWordsCount}`
        );
        forceFullRefreshNextLoop = false; // Reset flag

        // Find pair using the *fresh* list
        if (!directionToggled) wordPair = allWords.find((wp) => wp.sourceWord === previousQuestionWord);
        else wordPair = allWords.find((wp) => wp.targetWord === previousQuestionWord);
      } else {
        // Try finding in potentially stale `allWords` list first
        if (!directionToggled) wordPair = allWords.find((wp) => wp.sourceWord === previousQuestionWord);
        else wordPair = allWords.find((wp) => wp.targetWord === previousQuestionWord);

        // If not found in stale list, force a full refresh NOW
        if (!wordPair) {
          console.warn(`Word "${previousQuestionWord}" not in stale list. Forcing refresh.`);
          const lists = await Promise.all([
            getWordsOrCountFromList(page, 'level-0-list', false),
            getWordsOrCountFromList(page, 'level-1-list', false),
            getWordsOrCountFromList(page, 'level-2-list', false),
            getWordsOrCountFromList(page, 'level-3-list', false),
          ]);
          allWords = lists.flat();
          masteredOneDirectionCount = await getWordCountFromHeader(page, 'level-2');
          masteredVocabularyWordsCount = await getWordCountFromHeader(page, 'level-3');
          const currentL0Count = await getWordCountFromHeader(page, 'level-0');
          const currentL1Count = await getWordCountFromHeader(page, 'level-1');
          console.log(
            `Refreshed Counts (after miss) - L0:${currentL0Count}, L1:${currentL1Count}, L2:${masteredOneDirectionCount}, L3:${masteredVocabularyWordsCount}`
          );
          forceFullRefreshNextLoop = false; // Reset flag as we just refreshed
          // --- Try finding again ---
          if (!directionToggled) wordPair = allWords.find((wp) => wp.sourceWord === previousQuestionWord);
          else wordPair = allWords.find((wp) => wp.targetWord === previousQuestionWord);
        }
      }

      // 3. Set answer
      const answer = !directionToggled ? wordPair.targetWord : wordPair.sourceWord;

      // 4. Input and submit
      console.log(`Attempting answer: "${answer}"`);
      const answerInput = page.locator('#answer');
      await answerInput.fill(answer);
      let feedbackText = '';
      for (let attempt = 1; attempt <= MAX_SUBMIT_RETRIES + 1; attempt++) {
        await page.click('#submit');
        try {
          const feedbackMessageLocator = page.locator('.feedback-container .feedback-message');
          await feedbackMessageLocator.waitFor({ state: 'visible', timeout: WAIT_FOR_ELEMENT_TIMEOUT });
          await expect(feedbackMessageLocator).not.toBeEmpty({ timeout: WAIT_FOR_ELEMENT_TIMEOUT });
          feedbackText = await feedbackMessageLocator.innerText();
          console.log(`Feedback (Attempt ${attempt}): "${feedbackText}"`);
          if (feedbackText.includes('Correct!') || feedbackText.includes('An error occurred.') || attempt > MAX_SUBMIT_RETRIES) break;
          if (!feedbackText.includes('An error occurred.')) break; // Break on "Wrong" etc.
          console.log(`Waiting ${RETRY_DELAY_MS}ms before retrying...`);
          await page.waitForTimeout(RETRY_DELAY_MS);
          if ((await answerInput.inputValue()) !== answer) await answerInput.fill(answer);
        } catch (error) {
          console.warn(`Attempt ${attempt} failed waiting for feedback: ${error.message}`);
          if (attempt > MAX_SUBMIT_RETRIES) {
            feedbackText = 'Feedback Error';
            break;
          }
          await page.waitForTimeout(RETRY_DELAY_MS);
          if ((await answerInput.inputValue()) !== answer) await answerInput.fill(answer);
        }
      }

      // 5. Process result
      if (feedbackText.includes('Correct!')) {
        consecutiveErrorsCount = 0;
      } else {
        consecutiveErrorsCount++;
        console.error(`Final check failed for "${previousQuestionWord}". Feedback: '${feedbackText}'. Error count: ${consecutiveErrorsCount}`);
        forceFullRefreshNextLoop = true;
      }

      // 6. Wait for next question
      if (masteredVocabularyWordsCount < targetMasteredCount && consecutiveErrorsCount < MAX_CONSECUTIVE_ERRORS_BEFORE_FAIL) {
        try {
          await waitForNextQuestion(page, previousQuestionWord);
        } catch (e) {
          const currentL3Count = await getWordCountFromHeader(page, 'level-3');
          masteredVocabularyWordsCount = currentL3Count;
          if (currentL3Count >= targetMasteredCount) {
            console.log('Target reached after waiting timeout. Breaking.');
            break;
          } else {
            console.warn(`Stuck waiting for next question. Mastered L3: ${currentL3Count}/${targetMasteredCount}. Incrementing errors.`);
            consecutiveErrorsCount++;
            forceFullRefreshNextLoop = true;
          }
        }
      }

      // 7. Update L2 and L3 counts for the next loop iteration's condition check and progress
      if (
        masteredVocabularyWordsCount < targetMasteredCount &&
        consecutiveErrorsCount < MAX_CONSECUTIVE_ERRORS_BEFORE_FAIL &&
        !forceFullRefreshNextLoop
      ) {
        const [l2Count, l3Count] = await Promise.all([
          getWordCountFromHeader(page, 'level-2'),
          getWordCountFromHeader(page, 'level-3'),
        ]);
        masteredOneDirectionCount = l2Count;
        masteredVocabularyWordsCount = l3Count; // This count is crucial for the while loop condition
      } else {
        console.log('No more questions available in Reverse, but target not met. Stuck?');
        masteredOneDirectionCount = await getWordCountFromHeader(page, 'level-2');
        masteredVocabularyWordsCount = await getWordCountFromHeader(page, 'level-3');
        const currentL0Count = await getWordCountFromHeader(page, 'level-0');
        const currentL1Count = await getWordCountFromHeader(page, 'level-1');
        console.error(
          `Stuck! Mastered L3: ${masteredVocabularyWordsCount}/${targetMasteredCount}. Remaining L0: ${currentL0Count}, L1: ${currentL1Count}, L2: ${masteredOneDirectionCount}`
        );
        break; // Exit the main loop as we are stuck
      }
    } // --- End of Main Quiz Loop ---

    // --- Final Assertions ---
    console.log('\n--- Quiz Loop Finished ---');

    const finalL2Count = await getWordCountFromHeader(page, 'level-2');
    const finalL3Count = await getWordCountFromHeader(page, 'level-3');
    const finalProgressPoints = finalL2Count + finalL3Count;
    const maxProgressPoints = 2 * targetMasteredCount;
    const finalProgressPercentage = maxProgressPoints > 0 ? ((finalProgressPoints / maxProgressPoints) * 100).toFixed(1) : 'N/A';

    console.log(
      `Final State - Mastered L3: ${finalL3Count} (Target was ${targetMasteredCount}) | Mastered L2: ${finalL2Count} | Total Progress Points: ${finalProgressPoints}/${maxProgressPoints} (${finalProgressPercentage}%) | Consecutive Errors: ${consecutiveErrorsCount}`
    );

    if (consecutiveErrorsCount >= MAX_CONSECUTIVE_ERRORS_BEFORE_FAIL) {
      console.error(`Test failed due to max consecutive errors (${MAX_CONSECUTIVE_ERRORS_BEFORE_FAIL}).`);
      test.fail(true, `Reached max consecutive errors. Final mastered L3: ${finalL3Count}/${targetMasteredCount}`);
    } else if (finalL3Count < targetMasteredCount) {
      console.error(`Test failed: Target L3 count not reached. Mastered L3: ${finalL3Count}/${targetMasteredCount}`);
      test.fail(true, `Target L3 count not reached. Mastered L3: ${finalL3Count}/${targetMasteredCount}`);
    } else {
      expect(finalL3Count, `Expected all ${targetMasteredCount} words to reach L3.`).toEqual(targetMasteredCount);
      console.log(`✅ Test Passed: Successfully mastered all ${finalL3Count} words to L3.`);
    }
  });
});
