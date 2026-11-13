import { getEnv } from '@/core/env';
import { LocalStorageProvider } from './local-storage';
import type { StorageProvider } from './types';

export * from './types';

let cachedProvider: StorageProvider | null = null;

/**
 * Factory returning the active storage provider.
 * Local storage is used initially; S3-compatible providers plug into the exact
 * same StorageProvider interface when STORAGE_PROVIDER=s3 is enabled.
 */
export function getStorageProvider(): StorageProvider {
  if (!cachedProvider) {
    const env = getEnv();
    if (env.storageProvider === 's3') {
      // S3 provider extension hook ready for AWS SDK / R2 / MinIO
      throw new Error(
        'STORAGE_PROVIDER=s3 configured but S3 client adapter credentials/SDK must be enabled in deployment.'
      );
    }
    cachedProvider = new LocalStorageProvider();
  }
  return cachedProvider;
}

