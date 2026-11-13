import '@/core/load-env';
import { Worker } from 'bullmq';
import Redis from 'ioredis';
import { getEnv } from '@/core/env';
import { MAIN_QUEUE_NAME, processJobPayload } from '@/core/jobs/queue';
import type { BackgroundJobPayload } from '@/core/jobs/types';

async function startWorker() {
  const env = getEnv();
  console.log(`[worker] Starting BullMQ worker connecting to ${env.redisUrl}...`);

  const connection = new Redis(env.redisUrl, {
    maxRetriesPerRequest: null,
  });

  const worker = new Worker<BackgroundJobPayload>(
    MAIN_QUEUE_NAME,
    async (job) => {
      console.log(`[worker] Processing ${job.name} (${job.id}) for tenant=${job.data.tenantId}`);
      await processJobPayload(job.data);
    },
    {
      connection,
      concurrency: 5,
    }
  );

  worker.on('completed', (job) => {
    console.log(`[worker] Completed job ${job.id} (${job.name})`);
  });

  worker.on('failed', (job, err) => {
    console.error(`[worker] Job ${job?.id} (${job?.name}) failed:`, err.message);
  });

  const shutdown = async () => {
    console.log('[worker] Shutting down gracefully...');
    await worker.close();
    await connection.quit();
    process.exit(0);
  };

  process.on('SIGINT', shutdown);
  process.on('SIGTERM', shutdown);
}

startWorker().catch((err) => {
  console.error('[worker] Fatal startup error:', err);
  process.exit(1);
});

