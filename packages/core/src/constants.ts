/**
 * Core algorithm parameters as defined in docs/spaced-repetition-algorithm.md
 */

/**
 * F - Focus Loop Size
 * The queue position for an incorrect answer. Defines the number of difficult words actively circulating.
 */
export const F = 5;

/**
 * K - Promotion Coefficient
 * The multiplier for F that determines the base spacing for a correct answer.
 */
export const K = 2;

/**
 * T_promo - Promotion Threshold
 * The number of consecutive correct answers required to advance to the next level.
 */
export const T_PROMO = 3;

/**
 * MistakeThreshold - Degradation Threshold
 * The number of mistakes within the MistakeWindow that triggers a level degradation.
 */
export const MISTAKE_THRESHOLD = 3;

/**
 * MistakeWindow - Degradation Window
 * The number of recent attempts to consider when checking for the MistakeThreshold.
 */
export const MISTAKE_WINDOW = 10;

/**
 * Calculated maximum focus pool size based on the formula: K × F × T_promo
 */
export const MAX_FOCUS_POOL_SIZE = K * F * T_PROMO;

/**
 * Recently asked buffer size (currently unused but kept for compatibility)
 */
export const RECENTLY_ASKED_SIZE = 5;

/**
 * Minimum history size required before checking for degradation
 * This ensures we have enough data points before making degradation decisions
 */
export const MIN_HISTORY_FOR_DEGRADATION = 3;
