/**
 * SM-2 Spaced Repetition Algorithm
 * Given a user's current review state and a quality grade (0–5),
 * computes the next review interval, ease factor, and due date.
 */

export interface SM2State {
  easeFactor: number;   // Current ease factor (≥ 1.3)
  intervalDays: number; // Current interval in days
  repetitions: number;  // Number of consecutive correct reviews
}

export interface SM2Result extends SM2State {
  dueAt: Date;          // Next review date
}

/**
 * Map a practice attempt to an SM-2 quality grade (0–5).
 *
 * - Correct + fast (≤5s)   → 5 (perfect response)
 * - Correct + normal       → 4 (correct with hesitation)
 * - Correct + slow (≥15s)  → 3 (correct with serious difficulty)
 * - Incorrect              → 1 (complete blackout)
 */
export function gradeFromAttempt(isCorrect: boolean, responseMs: number): number {
  if (!isCorrect) return 1;

  const seconds = responseMs / 1000;
  if (seconds <= 5) return 5;
  if (seconds >= 15) return 3;
  return 4;
}

/**
 * @param state   Current review state (or defaults for new items)
 * @param quality Quality grade 0–5
 * @returns       Updated state with new due date
 */
export function sm2(state: SM2State, quality: number): SM2Result {
  const q = Math.max(0, Math.min(5, Math.round(quality)));

  let { easeFactor, intervalDays, repetitions } = state;

  if (q >= 3) {
    // Correct response — extend interval
    repetitions += 1;

    if (repetitions === 1) {
      intervalDays = 1;
    } else if (repetitions === 2) {
      intervalDays = 6;
    } else {
      intervalDays = Math.round(intervalDays * easeFactor);
    }
  } else {
    // Incorrect — reset to beginning
    repetitions = 0;
    intervalDays = 1;
  }

  // Update ease factor (never below 1.3)
  easeFactor = easeFactor + (0.1 - (5 - q) * (0.08 + (5 - q) * 0.02));
  easeFactor = Math.max(1.3, easeFactor);

  // Compute next due date
  const dueAt = new Date();
  dueAt.setDate(dueAt.getDate() + intervalDays);

  return { easeFactor, intervalDays, repetitions, dueAt };
}

/**
 * Default SM-2 state for a question being scheduled for the first time.
 */
export const DEFAULT_SM2_STATE: SM2State = {
  easeFactor: 2.5,
  intervalDays: 1,
  repetitions: 0,
};
