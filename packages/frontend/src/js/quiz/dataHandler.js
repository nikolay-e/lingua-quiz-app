import { createApp } from '../app.js';
import { errorHandler } from '../utils/errorHandler.js';
import serverAddress from '../config.js';

export async function fetchWordSets(token, wordListName) {
  try {
    const response = await fetch(
      `${serverAddress}/user/word-sets?wordListName=${encodeURIComponent(wordListName)}`,
      {
        method: 'GET',
        headers: {
          Authorization: `Bearer ${token}`,
        },
      }
    );

    if (!response.ok) {
      throw new Error('Failed to fetch word sets');
    }

    const data = await response.json();
    return createApp(data); // Use createApp to handle instantiation and errors
  } catch (error) {
    console.error('Error fetching word sets:', error);
    errorHandler.handleApiError(error);
    throw error;
  }
}

export async function fetchWordLists(token) {
  try {
    const response = await fetch(`${serverAddress}/word-lists`, {
      method: 'GET',
      headers: {
        Authorization: `Bearer ${token}`,
      },
    });

    if (!response.ok) {
      throw new Error('Failed to fetch word lists');
    }

    const data = await response.json();
    return data;
  } catch (error) {
    console.error('Error fetching word lists:', error);
    errorHandler.handleApiError(error);
    throw error;
  }
}
