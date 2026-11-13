import Redis from 'ioredis';
import { getEnv } from '@/core/env';

const memoryBuckets = new Map<string, { count: number; resetAt: number }>();

let redisClient: Redis | null = null;
let redisUnavailable = false;

function getRedisForRateLimit(): Redis | null {
  if (redisUnavailable) return null;
  if (!redisClient) {
    try {
      redisClient = new Redis(getEnv().redisUrl, {
        maxRetriesPerRequest: 1,
        enableOfflineQueue: false,
        lazyConnect: true,
        retryStrategy: () => null,
      });
      redisClient.on('error', () => {
        redisUnavailable = true;
      });
    } catch {
      redisUnavailable = true;
      return null;
    }
  }
  return redisClient;
}

export interface RateLimitResult {
  allowed: boolean;
  remaining: number;
  resetInSeconds: number;
}

/**
 * Rate limiter using Redis INCR/EXPIRE when Redis is connected,
 * with a bounded in-memory sliding fallback for Redis-free local dev.
 */
export async function checkRateLimit(params: {
  key: string;
  limit: number;
  windowSeconds: number;
}): Promise<RateLimitResult> {
  const { key, limit, windowSeconds } = params;
  const redis = getRedisForRateLimit();

  if (redis) {
    try {
      if (redis.status === 'wait') {
        await redis.connect();
      }
      const count = await redis.incr(`rl:${key}`);
      if (count === 1) {
        await redis.expire(`rl:${key}`, windowSeconds);
      }
      const ttl = await redis.ttl(`rl:${key}`);
      return {
        allowed: count <= limit,
        remaining: Math.max(0, limit - count),
        resetInSeconds: ttl > 0 ? ttl : windowSeconds,
      };
    } catch {
      redisUnavailable = true;
    }
  }

  // Fallback in-memory bucket
  const now = Date.now();
  const bucket = memoryBuckets.get(key);
  if (!bucket || bucket.resetAt <= now) {
    memoryBuckets.set(key, { count: 1, resetAt: now + windowSeconds * 1000 });
    return { allowed: true, remaining: limit - 1, resetInSeconds: windowSeconds };
  }

  bucket.count += 1;
  return {
    allowed: bucket.count <= limit,
    remaining: Math.max(0, limit - bucket.count),
    resetInSeconds: Math.max(1, Math.ceil((bucket.resetAt - now) / 1000)),
  };
}

