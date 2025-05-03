/*
 * LinguaQuiz – Copyright © 2025 Nikolay Eremeev
 *
 * Dual-licensed:
 *  – Non-Commercial Source-Available v2  →  see LICENSE-NONCOMMERCIAL.md
 *  – Commercial License v2              →  see LICENSE-COMMERCIAL.md
 *
 * Contact: lingua-quiz@nikolay-eremeev.com
 * Repository: https://github.com/nikolay-e/lingua-quiz
 */
import { createApp } from '../app.js';
import serverAddress from '../config.js';
import { AuthUtils } from '../utils/authUtils.js';
import { errorHandler } from '../utils/errorHandler.js';

export async function fetchWordSets(token, wordListName) {
  console.debug(`[dataHandler] fetchWordSets called with wordListName: ${wordListName}`);
  console.debug(`[dataHandler] Using serverAddress: ${serverAddress}`);
  console.debug(`[dataHandler] LocalStorage token exists: ${!!localStorage.getItem('token')}`);

  if (!serverAddress) {
    // <<< Check if serverAddress was determined
    console.error('[dataHandler] API URL is not configured. Cannot fetch word sets.');
    errorHandler.showError('API URL is not configured. Cannot fetch word sets.');
    throw new Error('API URL not configured.');
  }

  try {
    // Log token state (without exposing actual token)
    console.debug(`[dataHandler] Token present: ${!!token}`);

    // Add more token debugging information
    if (token) {
      const tokenPrefix = token.slice(0, 5);
      const tokenSuffix = token.slice(Math.max(0, token.length - 5));
      console.debug(`[dataHandler] Token sample: ${tokenPrefix}...${tokenSuffix}`);

      try {
        // Try to decode token payload (if it's a JWT) to see expiry
        const tokenParts = token.split('.');
        if (tokenParts.length === 3) {
          const payload = JSON.parse(atob(tokenParts[1]));
          const expiry = payload.exp ? new Date(payload.exp * 1000).toISOString() : 'none';
          console.debug(
            `[dataHandler] Token expiry: ${expiry}, user ID: ${payload.userId || 'none'}`
          );
        }
      } catch (error) {
        console.debug(`[dataHandler] Token doesn't appear to be a valid JWT: ${error.message}`);
      }
    } else {
      console.error('[dataHandler] Token is null or undefined, API call will fail');
    }

    // Use the encapsulated method to check token validity, clear if invalid,
    // and redirect if needed - all as a single atomic operation
    if (AuthUtils.handleTokenExpiration() === false) {
      console.warn('[dataHandler] Token validation failed, aborting fetch');
      return null;
    }

    // Make sure wordListName is correctly passed and encoded
    if (!wordListName || typeof wordListName !== 'string') {
      console.error(`[dataHandler] Invalid wordListName parameter: ${wordListName}`);
      throw new Error(`Invalid wordListName: ${wordListName}. Must be a non-empty string.`);
    }

    // Double-check encoding of wordListName
    const trimmedWordListName = wordListName.trim();
    const encodedWordListName = encodeURIComponent(trimmedWordListName);

    // Log both the original and encoded values
    console.debug(
      `[dataHandler] WordListName: "${wordListName}" (trimmed: "${trimmedWordListName}", encoded: "${encodedWordListName}")`
    );

    const apiUrl = `${serverAddress}/api/word-sets/user?wordListName=${encodedWordListName}`;
    console.debug(`[dataHandler] Fetching word sets from: ${apiUrl}`);

    console.debug(
      `[dataHandler] Making fetch request with token: ${token ? 'present' : 'missing'}`
    );

    let response;
    try {
      response = await fetch(apiUrl, {
        method: 'GET',
        headers: {
          Authorization: `Bearer ${token}`,
        },
      });

      console.debug(`[dataHandler] Response status: ${response.status} ${response.statusText}`);
      console.debug(`[dataHandler] Response URL: ${response.url}`);

      // Log response headers
      const headers = {};
      for (const [name, value] of response.headers.entries()) {
        headers[name] = value;
      }
      console.debug(`[dataHandler] Response headers:`, headers);
    } catch (fetchError) {
      console.error(`[dataHandler] Fetch error: ${fetchError.message}`);
      console.error(`[dataHandler] Fetch error stack: ${fetchError.stack}`);
      throw fetchError;
    }

    if (!response.ok) {
      if (response.status === 401) {
        console.warn('[dataHandler] 401 Unauthorized response from API');
        console.error('[dataHandler] This suggests the token is invalid, expired, or missing');
        // Use the encapsulated method for consistency
        AuthUtils.handleTokenExpiration();
        return null;
      }

      try {
        // Try to get detailed error info from response
        const contentType = response.headers.get('content-type');
        console.debug(`[dataHandler] Error response content type: ${contentType}`);

        if (contentType && contentType.includes('application/json')) {
          const errorData = await response.json();
          const errorMessage =
            errorData.message || `Failed to fetch word sets (Status: ${response.status})`;
          console.error(`[dataHandler] API error: ${errorMessage}`, errorData);
          throw new Error(errorMessage);
        } else {
          // If not JSON, try to get the text
          const textResponse = await response.text();
          console.error(
            `[dataHandler] API error (${response.status}): Non-JSON response:`,
            textResponse
          );
          throw new Error(`Failed to fetch word sets (Status: ${response.status})`);
        }
      } catch (parseError) {
        console.error(`[dataHandler] Failed to parse error response: ${parseError.message}`);
        console.error(
          `[dataHandler] Original HTTP error: ${response.status} ${response.statusText}`
        );
        throw new Error(
          `Failed to fetch word sets (Status: ${response.status}): ${parseError.message}`
        );
      }
    }

    let wordSetData = await response.json();
    console.debug(
      `[dataHandler] Successfully fetched word sets. Length: ${wordSetData.length}, First item sample:`,
      wordSetData.length > 0 ? JSON.stringify(wordSetData[0]) : 'No data'
    );

    // Validate data to prevent the "Cannot read properties of null (reading 'source')" error
    if (!wordSetData) {
      console.error(
        `[dataHandler] wordSetData is null or undefined. This should never happen with a 200 OK response.`
      );
      errorHandler.showError('Invalid response from server. No word data received.');
      return null;
    }

    if (!Array.isArray(wordSetData)) {
      console.error(`[dataHandler] Expected array but got ${typeof wordSetData}:`, wordSetData);
      errorHandler.showError(
        'Invalid response format from server. Expected an array of word pairs.'
      );
      return null;
    }

    console.debug(`[dataHandler] Validating ${wordSetData.length} received items`);

    // Log the first few items for debugging
    for (let i = 0; i < Math.min(wordSetData.length, 3); i++) {
      console.debug(`[dataHandler] Item ${i}:`, JSON.stringify(wordSetData[i]));
    }

    // Check for data issues that could cause the error
    const invalidItems = [];
    const validItems = wordSetData.filter((item, index) => {
      // More thorough validation to prevent "Cannot read properties of null" errors
      const isValid =
        item &&
        typeof item === 'object' &&
        item.wordPairId !== null &&
        item.wordPairId !== undefined &&
        item.sourceWord &&
        typeof item.sourceWord === 'string' &&
        item.targetWord &&
        typeof item.targetWord === 'string';

      if (!isValid) {
        console.error(`[dataHandler] Invalid item at index ${index}:`, JSON.stringify(item));
        invalidItems.push({ index, item });
      }
      return isValid;
    });

    // Log any invalid items for debugging
    if (invalidItems.length > 0) {
      console.error(
        `[dataHandler] Found ${invalidItems.length} invalid items:`,
        JSON.stringify(invalidItems.slice(0, 3))
      );
    }

    if (validItems.length === 0) {
      console.error(`[dataHandler] No valid word pairs found in data. Returning null.`);
      errorHandler.showError(
        'No valid word pairs found for this quiz. Please select another quiz.'
      );
      return null;
    }

    // If some items were filtered out, warn but continue with valid items
    if (validItems.length < wordSetData.length) {
      console.warn(
        `[dataHandler] Filtered out ${wordSetData.length - validItems.length} invalid word pairs`
      );
      wordSetData = validItems;
    }

    // Create app from validated data
    const appInstance = createApp(wordSetData);
    console.debug(`[dataHandler] App instance created: ${!!appInstance}`);

    return appInstance;
  } catch (error) {
    console.error('[dataHandler] Error fetching word sets:', error);
    errorHandler.handleApiError(error.message ? error : new Error('Failed to fetch word sets'));
    // Don't rethrow the error after handling it to prevent unhandled rejections
    return null;
  }
}

export async function fetchWordLists(token) {
  console.debug('[dataHandler] fetchWordLists called');
  console.debug(`[dataHandler] Using serverAddress: ${serverAddress}`);

  if (!serverAddress) {
    // <<< Check if serverAddress was determined
    console.error('[dataHandler] API URL is not configured. Cannot fetch word lists.');
    errorHandler.showError('API URL is not configured. Cannot fetch word lists.');
    throw new Error('API URL not configured.');
  }

  try {
    // Log token state (without exposing actual token)
    console.debug(`[dataHandler] Token present in fetchWordLists: ${!!token}`);

    // Use the encapsulated method to check token validity, clear if invalid,
    // and redirect if needed - all as a single atomic operation
    if (AuthUtils.handleTokenExpiration() === false) {
      console.warn('[dataHandler] Token validation failed in fetchWordLists, aborting fetch');
      return null;
    }

    const apiUrl = `${serverAddress}/api/word-sets`;
    console.debug(`[dataHandler] Fetching word lists from: ${apiUrl}`);

    const response = await fetch(apiUrl, {
      method: 'GET',
      headers: {
        Authorization: `Bearer ${token}`,
      },
    });

    console.debug(`[dataHandler] Word lists response status: ${response.status}`);

    if (!response.ok) {
      if (response.status === 401) {
        console.warn('[dataHandler] 401 Unauthorized response from API in fetchWordLists');
        // Use the encapsulated method for consistency
        AuthUtils.handleTokenExpiration();
        return null;
      }
      const errorData = await response.json().catch(() => ({}));
      const errorMessage =
        errorData.message || `Failed to fetch word lists (Status: ${response.status})`;
      console.error(`[dataHandler] API error fetching word lists: ${errorMessage}`);
      throw new Error(errorMessage);
    }

    const data = await response.json();
    console.debug(
      `[dataHandler] Successfully fetched word lists. Count: ${data.length}, Lists:`,
      data.map((list) => list.name).join(', ')
    );

    return data;
  } catch (error) {
    console.error('[dataHandler] Error fetching word lists:', error);
    console.error('[dataHandler] Error stack:', error.stack);
    errorHandler.handleApiError(error.message ? error : new Error('Failed to fetch word lists'));
    // Don't rethrow the error after handling it to prevent unhandled rejections
    return null;
  }
}
