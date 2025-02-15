import serverAddress from '../config.js';
import { STATUS } from '../app.js';

// eslint-disable-next-line import/prefer-default-export
export async function saveQuizState(app, token) {
  const statusSets = {
    [STATUS.LEVEL_3]: app.wordStatusSets[STATUS.LEVEL_3],
    [STATUS.LEVEL_2]: app.wordStatusSets[STATUS.LEVEL_2],
    [STATUS.LEVEL_1]: app.wordStatusSets[STATUS.LEVEL_1],
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
