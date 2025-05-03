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
const { pool } = require('./connection');
const { DatabaseError } = require('../utils/errors');
const { convertKeysToCamelCase } = require('../utils/helpers');

/**
 * Gets a user's word sets
 * @param {number} userId - The user ID
 * @param {string} wordListName - The name of the word list
 * @returns {Promise<Array>} - The word sets
 */
async function getUserWordSets(userId, wordListName) {
  try {
    const result = await pool.query('SELECT * FROM get_user_word_sets($1, $2)', [
      userId,
      wordListName,
    ]);

    return convertKeysToCamelCase(result.rows);
  } catch (error) {
    throw new DatabaseError('Error getting user word sets', error);
  }
}

/**
 * Updates a user's word set status
 * @param {number} userId - The user ID
 * @param {Array<number>} wordPairIds - Array of word pair IDs
 * @param {string} status - The new status
 * @returns {Promise<void>}
 */
async function updateUserWordSetStatus(userId, wordPairIds, status) {
  try {
    if (wordPairIds.length === 0) {
      return;
    }

    const wordPairIdsArray = `{${wordPairIds.join(',')}}`;
    await pool.query('SELECT update_user_word_set_status($1, $2, $3::translation_status)', [
      userId,
      wordPairIdsArray,
      status,
    ]);
  } catch (error) {
    // Special handling for the custom error from the stored procedure
    if (error.message && error.message.includes('Invalid status transition')) {
      const customError = new DatabaseError('Invalid status transition', error);
      customError.statusCode = 400;
      throw customError;
    }

    throw new DatabaseError('Error updating user word set status', error);
  }
}

/**
 * Gets all word lists
 * @returns {Promise<Array>} - The word lists
 */
async function getWordLists() {
  try {
    const result = await pool.query('SELECT * FROM get_word_lists()');
    return convertKeysToCamelCase(result.rows);
  } catch (error) {
    throw new DatabaseError('Error getting word lists', error);
  }
}

/**
 * Gets a word set by ID with all its words
 * @param {number} wordSetId - The word set ID
 * @returns {Promise<Object>} - The word set with words
 */
async function getWordSetById(wordSetId) {
  try {
    // Get word set details
    const wordSetResult = await pool.query(
      'SELECT id, name, created_at, updated_at FROM word_list WHERE id = $1',
      [wordSetId]
    );

    if (wordSetResult.rows.length === 0) {
      const error = new Error(`Word set with ID ${wordSetId} not found`);
      error.statusCode = 404;
      throw error;
    }

    const wordSet = convertKeysToCamelCase(wordSetResult.rows[0]);

    // Get words for this word set
    const wordsResult = await pool.query(
      `
      SELECT 
        t.id as translation_id,
        sw.id as source_word_id,
        tw.id as target_word_id,
        sw.text as source_word,
        tw.text as target_word,
        sl.name as source_language,
        tl.name as target_language,
        sw.usage_example as source_example,
        tw.usage_example as target_example
      FROM word_list_entry wle
      JOIN translation t ON wle.translation_id = t.id
      JOIN word sw ON t.source_word_id = sw.id
      JOIN word tw ON t.target_word_id = tw.id
      JOIN language sl ON sw.language_id = sl.id
      JOIN language tl ON tw.language_id = tl.id
      WHERE wle.word_list_id = $1
      ORDER BY wle.id
    `,
      [wordSetId]
    );

    wordSet.words = convertKeysToCamelCase(wordsResult.rows);
    return wordSet;
  } catch (error) {
    if (error.statusCode === 404) {
      throw error;
    }
    throw new DatabaseError(`Error getting word set with ID ${wordSetId}`, error);
  }
}

module.exports = {
  getUserWordSets,
  updateUserWordSetStatus,
  getWordLists,
  getWordSetById,
};
