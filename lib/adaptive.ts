/**
 * Adaptive Difficulty Selection
 *
 * Determines the target difficulty level for a learner based on their
 * recent performance in a theory domain. Uses running-accuracy bands:
 *
 *   ≥ 80% accuracy → prefer difficulty 3 (hard)
 *   50–79%         → prefer difficulty 2 (medium)
 *   < 50%          → prefer difficulty 1 (easy)
 *
 * Questions are then sorted to prioritize the target band, with
 * fallback to adjacent difficulties if the pool is sparse.
 */

import type { Question } from '@/lib/types';

export type DifficultyLevel = 1 | 2 | 3;

/**
 * Compute the target difficulty based on recent accuracy.
 *
 * @param recentAttempts Array of { isCorrect: boolean } for the last N attempts
 * @returns Target difficulty level (1, 2, or 3)
 */
export function getTargetDifficulty(
  recentAttempts: { is_correct: boolean }[]
): DifficultyLevel {
  if (recentAttempts.length === 0) return 1; // New learner → start easy

  const correct = recentAttempts.filter((a) => a.is_correct).length;
  const accuracy = (correct / recentAttempts.length) * 100;

  if (accuracy >= 80) return 3;
  if (accuracy >= 50) return 2;
  return 1;
}

/**
 * Sort questions to prioritize the target difficulty band.
 *
 * Order: target difficulty first, then adjacent levels, then remaining.
 * Within each band, questions are shuffled randomly.
 *
 * @param questions  Full pool of questions
 * @param target     Target difficulty from getTargetDifficulty()
 * @returns          Re-ordered question array
 */
export function sortByAdaptiveDifficulty(
  questions: Question[],
  target: DifficultyLevel
): Question[] {
  // Shuffle helper
  const shuffle = <T>(arr: T[]): T[] => {
    const shuffled = [...arr];
    for (let i = shuffled.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
    }
    return shuffled;
  };

  // Group by difficulty
  const targetPool = shuffle(questions.filter((q) => q.difficulty === target));

  // Adjacent difficulties (closer first)
  const adjacentLevels: DifficultyLevel[] =
    target === 1 ? [2, 3] :
    target === 3 ? [2, 1] :
    [1, 3]; // target === 2

  const adjacentPool = adjacentLevels.flatMap((level) =>
    shuffle(questions.filter((q) => q.difficulty === level))
  );

  return [...targetPool, ...adjacentPool];
}
