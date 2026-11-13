import crypto from 'node:crypto';

/**
 * Centralized environment accessor with safe local development defaults.
 * Production deployments must set explicit strong secrets via environment variables.
 */
export interface AppEnv {
  nodeEnv: 'development' | 'production' | 'test';
  appUrl: string;
  singleStoreMode: boolean;
  defaultTenantSlug: string;
  databaseUrl: string;
  databaseAdminUrl: string;
  controlDatabaseUrl: string;
  sessionSecret: string;
  tenantEncryptionKey: string;
  redisUrl: string;
  storageProvider: 'local' | 's3';
  storageLocalRoot: string;
}

const DEV_FALLBACK_SESSION_SECRET = crypto
  .createHash('sha256')
  .update('nabat-atlas-dev-session-secret-change-in-prod')
  .digest('hex');

const DEV_FALLBACK_TENANT_KEY = crypto
  .createHash('sha256')
  .update('nabat-atlas-dev-tenant-encryption-key-change-in-prod')
  .digest('hex');

export function getEnv(): AppEnv {
  const nodeEnv =
    (process.env.NODE_ENV as AppEnv['nodeEnv']) || 'development';
  const isProd = nodeEnv === 'production';

  const databaseUrl =
    process.env.DATABASE_URL ||
    'postgresql://postgres:postgres@localhost:5432/nabat_atlas';
  const databaseAdminUrl = process.env.DATABASE_ADMIN_URL || databaseUrl;
  const controlDatabaseUrl = process.env.CONTROL_DATABASE_URL || databaseAdminUrl;

  const sessionSecret = process.env.SESSION_SECRET || (isProd ? '' : DEV_FALLBACK_SESSION_SECRET);
  const tenantEncryptionKey =
    process.env.TENANT_ENCRYPTION_KEY || (isProd ? '' : DEV_FALLBACK_TENANT_KEY);

  if (isProd && (!sessionSecret || sessionSecret.length < 32)) {
    throw new Error('SESSION_SECRET must be set (>= 32 chars) in production.');
  }
  if (isProd && (!tenantEncryptionKey || tenantEncryptionKey.length < 32)) {
    throw new Error('TENANT_ENCRYPTION_KEY must be set (>= 32 chars) in production.');
  }

  return {
    nodeEnv,
    appUrl: process.env.APP_URL || 'http://localhost:3000',
    singleStoreMode: process.env.SINGLE_STORE_MODE !== 'false',
    defaultTenantSlug: process.env.DEFAULT_TENANT_SLUG || 'nabat-al-atlas',
    databaseUrl,
    databaseAdminUrl,
    controlDatabaseUrl,
    sessionSecret,
    tenantEncryptionKey,
    redisUrl: process.env.REDIS_URL || 'redis://localhost:6379',
    storageProvider: process.env.STORAGE_PROVIDER === 's3' ? 's3' : 'local',
    storageLocalRoot: process.env.STORAGE_LOCAL_ROOT || './storage',
  };
}

