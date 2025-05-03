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
const db = require('../db');

/**
 * Gets a user's word sets
 * @param {number} userId - The user ID
 * @param {string} wordListName - The name of the word list
 * @returns {Promise<Array>} - The word sets
 */
async function getUserWordSets(userId, wordListName) {
  return await db.getUserWordSets(userId, wordListName);
}

/**
 * Updates a user's word set status
 * @param {number} userId - The user ID
 * @param {Array<number>} wordPairIds - Array of word pair IDs
 * @param {string} status - The new status
 * @returns {Promise<{ message: string }>}
 */
async function updateUserWordSetStatus(userId, wordPairIds, status) {
  // Don't update if the array is empty
  if (wordPairIds.length === 0) {
    return {
      message: 'Word sets status update request received (no changes applied for empty list).',
    };
  }

  await db.updateUserWordSetStatus(userId, wordPairIds, status);

  return { message: 'Word sets status updated successfully' };
}

/**
 * Gets all word lists
 * @returns {Promise<Array>} - The word lists
 */
async function getWordLists() {
  return await db.getWordLists();
}

/**
 * Gets a word set by ID with all its words
 * @param {number} wordSetId - The word set ID
 * @returns {Promise<Object>} - The word set with words
 */
async function getWordSetById(wordSetId) {
  return await db.getWordSetById(wordSetId);
}

module.exports = {
  getUserWordSets,
  updateUserWordSetStatus,
  getWordLists,
  getWordSetById,
};
