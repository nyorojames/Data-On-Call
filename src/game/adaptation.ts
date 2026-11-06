/**
 * Adaptation thresholds for Data On-Call v2 runtime behavior.
 * Pre-registered and specified in spec.md §10.4 and §10.5 (AC9).
 */

/**
 * When predicted risk p >= PROACTIVE_CUTOFF (0.50), the tutor proactively surfaces
 * a guiding question before the player makes a decision.
 * Referenced in spec.md §10.4 and AC9.
 */
export const PROACTIVE_CUTOFF = 0.5;

/**
 * When predicted risk p >= TIMER_RELIEF_CUTOFF (0.75) and the player is in Experienced mode,
 * the 60-second countdown timer is paused to allow reflection under elevated risk.
 * Referenced in spec.md §10.4 and AC9.
 */
export const TIMER_RELIEF_CUTOFF = 0.75;
