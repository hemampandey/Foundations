import { describe, it, expect, vi } from 'vitest';
import {
  acquireGenerationSlot, rateLimitHeaders, requestFingerprint, type GuardDeps,
} from '@/lib/generation-guard';

/** In-memory stand-in for the two Redis commands the guard uses. */
function fakeRedis() {
  const store = new Map<string, unknown>();
  const redis = {
    store,
    set: vi.fn(async (key: string, value: unknown, opts?: { nx?: boolean }) => {
      if (opts?.nx && store.has(key)) return null;
      store.set(key, value);
      return 'OK';
    }),
    del: vi.fn(async (key: string) => (store.delete(key) ? 1 : 0)),
  };
  return redis as typeof redis & NonNullable<GuardDeps['redis']>;
}

function fakeLimiter(allowed: number) {
  let used = 0;
  return {
    limit: vi.fn(async () => {
      used++;
      return { success: used <= allowed, limit: allowed, remaining: Math.max(0, allowed - used), reset: Date.now() + 30 * 60_000 };
    }),
  };
}

const FP = requestFingerprint(['Theory', 'Body', 3, '']);

describe('acquireGenerationSlot', () => {
  it('allows everything when Redis is not configured', async () => {
    const slot = await acquireGenerationSlot('u1', FP, { redis: null, limiter: null });
    expect(slot.ok).toBe(true);
  });

  it('rejects an identical in-flight request with 409 until released', async () => {
    const deps = { redis: fakeRedis(), limiter: fakeLimiter(10) };
    const first = await acquireGenerationSlot('u1', FP, deps);
    expect(first.ok).toBe(true);

    const dup = await acquireGenerationSlot('u1', FP, deps);
    expect(dup).toMatchObject({ ok: false, status: 409 });

    if (first.ok) await first.release();
    expect((await acquireGenerationSlot('u1', FP, deps)).ok).toBe(true);
  });

  it('does not spend rate-limit quota on rejected duplicates', async () => {
    const deps = { redis: fakeRedis(), limiter: fakeLimiter(10) };
    await acquireGenerationSlot('u1', FP, deps);
    await acquireGenerationSlot('u1', FP, deps);
    expect(deps.limiter.limit).toHaveBeenCalledTimes(1);
  });

  it('locks per user and per request content', async () => {
    const deps = { redis: fakeRedis(), limiter: null };
    expect((await acquireGenerationSlot('u1', FP, deps)).ok).toBe(true);
    expect((await acquireGenerationSlot('u2', FP, deps)).ok).toBe(true);
    expect((await acquireGenerationSlot('u1', requestFingerprint(['Theory', 'Body', 4, '']), deps)).ok).toBe(true);
  });

  it('returns 429 with rate-limit info once the window is exhausted, releasing the lock', async () => {
    const deps = { redis: fakeRedis(), limiter: fakeLimiter(1) };
    const first = await acquireGenerationSlot('u1', FP, deps);
    if (first.ok) await first.release();

    const limited = await acquireGenerationSlot('u1', FP, deps);
    expect(limited).toMatchObject({ ok: false, status: 429, rateLimit: { limit: 1, remaining: 0 } });
    expect(!limited.ok && limited.error).toMatch(/Generation limit reached \(1 per hour\)/);
    expect(deps.redis.store.size).toBe(0);
  });

  it('fails open when Redis or the limiter errors', async () => {
    const brokenRedis = fakeRedis();
    brokenRedis.set.mockRejectedValueOnce(new Error('ECONNRESET'));
    const brokenLimiter = { limit: vi.fn().mockRejectedValue(new Error('timeout')) };
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});

    const slot = await acquireGenerationSlot('u1', FP, { redis: brokenRedis, limiter: brokenLimiter });
    expect(slot.ok).toBe(true);
    expect(warn).toHaveBeenCalledTimes(2);
    warn.mockRestore();
  });
});

describe('rateLimitHeaders', () => {
  const info = { limit: 10, remaining: 0, reset: Date.now() + 90_000 };

  it('emits standard headers, with Retry-After only when limited', () => {
    expect(rateLimitHeaders(info)).toEqual({
      'X-RateLimit-Limit': '10',
      'X-RateLimit-Remaining': '0',
      'X-RateLimit-Reset': String(Math.ceil(info.reset / 1000)),
    });
    expect(Number(rateLimitHeaders(info, true)['Retry-After'])).toBeGreaterThanOrEqual(89);
    expect(rateLimitHeaders(undefined)).toEqual({});
  });
});

describe('requestFingerprint', () => {
  it('is stable for equal input and differs otherwise', () => {
    expect(requestFingerprint(['a', 1])).toBe(requestFingerprint(['a', 1]));
    expect(requestFingerprint(['a', 1])).not.toBe(requestFingerprint(['a', 2]));
  });
});
