import { EventEmitter } from 'node:events';
import Redis from 'ioredis';
import { getEnv } from '@/core/env';

export interface RealtimeNotificationPayload {
  id: string;
  storeId: string;
  type: string;
  titleI18n: Record<string, string>;
  messageI18n: Record<string, string>;
  linkUrl?: string | null;
  createdAt: string;
}

const CHANNEL_PREFIX = 'nabat:notifications:';

const globalForPubSub = globalThis as unknown as {
  __localEmitter?: EventEmitter;
  __pubRedis?: Redis | null;
  __pubFailed?: boolean;
};

function getLocalEmitter(): EventEmitter {
  if (!globalForPubSub.__localEmitter) {
    globalForPubSub.__localEmitter = new EventEmitter();
    globalForPubSub.__localEmitter.setMaxListeners(100);
  }
  return globalForPubSub.__localEmitter;
}

async function getPublisherRedis(): Promise<Redis | null> {
  if (globalForPubSub.__pubFailed) return null;
  if (!globalForPubSub.__pubRedis) {
    try {
      const client = new Redis(getEnv().redisUrl, {
        connectTimeout: 1000,
        maxRetriesPerRequest: 1,
        lazyConnect: true,
        retryStrategy: () => null,
      });
      client.on('error', () => {
        globalForPubSub.__pubFailed = true;
      });
      await client.connect();
      globalForPubSub.__pubRedis = client;
    } catch {
      globalForPubSub.__pubFailed = true;
      globalForPubSub.__pubRedis = null;
      return null;
    }
  }
  return globalForPubSub.__pubRedis;
}

/**
 * Publishes a real-time notification event for a specific tenant across both
 * Redis Pub/Sub (multi-process / Docker worker -> web app) and local EventEmitter.
 */
export async function publishTenantNotification(
  payload: RealtimeNotificationPayload
): Promise<void> {
  getLocalEmitter().emit(`${CHANNEL_PREFIX}${payload.storeId}`, payload);

  const redis = await getPublisherRedis();
  if (redis) {
    await redis
      .publish(`${CHANNEL_PREFIX}${payload.storeId}`, JSON.stringify(payload))
      .catch(() => undefined);
  }
}

/**
 * Subscribes to a specific tenant's real-time notification stream for SSE routes.
 * Returns an unsubscribe cleanup callback.
 */
export async function subscribeTenantNotifications(
  storeId: string,
  onEvent: (payload: RealtimeNotificationPayload) => void
): Promise<() => Promise<void>> {
  const channel = `${CHANNEL_PREFIX}${storeId}`;
  const emitter = getLocalEmitter();
  const localListener = (payload: RealtimeNotificationPayload) => onEvent(payload);
  emitter.on(channel, localListener);

  let subRedis: Redis | null = null;
  if (!globalForPubSub.__pubFailed) {
    try {
      subRedis = new Redis(getEnv().redisUrl, {
        connectTimeout: 1000,
        maxRetriesPerRequest: 1,
        lazyConnect: true,
        retryStrategy: () => null,
      });
      subRedis.on('error', () => undefined);
      await subRedis.connect();
      await subRedis.subscribe(channel);
      subRedis.on('message', (_ch, msg) => {
        try {
          onEvent(JSON.parse(msg) as RealtimeNotificationPayload);
        } catch {
          // Ignore malformed event
        }
      });
    } catch {
      if (subRedis) {
        await subRedis.quit().catch(() => undefined);
        subRedis = null;
      }
    }
  }

  return async () => {
    emitter.off(channel, localListener);
    if (subRedis) {
      await subRedis.unsubscribe(channel).catch(() => undefined);
      await subRedis.quit().catch(() => undefined);
    }
  };
}

