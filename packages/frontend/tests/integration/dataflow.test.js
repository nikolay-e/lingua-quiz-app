// packages/frontend/tests/integration/dataflow.test.js
import { fetchWordSets, fetchWordLists } from '../../src/js/quiz/dataHandler.js';
import {
  errorHandler,
  AuthUtils,
  fetchMock,
  createMockToken,
  setupAuthState,
  testWordLists,
  getTestWordPairs,
  apiResponses,
} from '../__mocks__/integrationTestSetup.js';

describe('Data Flow Integration', () => {
  describe('Word Lists Fetching Flow', () => {
    it('should fetch word lists and return them with valid token', async () => {
      // Arrange - Set up valid token in localStorage
      const validToken = setupAuthState();

      // Prepare mock API response
      fetchMock.mockResponseOnce(JSON.stringify(testWordLists));

      // Act - Call the actual function that integrates with AuthUtils
      const result = await fetchWordLists(validToken);

      // Assert
      expect(fetchMock).toHaveBeenCalledTimes(1);
      expect(fetchMock).toHaveBeenCalledWith(
        'http://localhost:9000/api/word-sets',
        expect.objectContaining({
          headers: { Authorization: `Bearer ${validToken}` },
        })
      );
      expect(result).toEqual(testWordLists);
      expect(errorHandler.handleApiError).not.toHaveBeenCalled();
    });

    it('should handle 401 unauthorized by returning null', async () => {
      // Arrange - Set up valid token in localStorage
      const validToken = setupAuthState();

      // Prepare mock API response with 401
      fetchMock.mockResponseOnce(JSON.stringify({ message: 'Unauthorized' }), { status: 401 });

      // Act
      const result = await fetchWordLists(validToken);

      // Assert
      expect(result).toBeNull(); // This validates the core behavior
    });

    it('should handle server errors and return null', async () => {
      // Arrange
      const validToken = setupAuthState();
      fetchMock.mockResponseOnce(JSON.stringify({ message: 'Server error' }), { status: 500 });

      // Act
      const result = await fetchWordLists(validToken);

      // Assert
      expect(result).toBeNull();
    });

    it('should handle network errors gracefully', async () => {
      // Arrange
      const validToken = setupAuthState();
      fetchMock.mockRejectOnce(new Error('Network error'));

      // Act
      const result = await fetchWordLists(validToken);

      // Assert
      expect(result).toBeNull();
    });
  });

  describe('Word Sets Fetching Flow', () => {
    const wordListName = 'Spanish-English A1';

    it('should fetch word sets, create app instance and return it with valid token', async () => {
      // Arrange - Set up valid token in localStorage
      const validToken = setupAuthState();
      fetchMock.mockResponseOnce(JSON.stringify(getTestWordPairs()));

      // Act - Test the entire flow from API call to App instance creation
      const appInstance = await fetchWordSets(validToken, wordListName);

      // Assert
      expect(fetchMock).toHaveBeenCalledTimes(1);
      expect(fetchMock).toHaveBeenCalledWith(
        `http://localhost:9000/api/word-sets/user?wordListName=${encodeURIComponent(wordListName)}`,
        expect.objectContaining({
          headers: { Authorization: `Bearer ${validToken}` },
        })
      );

      // Verify app instance has expected structure
      expect(appInstance).not.toBeNull();
      expect(appInstance.quizState).toBeDefined();
      expect(appInstance.statsManager).toBeDefined();
      expect(appInstance.quizLogic).toBeDefined();

      // Verify data was loaded into app state
      expect(appInstance.quizState.quizTranslations.size).toBe(5); // Number of items in test data
      expect(appInstance.quizState.quizTranslations.get(1).sourceWord).toBe('hello');
      expect(appInstance.quizState.quizTranslations.get(2).targetWord).toBe('adiós');
    });

    it('should handle expired token by clearing it and returning null', async () => {
      // Arrange - Create an expired token (expired 1 hour ago)
      const expiredToken = createMockToken({}, -3600); // Expired 1 hour ago
      localStorage.setItem('token', expiredToken);

      // Act
      const result = await fetchWordSets(expiredToken, wordListName);

      // Assert
      expect(fetchMock).not.toHaveBeenCalled(); // API call should not be made with invalid token
      expect(result).toBeNull();
      // Token should be cleared from localStorage
      expect(localStorage.getItem('token')).toBeNull();
    });

    it('should handle 401 unauthorized response by returning null', async () => {
      // Arrange
      const validToken = setupAuthState();

      fetchMock.mockResponseOnce(JSON.stringify({ message: 'Unauthorized' }), { status: 401 });

      // Act
      const result = await fetchWordSets(validToken, wordListName);

      // Assert
      expect(result).toBeNull(); // This validates the core behavior
    });

    it('should filter out invalid word pairs when creating app instance', async () => {
      // Arrange
      const validToken = setupAuthState();
      const mixedData = [
        // Valid word pair
        getTestWordPairs()[0],
        // Invalid word pair (missing required fields)
        { sourceWord: 'invalid' },
        // Completely invalid entry
        'not an object',
      ];
      fetchMock.mockResponseOnce(JSON.stringify(mixedData));

      // Act
      const appInstance = await fetchWordSets(validToken, wordListName);

      // Assert
      expect(fetchMock).toHaveBeenCalledTimes(1);
      expect(appInstance).not.toBeNull();
      // Should only contain the valid word pair
      expect(appInstance.quizState.quizTranslations.size).toBe(1);
      expect(appInstance.quizState.quizTranslations.get(1).sourceWord).toBe('hello');
    });

    it('should return null if no valid word pairs found', async () => {
      // Arrange
      const validToken = setupAuthState();
      const invalidData = [{ sourceWord: 'invalid' }, 'not an object'];
      fetchMock.mockResponseOnce(JSON.stringify(invalidData));

      // Act
      const appInstance = await fetchWordSets(validToken, wordListName);

      // Assert
      expect(appInstance).toBeNull();
    });

    it('should handle network errors when fetching word sets', async () => {
      // Arrange
      const validToken = setupAuthState();
      fetchMock.mockRejectOnce(new Error('Network error'));

      // Act
      const appInstance = await fetchWordSets(validToken, wordListName);

      // Assert
      expect(appInstance).toBeNull();
    });
  });
});
