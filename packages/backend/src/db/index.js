/*
 * LinguaQuiz - Copyright © 2025 Nikolay Eremeev
 *
 * Dual-licensed:
 *  - Non-Commercial Source-Available v2  →  see LICENSE-NONCOMMERCIAL.md
 *  - Commercial License v2               →  see LICENSE-COMMERCIAL.md
 *
 * Contact: lingua-quiz@nikolay-eremeev.com
 * Repository: https://github.com/nikolay-e/lingua-quiz
 * File: packages/backend/src/db/index.js
 */

import * as userDb from './user.js';
import * as wordSetsDb from './wordSets.js';

// Re-export everything

export const { createUser } = userDb;
export const { deleteUser } = userDb;
export const { getUserByEmail } = userDb;
export const { userExists } = userDb;
export const { validatePassword } = userDb;

export const { getUserWordSets } = wordSetsDb;
export const { getWordLists } = wordSetsDb;
export const { getWordSetById } = wordSetsDb;
export const { updateUserWordSetStatus } = wordSetsDb;
export { checkConnection, closePool, initPool, pool } from './connection.js';
