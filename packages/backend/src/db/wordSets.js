/*
 * LinguaQuiz - Copyright © 2025 Nikolay Eremeev
 *
 * Dual-licensed:
 *  - Non-Commercial Source-Available v2  →  see LICENSE-NONCOMMERCIAL.md
 *  - Commercial License v2               →  see LICENSE-COMMERCIAL.md
 *
 * Contact: lingua-quiz@nikolay-eremeev.com
 * Repository: https://github.com/nikolay-e/lingua-quiz
 * File: packages/backend/src/db/wordSets.js
 */

import { DatabaseError, ValidationError } from '../utils/errors.js';
import { convertKeysToCamelCase } from '../utils/helpers.js';

import { pool } from './connection.js';

async function getWordSetById(wordSetId) {
  try {
    // Get word set details
    const wordSetResult = await pool.query('SELECT id, name, created_at, updated_at FROM word_list WHERE id = $1', [wordSetId]);
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

async function getUserWordSets(userId, wordListName) {
  try {
    const result = await pool.query('SELECT * FROM get_user_word_sets($1, $2)', [userId, wordListName]);
    return convertKeysToCamelCase(result.rows);
  } catch (error) {
    throw new DatabaseError(`Error getting word sets for user ${userId}`, error);
  }
}

async function getWordLists() {
  try {
    const result = await pool.query('SELECT * FROM get_word_lists()');
    return convertKeysToCamelCase(result.rows);
  } catch (error) {
    throw new DatabaseError('Error retrieving word lists', error);
  }
}

async function updateUserWordSetStatus(userId, wordPairIds, status) {
  try {
    if (wordPairIds.length === 0) {
      return { rowCount: 0 };
    }

    // Pass the JavaScript array directly, PostgreSQL will handle the conversion
    const result = await pool.query('SELECT update_user_word_set_status($1, $2, $3::translation_status)', [userId, wordPairIds, status]);

    return result;
  } catch (error) {
    if (error.message && error.message.includes('Invalid status transition')) {
      throw new ValidationError('Invalid status transition', error.message);
    }
    throw new DatabaseError(`Error updating word set status for user ${userId}`, error);
  }
}

export { getUserWordSets, getWordLists, getWordSetById, updateUserWordSetStatus };
