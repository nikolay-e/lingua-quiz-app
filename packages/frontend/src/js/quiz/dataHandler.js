import { createApp } from '../app.js';
import { errorHandler } from '../utils/errorHandler.js';
import { AuthUtils } from '../utils/authUtils.js';
import serverAddress from '../config.js';

export async function fetchWordSets(token, wordListName) {
  try {
    if (!AuthUtils.isValidToken(token)) {
      AuthUtils.redirectToLogin();
      return null;
    }

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
      if (response.status === 401) {
        AuthUtils.clearAuth();
        AuthUtils.redirectToLogin();
        return null;
      }
      throw new Error('Failed to fetch word sets');
    }

    const data = await response.json();
    return createApp(data);
  } catch (error) {
    console.error('Error fetching word sets:', error);
    errorHandler.handleApiError(error);
    throw error;
  }
}

export async function fetchWordLists(token) {
  try {
    if (!AuthUtils.isValidToken(token)) {
      AuthUtils.redirectToLogin();
      return null;
    }

    const response = await fetch(`${serverAddress}/word-lists`, {
      method: 'GET',
      headers: {
        Authorization: `Bearer ${token}`,
      },
    });

    if (!response.ok) {
      if (response.status === 401) {
        AuthUtils.clearAuth();
        AuthUtils.redirectToLogin();
        return null;
      }
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
