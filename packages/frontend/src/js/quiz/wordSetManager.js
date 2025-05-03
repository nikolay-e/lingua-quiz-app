import serverAddress from '../config.js'; // <<< Reverted import
import { STATUS } from '../constants.js';
import { errorHandler } from '../utils/errorHandler.js';

export async function saveQuizState(app, token) {
  if (!serverAddress) {
    const error = new Error('API URL not configured. Cannot save quiz state.');
    errorHandler.showError(error.message);
    throw error;
  }

  const statusSets = {
    [STATUS.LEVEL_3]: app.quizState.wordStatusSets[STATUS.LEVEL_3],
    [STATUS.LEVEL_2]: app.quizState.wordStatusSets[STATUS.LEVEL_2],
    [STATUS.LEVEL_1]: app.quizState.wordStatusSets[STATUS.LEVEL_1],
    [STATUS.LEVEL_0]: app.quizState.wordStatusSets[STATUS.LEVEL_0],
  };

  try {
    const promises = Object.entries(statusSets).map(async ([status, set]) => {
      const wordPairIds = [...set];

      // Optional: Skip fetch if no IDs for this status
      // if (wordPairIds.length === 0) {
      //   return Promise.resolve();
      // }

      const response = await fetch(`${serverAddress}/api/word-sets/user`, {
        // Updated to new API path
        method: 'POST',
        headers: {
          Authorization: `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          status,
          wordPairIds,
        }),
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData.message || `Failed to save quiz state for ${status}`);
      }
    });

    const results = await Promise.all(promises);
    return true;
  } catch (error) {
    console.error('Error saving quiz state:', error);
    errorHandler.handleApiError(error.message ? error : new Error('Failed to save quiz progress.'));
    return Promise.reject(error); // Propagate the error
  }
}
