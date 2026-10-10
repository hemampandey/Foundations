/**
 * Generation Guard: Redis-backed cost controls for the MCQ generation route.
 *
 * Every generation is a paid LLM call, so before calling the provider we:
 *   1. Take a short-lived lock per (user, identical request) with SET NX EX,
 *      so double-clicks and client retries cannot pay for the same work twice.
 *   2. Apply a per-user sliding-window rate limit.
 *
 * Uses Upstash Redis (HTTP-based, so it works from serverless functions).
 * If Redis is not configured or is unreachable, the guard fails open: the
 * route stays available and the problem is logged, since the route already
 * requires an authenticated admin.
 */

import { createHash } from 'node:crypto';
import { Redis } from '@upstash/redis';
import { Ratelimit } from '@upstash/ratelimit';

const KEY_PREFIX = 'foundations:generate';
const LOCK_TTL_SECONDS = 120; // comfortably longer than a slow LLM call
const DEFAULT_LIMIT_PER_HOUR = 10;

export interface RateLimitInfo {
  limit: number;
  remaining: number;
  reset: number; // unix ms
}

export interface GuardDeps {
  redis: Pick<Redis, 'set' | 'del'> | null;
  limiter: { limit(identifier: string): Promise<RateLimitInfo & { success: boolean }> } | null;
}

export type GuardResult =
  | { ok: true; rateLimit?: RateLimitInfo; release: () => Promise<void> }
  | { ok: false; status: 409 | 429; error: string; rateLimit?: RateLimitInfo };

export function requestFingerprint(parts: unknown[]): string {
  return createHash('sha256').update(JSON.stringify(parts)).digest('hex').slice(0, 32);
}

function createDefaultDeps(): GuardDeps {
  const url = process.env.UPSTASH_REDIS_REST_URL;
  const token = process.env.UPSTASH_REDIS_REST_TOKEN;
  if (!url || !token) return { redis: null, limiter: null };

  const redis = new Redis({ url, token });
  const perHour = Number(process.env.GENERATION_RATE_LIMIT_PER_HOUR) || DEFAULT_LIMIT_PER_HOUR;
  const limiter = new Ratelimit({
    redis,
    limiter: Ratelimit.slidingWindow(perHour, '1 h'),
    prefix: `${KEY_PREFIX}:ratelimit`,
    timeout: 1000,
  });
  return { redis, limiter };
}

let defaultDeps: GuardDeps | undefined;

export async function acquireGenerationSlot(
  userId: string,
  fingerprint: string,
  deps: GuardDeps = (defaultDeps ??= createDefaultDeps())
): Promise<GuardResult> {
  const { redis, limiter } = deps;
  const lockKey = `${KEY_PREFIX}:inflight:${userId}:${fingerprint}`;
  let locked = false;

  const release = async () => {
    if (!locked || !redis) return;
    try {
      await redis.del(lockKey);
    } catch (err) {
      console.warn('[Generation Guard] Failed to release lock (it will expire):', err);
    }
  };

  // 1. Duplicate-request lock (checked first so duplicates don't burn rate-limit quota)
  if (redis) {
    try {
      locked = (await redis.set(lockKey, Date.now(), { nx: true, ex: LOCK_TTL_SECONDS })) === 'OK';
      if (!locked) {
        return {
          ok: false,
          status: 409,
          error: 'An identical generation is already in progress. Please wait for it to finish.',
        };
      }
    } catch (err) {
      console.warn('[Generation Guard] Redis lock unavailable, continuing without it:', err);
    }
  }

  // 2. Per-user sliding-window rate limit
  if (limiter) {
    try {
      const { success, limit, remaining, reset } = await limiter.limit(userId);
      const rateLimit = { limit, remaining, reset };
      if (!success) {
        await release();
        const minutes = Math.max(1, Math.ceil((reset - Date.now()) / 60_000));
        return {
          ok: false,
          status: 429,
          error: `Generation limit reached (${limit} per hour). Try again in ${minutes} minute${minutes === 1 ? '' : 's'}.`,
          rateLimit,
        };
      }
      return { ok: true, rateLimit, release };
    } catch (err) {
      console.warn('[Generation Guard] Rate limiter unavailable, continuing without it:', err);
    }
  }

  return { ok: true, release };
}

export function rateLimitHeaders(info?: RateLimitInfo, limited = false): Record<string, string> {
  if (!info) return {};
  const headers: Record<string, string> = {
    'X-RateLimit-Limit': String(info.limit),
    'X-RateLimit-Remaining': String(Math.max(0, info.remaining)),
    'X-RateLimit-Reset': String(Math.ceil(info.reset / 1000)),
  };
  if (limited) {
    headers['Retry-After'] = String(Math.max(1, Math.ceil((info.reset - Date.now()) / 1000)));
  }
  return headers;
}
