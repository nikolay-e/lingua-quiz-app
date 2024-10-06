const { expect } = require('chai');
const { registerTestUser, deleteTestUser, axiosInstance, generateInt32 } = require('./testHelpers');

const API_URL = process.env.API_URL;

const delay = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

describe('User Word Sets Endpoint', () => {
  let testUser;
  let jwtToken;
  const insertedWordPairs = [];
  const wordSetsByStatus = {
    'Upcoming Words': [],
    'Focus Words': [],
    'Mastered One Direction': [],
    'Mastered Vocabulary': [],
  };

  beforeAll(async () => {
    const testData = await registerTestUser("userWordSets");
    testUser = testData.user;
    jwtToken = testData.token;
  });

  afterAll(async () => {
    await deleteTestUser(jwtToken);
  });

  it('should insert test word pairs', async function () {
    const wordListName = 'TestUserWordSets';
    for (let i = 0; i < 30; i += 1) {
      const wordPairData = {
        translationId: generateInt32(),
        sourceWordId: generateInt32(),
        targetWordId: generateInt32(),
        sourceWord: `SourceWord${i}`,
        targetWord: `TargetWord${i}`,
        sourceLanguageName: 'English',
        targetLanguageName: 'Russian',
        wordListName,
        sourceWordUsageExample: `This is example ${i} in English`,
        targetWordUsageExample: `Это пример ${i} на русском`,
      };

      const response = await axiosInstance.post(`${API_URL}/word-pair`, wordPairData, {
        headers: { Authorization: `Bearer ${jwtToken}` },
      });

      expect(response.status).to.equal(201);
      expect(response.data.message).to.equal('Word pair inserted successfully');

      insertedWordPairs.push(wordPairData);
      await delay(100);
    }
  });

  it('should retrieve the word sets and verify inserted pairs are present', async function () {
    const wordListName = 'TestUserWordSets';
    const response = await axiosInstance.get(`${API_URL}/user/word-sets`, {
      headers: { Authorization: `Bearer ${jwtToken}` },
      params: { wordListName },
    });

    expect(response.status).to.equal(200);
    expect(response.data).to.be.an('array');

    const ourInsertedPairs = response.data.filter((set) =>
      insertedWordPairs.some((pair) => pair.translationId === set.wordPairId)
    );

    expect(ourInsertedPairs).to.have.lengthOf(30, 'All inserted word pairs should be present');

    ourInsertedPairs.forEach((set) => {
      const originalPair = insertedWordPairs.find((pair) => pair.translationId === set.wordPairId);
      expect(set.sourceWordUsageExample).to.equal(originalPair.sourceWordUsageExample);
      expect(set.targetWordUsageExample).to.equal(originalPair.targetWordUsageExample);
      expect(set.status).to.equal('Upcoming Words');
    });

    wordSetsByStatus['Upcoming Words'] = ourInsertedPairs.map((set) => set.wordPairId);
  });

  it('should update word sets following the correct transition order', async function () {
    const wordUpdates = [
      { prevStatus: 'Upcoming Words', status: 'Focus Words', count: 10 },
      { prevStatus: 'Focus Words', status: 'Mastered One Direction', count: 5 },
      { prevStatus: 'Mastered One Direction', status: 'Mastered Vocabulary', count: 3 },
      { prevStatus: 'Mastered Vocabulary', status: 'Upcoming Words', count: 2 },
    ];

    for (const { prevStatus, status, count } of wordUpdates) {
      const wordPairIds = wordSetsByStatus[prevStatus].slice(0, count);
      const updateResponse = await axiosInstance.post(
        `${API_URL}/user/word-sets`,
        { status, wordPairIds },
        { headers: { Authorization: `Bearer ${jwtToken}` } }
      );
      expect(updateResponse.status).to.equal(200);

      wordSetsByStatus[status] = [...wordSetsByStatus[status], ...wordPairIds];
      wordSetsByStatus[prevStatus] = wordSetsByStatus[prevStatus].filter(
        (id) => !wordPairIds.includes(id)
      );

      await delay(100);
    }

    const finalResponse = await axiosInstance.get(`${API_URL}/user/word-sets`, {
      headers: { Authorization: `Bearer ${jwtToken}` },
      params: { wordListName: 'TestUserWordSets' },
    });

    const ourUpdatedPairs = finalResponse.data.filter((set) =>
      insertedWordPairs.some((pair) => pair.translationId === set.wordPairId)
    );

    expect(ourUpdatedPairs).to.have.lengthOf(30);

    const statusCounts = ourUpdatedPairs.reduce((acc, set) => {
      acc[set.status] = (acc[set.status] || 0) + 1;
      return acc;
    }, {});

    expect(statusCounts['Focus Words']).to.equal(5);
    expect(statusCounts['Mastered One Direction']).to.equal(2);
    expect(statusCounts['Mastered Vocabulary']).to.equal(1);
    expect(statusCounts['Upcoming Words']).to.equal(22);

    for (const [status, ids] of Object.entries(wordSetsByStatus)) {
      ids.forEach((id) => {
        const set = ourUpdatedPairs.find((s) => s.wordPairId === id);
        expect(set).to.exist;
        expect(set.status).to.equal(status);
      });
    }
  });

  it('should reject invalid state transitions', async function () {
    const invalidTransitions = [
      { from: 'Upcoming Words', to: 'Mastered One Direction' },
      { from: 'Focus Words', to: 'Mastered Vocabulary' },
      { from: 'Mastered One Direction', to: 'Focus Words' },
      { from: 'Mastered Vocabulary', to: 'Focus Words' },
    ];

    for (const { from, to } of invalidTransitions) {
      if (wordSetsByStatus[from].length > 0) {
        try {
          await axiosInstance.post(
            `${API_URL}/user/word-sets`,
            {
              status: to,
              wordPairIds: [wordSetsByStatus[from][0]],
            },
            { headers: { Authorization: `Bearer ${jwtToken}` } }
          );
          // If the request doesn't throw, fail the test
          expect.fail('Expected request to fail');
        } catch (error) {
          expect(error.response.status).to.equal(400);
          expect(error.response.data.message).to.equal('Invalid request. Please check your input and try again.');
        }
      }
    }
  });

  it('should allow cycling back to Upcoming Words from Mastered Vocabulary', async function () {
    if (wordSetsByStatus['Mastered Vocabulary'].length > 0) {
      const wordPairId = wordSetsByStatus['Mastered Vocabulary'][0];
      const updateResponse = await axiosInstance.post(
        `${API_URL}/user/word-sets`,
        {
          status: 'Upcoming Words',
          wordPairIds: [wordPairId],
        },
        { headers: { Authorization: `Bearer ${jwtToken}` } }
      );
      expect(updateResponse.status).to.equal(200);

      const finalResponse = await axiosInstance.get(`${API_URL}/user/word-sets`, {
        headers: { Authorization: `Bearer ${jwtToken}` },
        params: { wordListName: 'TestUserWordSets' },
      });

      const updatedWord = finalResponse.data.find((set) => set.wordPairId === wordPairId);
      expect(updatedWord.status).to.equal('Upcoming Words');

      wordSetsByStatus['Mastered Vocabulary'] = wordSetsByStatus['Mastered Vocabulary'].filter(
        (id) => id !== wordPairId
      );
      wordSetsByStatus['Upcoming Words'].push(wordPairId);
    }
  });

  it('should handle an empty wordPairIds array for all statuses gracefully', async function () {
    const statuses = [
      'Focus Words',
      'Mastered One Direction',
      'Mastered Vocabulary',
      'Upcoming Words',
    ];

    for (const status of statuses) {
      const updateResponse = await axiosInstance.post(
        `${API_URL}/user/word-sets`,
        { status, wordPairIds: [] },
        { headers: { Authorization: `Bearer ${jwtToken}` } }
      );
      expect(updateResponse.status).to.equal(200);
    }

    const finalResponse = await axiosInstance.get(`${API_URL}/user/word-sets`, {
      headers: { Authorization: `Bearer ${jwtToken}` },
      params: { wordListName: 'TestUserWordSets' },
    });

    const ourPairs = finalResponse.data.filter((set) =>
      insertedWordPairs.some((pair) => pair.translationId === set.wordPairId)
    );

    expect(ourPairs).to.have.lengthOf(30);
  });

  it('should delete the inserted word pairs', async function () {
    for (const wordPair of insertedWordPairs) {
      const response = await axiosInstance.delete(
        `${API_URL}/word-pair/${wordPair.translationId}`,
        {
          headers: { Authorization: `Bearer ${jwtToken}` },
        }
      );
      expect(response.status).to.equal(200);
      expect(response.data.message).to.equal('Word pair and associated data removed successfully');
      await delay(100);
    }
  });

  it('should verify that inserted word pairs are removed', async function () {
    const wordListName = 'TestUserWordSets';
    try {
      await axiosInstance.get(`${API_URL}/user/word-sets`, {
        headers: { Authorization: `Bearer ${jwtToken}` },
        params: { wordListName },
      });
      // If we reach this point, it means no error was thrown (i.e., we didn't get a 404)
      throw new Error('Expected 404 error, but got a successful response');
    } catch (error) {
      if (error.response) {
        // The request was made and the server responded with a status code
        // that falls out of the range of 2xx
        expect(error.response.status).to.equal(404);
      } else {
        // Something happened in setting up the request that triggered an Error
        throw error;
      }
    }
  });
});

