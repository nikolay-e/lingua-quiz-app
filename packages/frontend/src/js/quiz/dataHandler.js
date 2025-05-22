import { createApp } from '../app.js';
import serverAddress from '../config.js';
import { AuthUtils } from '../utils/authUtils.js';
import { errorHandler } from '../utils/errorHandler.js';

export async function fetchUserWordSets(token, wordListName) {
  try {
    if (!AuthUtils.isValidToken(token)) {
      AuthUtils.redirectToLogin();
      return null;
    }

    const response = await fetch(`${serverAddress}/word-sets/user?wordListName=${encodeURIComponent(wordListName)}`, {
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
      throw new Error('Failed to fetch user word sets');
    }

    const data = await response.json();
    return createApp(data);
  } catch (error) {
    console.error('Error fetching user word sets:', error);
    errorHandler.handleApiError(error);
    throw error;
  }
}

export async function fetchWordSets(token) {
  try {
    if (!AuthUtils.isValidToken(token)) {
      AuthUtils.redirectToLogin();
      return null;
    }

    const response = await fetch(`${serverAddress}/word-sets`, {
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
      throw new Error('Failed to fetch word sets');
    }

    const data = await response.json();
    return data;
  } catch (error) {
    console.error('Error fetching word sets:', error);
    errorHandler.handleApiError(error);
    throw error;
  }
}
