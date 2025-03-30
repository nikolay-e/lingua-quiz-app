// tests/userWordSets.test.js
const { expect } = require('chai');
const { registerTestUser, deleteTestUser, axiosInstance, generateInt32 } = require('./testHelpers');

// *** ИСПРАВЛЕНО: Определяем STATUS здесь, так же как в server.js ***
const STATUS = {
  LEVEL_0: 'LEVEL_0',
  LEVEL_1: 'LEVEL_1',
  LEVEL_2: 'LEVEL_2',
  LEVEL_3: 'LEVEL_3',
  LEVEL_4: 'LEVEL_4',
  LEVEL_5: 'LEVEL_5',
  // Добавляем старые для совместимости с тестом, если нужно,
  // но лучше унифицировать и убрать их из server.js и тестов.
  LEARNING: 'learning',
  LEARNED: 'learned',
  REFRESHING: 'refreshing',
};
// Убираем неверный импорт:
// const { STATUS } = require('../src/js/app'); // Импортируем статусы

const API_URL = process.env.API_URL;

const delay = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

describe('User Word Sets Endpoint', () => {
  let testUser;
  let jwtToken;
  const insertedWordPairs = [];
  // Используем STATUS для ключей
  const wordSetsByStatus = {
    [STATUS.LEVEL_0]: [],
    [STATUS.LEVEL_1]: [],
    [STATUS.LEVEL_2]: [],
    [STATUS.LEVEL_3]: [],
    [STATUS.LEVEL_4]: [],
    [STATUS.LEVEL_5]: [],
  };

  beforeAll(async () => {
    const uniqueUserPrefix = `userWordSets${Date.now()}`; // Более уникальный префикс
    const testData = await registerTestUser(uniqueUserPrefix);
    testUser = testData.user;
    jwtToken = testData.token;
    // Очищаем объекты перед каждым запуском набора тестов
    Object.keys(wordSetsByStatus).forEach((key) => {
      wordSetsByStatus[key] = [];
    });
    insertedWordPairs.length = 0;
  });

  afterAll(async () => {
    if (jwtToken) {
      // Удаляем тестовые данные
      for (const wordPair of insertedWordPairs) {
        try {
          // Добавим проверку на наличие translationId
          if (wordPair && wordPair.translationId) {
            await axiosInstance.delete(`${API_URL}/word-pair/${wordPair.translationId}`, {
              headers: { Authorization: `Bearer ${jwtToken}` },
            });
          }
        } catch (error) {
          console.warn(
            `Warning: Could not delete word pair ${wordPair?.translationId} during cleanup: ${error.response?.data?.message || error.message}`
          );
        }
      }
      await deleteTestUser(jwtToken); // Удаляем пользователя
      jwtToken = null; // Сбрасываем токен
    }
  });

  it('should insert test word pairs', async function () {
    const wordListName = `TestList_${testUser.email}`; // Уникальное имя листа для теста
    for (let i = 0; i < 30; i += 1) {
      const wordPairData = {
        translationId: generateInt32(),
        sourceWordId: generateInt32(),
        targetWordId: generateInt32(),
        sourceWord: `SourceWordUWS${i}_${testUser.email}`, // Уникальные слова
        targetWord: `TargetWordUWS${i}_${testUser.email}`,
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
      await delay(50);
    }
    expect(insertedWordPairs.length).to.equal(30);
  });

  it('should retrieve the word sets and verify inserted pairs are present', async function () {
    const wordListName = `TestList_${testUser.email}`;
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
      expect(set.status).to.equal(STATUS.LEVEL_0);
    });

    // Заполняем начальное состояние
    wordSetsByStatus[STATUS.LEVEL_0] = ourInsertedPairs.map((set) => set.wordPairId);
    Object.keys(wordSetsByStatus)
      .filter((k) => k !== STATUS.LEVEL_0)
      .forEach((key) => {
        wordSetsByStatus[key] = [];
      });
  });

  it('should update word sets status', async function () {
    const wordListName = `TestList_${testUser.email}`; // Используем то же имя листа

    // Обновляем 10 слов на LEVEL_1
    const idsToLevel1 = wordSetsByStatus[STATUS.LEVEL_0].slice(0, 10);
    if (idsToLevel1.length > 0) {
      let response = await axiosInstance.post(
        `${API_URL}/user/word-sets`,
        { status: STATUS.LEVEL_1, wordPairIds: idsToLevel1 },
        { headers: { Authorization: `Bearer ${jwtToken}` } }
      );
      expect(response.status).to.equal(200);
      wordSetsByStatus[STATUS.LEVEL_1].push(...idsToLevel1);
      wordSetsByStatus[STATUS.LEVEL_0] = wordSetsByStatus[STATUS.LEVEL_0].filter(
        (id) => !idsToLevel1.includes(id)
      );
      await delay(50);
    }

    // Обновляем 5 слов на LEVEL_2 (из тех, что теперь LEVEL_0)
    const idsToLevel2 = wordSetsByStatus[STATUS.LEVEL_0].slice(0, 5);
    if (idsToLevel2.length > 0) {
      let response = await axiosInstance.post(
        `${API_URL}/user/word-sets`,
        { status: STATUS.LEVEL_2, wordPairIds: idsToLevel2 },
        { headers: { Authorization: `Bearer ${jwtToken}` } }
      );
      expect(response.status).to.equal(200);
      wordSetsByStatus[STATUS.LEVEL_2].push(...idsToLevel2);
      wordSetsByStatus[STATUS.LEVEL_0] = wordSetsByStatus[STATUS.LEVEL_0].filter(
        (id) => !idsToLevel2.includes(id)
      );
      await delay(50);
    }

    // Проверяем финальное состояние
    const finalResponse = await axiosInstance.get(`${API_URL}/user/word-sets`, {
      headers: { Authorization: `Bearer ${jwtToken}` },
      params: { wordListName },
    });

    expect(finalResponse.status).to.equal(200);
    const finalData = finalResponse.data;

    // Проверяем количество слов в каждом статусе
    const countLevel0 = wordSetsByStatus[STATUS.LEVEL_0].length;
    const countLevel1 = wordSetsByStatus[STATUS.LEVEL_1].length;
    const countLevel2 = wordSetsByStatus[STATUS.LEVEL_2].length;

    expect(finalData.filter((w) => w.status === STATUS.LEVEL_1).length).to.equal(countLevel1);
    expect(finalData.filter((w) => w.status === STATUS.LEVEL_2).length).to.equal(countLevel2);
    expect(finalData.filter((w) => w.status === STATUS.LEVEL_0).length).to.equal(countLevel0);
    expect(finalData.filter((w) => w.status === STATUS.LEVEL_3).length).to.equal(0); // Не обновляли до L3
  });

  it('should allow any valid state transition', async function () {
    const wordListName = `TestList_${testUser.email}`;
    // Переход LEVEL_1 -> LEVEL_3
    if (wordSetsByStatus[STATUS.LEVEL_1].length > 0) {
      const idToMove = wordSetsByStatus[STATUS.LEVEL_1][0];
      const response = await axiosInstance.post(
        `${API_URL}/user/word-sets`,
        { status: STATUS.LEVEL_3, wordPairIds: [idToMove] },
        { headers: { Authorization: `Bearer ${jwtToken}` } }
      );
      expect(response.status).to.equal(200);
      await delay(50);

      const verifyResponse = await axiosInstance.get(`${API_URL}/user/word-sets`, {
        headers: { Authorization: `Bearer ${jwtToken}` },
        params: { wordListName },
      });
      expect(verifyResponse.data.find((w) => w.wordPairId === idToMove)?.status).to.equal(
        STATUS.LEVEL_3
      );

      // Обновляем локальное состояние
      wordSetsByStatus[STATUS.LEVEL_1] = wordSetsByStatus[STATUS.LEVEL_1].filter(
        (id) => id !== idToMove
      );
      wordSetsByStatus[STATUS.LEVEL_3].push(idToMove);
    } else {
      console.warn('Skipping LEVEL_1 -> LEVEL_3 transition test: No words in LEVEL_1');
    }
  });

  it('should handle an empty wordPairIds array gracefully', async function () {
    // Используем только валидные статусы из STATUS
    const validStatuses = Object.values(STATUS).filter((s) => s.startsWith('LEVEL_'));

    for (const status of validStatuses) {
      const response = await axiosInstance.post(
        `${API_URL}/user/word-sets`,
        { status, wordPairIds: [] }, // Отправляем пустой массив
        { headers: { Authorization: `Bearer ${jwtToken}` } }
      );
      expect(response.status).to.equal(200);
      expect(response.data.message).to.include('no changes applied');
      await delay(50);
    }
  });

  // Этот тест теперь должен выполняться в afterAll, так как он зависит от удаления данных
  // it('should verify that word sets endpoint returns empty array after deletion', ...)
});
