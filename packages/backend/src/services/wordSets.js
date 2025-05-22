/*
 * LinguaQuiz - Copyright © 2025 Nikolay Eremeev
 *
 * Dual-licensed:
 *  - Non-Commercial Source-Available v2  →  see LICENSE-NONCOMMERCIAL.md
 *  - Commercial License v2               →  see LICENSE-COMMERCIAL.md
 *
 * Contact: lingua-quiz@nikolay-eremeev.com
 * Repository: https://github.com/nikolay-e/lingua-quiz
 * File: packages/backend/src/services/wordSets.js
 */

import {
  getUserWordSets as dbGetUserWordSets,
  getWordLists as dbGetWordLists,
  getWordSetById as dbGetWordSetById,
  updateUserWordSetStatus as dbUpdateUserWordSetStatus,
} from '../db/index.js';

async function fetchWordSetById(wordSetId) {
  return dbGetWordSetById(wordSetId);
}

async function fetchUserWordSets(userId, wordListName) {
  return dbGetUserWordSets(userId, wordListName);
}

async function fetchWordLists() {
  return dbGetWordLists();
}

async function updateWordSetStatusForUser(userId, wordPairIds, status) {
  if (wordPairIds.length === 0) {
    return {
      message: 'Word sets status update request received (no changes applied for empty list).',
    };
  }

  await dbUpdateUserWordSetStatus(userId, wordPairIds, status);

  return { message: 'Word sets status updated successfully' };
}

export { fetchUserWordSets, fetchWordLists, fetchWordSetById, updateWordSetStatusForUser };
