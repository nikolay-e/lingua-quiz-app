const { expect } = require('chai');
const { registerTestUser, deleteTestUser, axiosInstance, generateInt32 } = require('./testHelpers');

const API_URL = process.env.API_URL;

const delay = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

describe('User Word Sets Endpoint', () => {
  let testUser;
  let jwtToken;
  const insertedWordPairs = [];
  const wordSetsByStatus = {
    LEVEL_0: [],
    LEVEL_1: [],
    LEVEL_2: [],
    LEVEL_3: [],
  };

  beforeAll(async () => {
    const testData = await registerTestUser('userWordSets');
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
      expect(set.status).to.equal('LEVEL_0');
    });

    wordSetsByStatus['LEVEL_0'] = ourInsertedPairs.map((set) => set.wordPairId);
  });

  it('should update word sets with any status transition', async function () {
    const wordUpdates = [
      { status: 'LEVEL_1', count: 10 },
      { status: 'LEVEL_2', count: 5 },
      { status: 'LEVEL_3', count: 3 },
      { status: 'LEVEL_0', count: 2 },
    ];

    for (const { status, count } of wordUpdates) {
      const wordPairIds = wordSetsByStatus['LEVEL_0'].slice(0, count);
      const updateResponse = await axiosInstance.post(
        `${API_URL}/user/word-sets`,
        { status, wordPairIds },
        { headers: { Authorization: `Bearer ${jwtToken}` } }
      );
      expect(updateResponse.status).to.equal(200);

      wordSetsByStatus[status] = [...wordSetsByStatus[status], ...wordPairIds];
      wordSetsByStatus['LEVEL_0'] = wordSetsByStatus['LEVEL_0'].filter(
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

    expect(statusCounts['LEVEL_1']).to.equal(10);
    expect(statusCounts['LEVEL_2']).to.equal(5);
    expect(statusCounts['LEVEL_3']).to.equal(3);
    expect(statusCounts['LEVEL_0']).to.equal(12);

    for (const [status, ids] of Object.entries(wordSetsByStatus)) {
      ids.forEach((id) => {
        const set = ourUpdatedPairs.find((s) => s.wordPairId === id);
        expect(set).to.exist;
        expect(set.status).to.equal(status);
      });
    }
  });

  it('should allow any state transition', async function () {
    const transitions = [
      { from: 'LEVEL_0', to: 'LEVEL_3' },
      { from: 'LEVEL_1', to: 'LEVEL_0' },
      { from: 'LEVEL_2', to: 'LEVEL_1' },
      { from: 'LEVEL_3', to: 'LEVEL_2' },
    ];

    for (const { from, to } of transitions) {
      if (wordSetsByStatus[from].length > 0) {
        const wordPairId = wordSetsByStatus[from][0];
        const updateResponse = await axiosInstance.post(
          `${API_URL}/user/word-sets`,
          {
            status: to,
            wordPairIds: [wordPairId],
          },
          { headers: { Authorization: `Bearer ${jwtToken}` } }
        );
        expect(updateResponse.status).to.equal(200);

        // Update our local tracking
        wordSetsByStatus[to].push(wordPairId);
        wordSetsByStatus[from] = wordSetsByStatus[from].filter((id) => id !== wordPairId);

        // Verify the change
        const verifyResponse = await axiosInstance.get(`${API_URL}/user/word-sets`, {
          headers: { Authorization: `Bearer ${jwtToken}` },
          params: { wordListName: 'TestUserWordSets' },
        });
        const updatedWord = verifyResponse.data.find((set) => set.wordPairId === wordPairId);
        expect(updatedWord.status).to.equal(to);
      }
    }
  });

  it('should handle an empty wordPairIds array for all statuses gracefully', async function () {
    const statuses = ['LEVEL_1', 'LEVEL_2', 'LEVEL_3', 'LEVEL_0'];

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
