import { Queue } from 'bullmq';
import Redis from 'ioredis';
import { getEnv } from '@/core/env';
import type { BackgroundJobPayload } from './types';
import { sendTenantEmail } from '@/services/email';
import { sendWhatsAppCloudTemplate } from '@/services/whatsapp';
import { sendMetaCapiEvent } from '@/services/tracking/meta-capi';

export const MAIN_QUEUE_NAME = 'nabat-background-jobs';

const globalForQueue = globalThis as unknown as {
  __bullQueue?: Queue<BackgroundJobPayload>;
  __redisDisabled?: boolean;
};

export async function processJobPayload(payload: BackgroundJobPayload): Promise<void> {
  switch (payload.name) {
    case 'send-email':
      await sendTenantEmail(payload);
      return;
    case 'send-whatsapp-cloud':
      await sendWhatsAppCloudTemplate(payload);
      return;
    case 'send-meta-capi':
      await sendMetaCapiEvent(payload);
      return;
  }
}

async function getBullQueue(): Promise<Queue<BackgroundJobPayload> | null> {
  if (globalForQueue.__redisDisabled) return null;
  if (!globalForQueue.__bullQueue) {
    try {
      const connection = new Redis(getEnv().redisUrl, {
        maxRetriesPerRequest: null,
        connectTimeout: 1200,
        lazyConnect: true,
        retryStrategy: () => null,
      });
      connection.on('error', () => {
        globalForQueue.__redisDisabled = true;
      });
      await connection.connect();
      globalForQueue.__bullQueue = new Queue<BackgroundJobPayload>(MAIN_QUEUE_NAME, {
        connection,
        defaultJobOptions: {
          attempts: 3,
          backoff: { type: 'exponential', delay: 3000 },
          removeOnComplete: 500,
          removeOnFail: 1000,
        },
      });
    } catch {
      globalForQueue.__redisDisabled = true;
      return null;
    }
  }
  return globalForQueue.__bullQueue;
}

/**
 * Enqueues a tenant-scoped background job onto Redis/BullMQ.
 * In local development without Redis, executes asynchronously in-process without blocking the request.
 */
export async function enqueueJob(payload: BackgroundJobPayload): Promise<void> {
  const queue = await getBullQueue();
  if (queue) {
    await queue.add(payload.name, payload);
    return;
  }

  if (getEnv().nodeEnv === 'production') {
    console.warn('[jobs] Redis unavailable in production, running job inline fallback:', payload.name);
  }

  setImmediate(() => {
    void processJobPayload(payload).catch((err) => {
      console.error(`[jobs:inline-fallback] failed ${payload.name}:`, err);
    });
  });
}

