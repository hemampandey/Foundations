import { describe, it, expect } from 'vitest';
import { getTargetDifficulty, sortByAdaptiveDifficulty } from '@/lib/adaptive';
import type { Question } from '@/lib/types';

const attempts = (correct: number, total: number) =>
  Array.from({ length: total }, (_, i) => ({ is_correct: i < correct }));

const q = (id: string, difficulty: number) => ({ id, difficulty }) as Question;

describe('getTargetDifficulty', () => {
  it('starts new learners on easy', () => {
    expect(getTargetDifficulty([])).toBe(1);
  });

  it('maps accuracy bands to difficulty', () => {
    expect(getTargetDifficulty(attempts(8, 10))).toBe(3);
    expect(getTargetDifficulty(attempts(7, 10))).toBe(2);
    expect(getTargetDifficulty(attempts(5, 10))).toBe(2);
    expect(getTargetDifficulty(attempts(4, 10))).toBe(1);
  });
});

describe('sortByAdaptiveDifficulty', () => {
  const pool = [q('e1', 1), q('m1', 2), q('h1', 3), q('e2', 1), q('h2', 3), q('m2', 2)];
  const difficulties = (list: Question[]) => list.map((x) => x.difficulty);

  it('puts the target band first, then nearest bands', () => {
    expect(difficulties(sortByAdaptiveDifficulty(pool, 1))).toEqual([1, 1, 2, 2, 3, 3]);
    expect(difficulties(sortByAdaptiveDifficulty(pool, 3))).toEqual([3, 3, 2, 2, 1, 1]);
    expect(difficulties(sortByAdaptiveDifficulty(pool, 2)).slice(0, 2)).toEqual([2, 2]);
  });

  it('keeps every question exactly once and does not mutate input', () => {
    const before = pool.map((x) => x.id);
    const sorted = sortByAdaptiveDifficulty(pool, 2);
    expect(sorted.map((x) => x.id).sort()).toEqual([...before].sort());
    expect(pool.map((x) => x.id)).toEqual(before);
  });
});
