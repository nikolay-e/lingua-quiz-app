import serverAddress from '../config.js';
import { STATUS } from '../app.js';

// eslint-disable-next-line import/prefer-default-export
export async function saveQuizState(app, token) {
  const statusSets = {
    [STATUS.MASTERED_VOCABULARY]: app.wordStatusSets[STATUS.MASTERED_VOCABULARY],
    [STATUS.MASTERED_ONE_DIRECTION]: app.wordStatusSets[STATUS.MASTERED_ONE_DIRECTION],
    [STATUS.FOCUS]: app.wordStatusSets[STATUS.FOCUS],
  };

  try {
    const promises = Object.entries(statusSets).map(([status, set]) => {
      const wordPairIds = Array.from(set);

      return fetch(`${serverAddress}/user/word-sets`, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          status,
          wordPairIds,
        }),
      }).then((response) => {
        if (!response.ok) {
          throw new Error(`Failed to save quiz state for ${status}`);
        }
      });
    });

    await Promise.all(promises);
  } catch (error) {
    console.error('Error saving quiz state:', error);
    throw error;
  }
}
