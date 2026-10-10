import { describe, it, expect, vi, afterEach } from 'vitest';
import { sm2, gradeFromAttempt, DEFAULT_SM2_STATE } from '@/lib/sm2';

describe('gradeFromAttempt', () => {
  it('grades incorrect answers as 1 regardless of speed', () => {
    expect(gradeFromAttempt(false, 1_000)).toBe(1);
    expect(gradeFromAttempt(false, 60_000)).toBe(1);
  });

  it('grades correct answers by response time', () => {
    expect(gradeFromAttempt(true, 5_000)).toBe(5);
    expect(gradeFromAttempt(true, 10_000)).toBe(4);
    expect(gradeFromAttempt(true, 15_000)).toBe(3);
  });
});

describe('sm2', () => {
  afterEach(() => vi.useRealTimers());

  it('follows the 1 → 6 → I×EF interval progression', () => {
    let state = sm2(DEFAULT_SM2_STATE, 5);
    expect(state.intervalDays).toBe(1);
    expect(state.repetitions).toBe(1);

    state = sm2(state, 5);
    expect(state.intervalDays).toBe(6);

    const ef = state.easeFactor;
    state = sm2(state, 5);
    expect(state.intervalDays).toBe(Math.round(6 * ef));
    expect(state.repetitions).toBe(3);
  });

  it('applies the SM-2 ease factor formula', () => {
    expect(sm2(DEFAULT_SM2_STATE, 5).easeFactor).toBeCloseTo(2.6);
    expect(sm2(DEFAULT_SM2_STATE, 4).easeFactor).toBeCloseTo(2.5);
    expect(sm2(DEFAULT_SM2_STATE, 3).easeFactor).toBeCloseTo(2.36);
  });

  it('resets repetitions and interval on a failed recall', () => {
    const learned = { easeFactor: 2.5, intervalDays: 30, repetitions: 5 };
    const result = sm2(learned, 1);
    expect(result.repetitions).toBe(0);
    expect(result.intervalDays).toBe(1);
    expect(result.easeFactor).toBeLessThan(2.5);
  });

  it('never lets the ease factor drop below 1.3', () => {
    let state = { ...DEFAULT_SM2_STATE };
    for (let i = 0; i < 20; i++) state = sm2(state, 0);
    expect(state.easeFactor).toBe(1.3);
  });

  it('clamps out-of-range quality grades', () => {
    expect(sm2(DEFAULT_SM2_STATE, 9)).toMatchObject(sm2(DEFAULT_SM2_STATE, 5));
    expect(sm2(DEFAULT_SM2_STATE, -3).easeFactor).toBe(sm2(DEFAULT_SM2_STATE, 0).easeFactor);
  });

  it('sets the due date intervalDays from now', () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-01-01T09:00:00'));
    const result = sm2({ easeFactor: 2.5, intervalDays: 6, repetitions: 2 }, 4);
    expect(result.intervalDays).toBe(15);
    expect(result.dueAt.toDateString()).toBe(new Date('2026-01-16T09:00:00').toDateString());
  });
});
