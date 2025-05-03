// packages/frontend/src/js/constants.js

// Constants for word statuses
export const STATUS = {
  LEVEL_1: 'LEVEL_1', // Learning
  LEVEL_2: 'LEVEL_2', // Mastered one way
  LEVEL_3: 'LEVEL_3', // Mastered both ways
  LEVEL_0: 'LEVEL_0', // New/Upcoming
};

// Constants for quiz directions
export const DIRECTION = {
  NORMAL: true, // Source -> Target
  REVERSE: false, // Target -> Source
};

// --- Quiz Logic Constants ---
// Max words to actively cycle through in the 'Learning' (LEVEL_1) stage
export const MAX_FOCUS_WORDS = 20;
// How many recently asked words to avoid repeating immediately
export const MAX_LAST_ASKED_WORDS = 7;
// When selecting the next word, consider this many of the "most incorrect" words
export const TOP_WORDS_LIMIT = 10;
// Number of consecutive correct answers needed in a direction to master it
export const CORRECT_ANSWERS_TO_MASTER = 3;
// Number of consecutive mistakes before degrading a word's level
export const MAX_MISTAKES_BEFORE_DEGRADATION = 3;

// --- Utility Constants ---
export const MILLISECONDS_IN_SECOND = 1000;
