import { describe, it, expect } from 'vitest';
import { xpToLevel, getPageNumbers } from '@/lib/utils';

describe('xpToLevel', () => {
  it('requires level × 100 XP to advance each level', () => {
    expect(xpToLevel(0)).toEqual({ level: 1, currentXp: 0, requiredXp: 100 });
    expect(xpToLevel(99).level).toBe(1);
    expect(xpToLevel(100)).toEqual({ level: 2, currentXp: 0, requiredXp: 200 });
    expect(xpToLevel(299)).toEqual({ level: 2, currentXp: 199, requiredXp: 200 });
    expect(xpToLevel(300).level).toBe(3);
  });
});

describe('getPageNumbers', () => {
  it('lists every page when there are five or fewer', () => {
    expect(getPageNumbers(1, 1)).toEqual([1]);
    expect(getPageNumbers(3, 5)).toEqual([1, 2, 3, 4, 5]);
  });

  it('collapses distant pages into ellipses', () => {
    expect(getPageNumbers(1, 10)).toEqual([1, 2, '...', 10]);
    expect(getPageNumbers(5, 10)).toEqual([1, '...', 4, 5, 6, '...', 10]);
    expect(getPageNumbers(10, 10)).toEqual([1, '...', 9, 10]);
  });
});
