import { NextResponse } from 'next/server';
import Redis from 'ioredis';
import { getControlPool } from '@/db/pools';
import { getEnv } from '@/core/env';

export async function GET() {
  const checks: Record<string, string> = {
    status: 'ok',
    postgres: 'unknown',
    redis: 'unknown',
    timestamp: new Date().toISOString(),
  };

  try {
    await getControlPool().query('SELECT 1');
    checks.postgres = 'healthy';
  } catch {
    checks.postgres = 'unhealthy';
    checks.status = 'degraded';
  }

  try {
    const redis = new Redis(getEnv().redisUrl, {
      connectTimeout: 800,
      maxRetriesPerRequest: 1,
      lazyConnect: true,
      retryStrategy: () => null,
    });
    redis.on('error', () => undefined);
    await redis.connect();
    await redis.ping();
    await redis.quit();
    checks.redis = 'healthy';
  } catch {
    checks.redis = getEnv().nodeEnv === 'production' ? 'unhealthy' : 'optional-dev-off';
  }

  return NextResponse.json(checks, {
    status: checks.postgres === 'healthy' ? 200 : 503,
  });
}

