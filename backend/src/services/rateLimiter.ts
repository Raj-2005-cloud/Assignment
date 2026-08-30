import { getRedisConnection } from '../config/redis';
import { config } from '../config';

export interface RateLimitResult {
  allowed: boolean;
  currentCount: number;
  limit: number;
  resetAt: Date;
  retryAfterMs: number;
}

/**
 * Redis-backed rate limiter using atomic INCR + EXPIRE.
 * Safe across multiple workers / instances.
 *
 * Strategy:
 * - Key: ratelimit:{scope}:{hourWindow}
 * - hourWindow = Math.floor(Date.now() / 3600000)
 * - INCR the key atomically; if first call, set EXPIRE to 3600s
 * - If count > limit, calculate delay to next window
 */
export async function checkRateLimit(
  senderId: string
): Promise<RateLimitResult> {
  const redis = getRedisConnection();
  const now = Date.now();
  const hourWindow = Math.floor(now / 3600000);

  // Check per-sender limit
  const senderKey = `ratelimit:sender:${senderId}:${hourWindow}`;
  const senderResult = await checkKey(
    redis,
    senderKey,
    config.MAX_EMAILS_PER_HOUR_PER_SENDER,
    hourWindow
  );

  if (!senderResult.allowed) {
    return senderResult;
  }

  // Check global limit
  const globalKey = `ratelimit:global:${hourWindow}`;
  const globalResult = await checkKey(
    redis,
    globalKey,
    config.MAX_EMAILS_PER_HOUR,
    hourWindow
  );

  if (!globalResult.allowed) {
    // Rollback sender counter since global limit was hit
    await redis.decr(senderKey);
    return globalResult;
  }

  return senderResult;
}

async function checkKey(
  redis: ReturnType<typeof getRedisConnection>,
  key: string,
  limit: number,
  hourWindow: number
): Promise<RateLimitResult> {
  const now = Date.now();

  // Atomic increment
  const count = await redis.incr(key);

  // Set expiry only on first increment
  if (count === 1) {
    await redis.expire(key, 3600);
  }

  const nextWindowStart = (hourWindow + 1) * 3600000;
  const retryAfterMs = nextWindowStart - now;

  if (count > limit) {
    // Over limit — decrement back since we won't send
    await redis.decr(key);

    return {
      allowed: false,
      currentCount: count - 1,
      limit,
      resetAt: new Date(nextWindowStart),
      retryAfterMs,
    };
  }

  return {
    allowed: true,
    currentCount: count,
    limit,
    resetAt: new Date(nextWindowStart),
    retryAfterMs,
  };
}

/**
 * Get current rate limit status without incrementing.
 */
export async function getRateLimitStatus(
  senderId: string
): Promise<{ senderCount: number; globalCount: number }> {
  const redis = getRedisConnection();
  const hourWindow = Math.floor(Date.now() / 3600000);

  const senderKey = `ratelimit:sender:${senderId}:${hourWindow}`;
  const globalKey = `ratelimit:global:${hourWindow}`;

  const [senderCount, globalCount] = await Promise.all([
    redis.get(senderKey),
    redis.get(globalKey),
  ]);

  return {
    senderCount: parseInt(senderCount || '0', 10),
    globalCount: parseInt(globalCount || '0', 10),
  };
}
