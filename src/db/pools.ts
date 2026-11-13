import { Pool } from 'pg';
import { drizzle, type NodePgDatabase } from 'drizzle-orm/node-postgres';
import * as controlSchema from '@/db/schema/control-plane';
import * as tenantSchema from '@/db/schema/tenant';
import { getEnv } from '@/core/env';

export type ControlDb = NodePgDatabase<typeof controlSchema>;
export type TenantDb = NodePgDatabase<typeof tenantSchema>;

const globalForDb = globalThis as unknown as {
  __controlPool?: Pool;
  __sharedPool?: Pool;
  __adminPool?: Pool;
};

export function getControlPool(): Pool {
  if (!globalForDb.__controlPool) {
    globalForDb.__controlPool = new Pool({
      connectionString: getEnv().controlDatabaseUrl,
      max: 10,
      idleTimeoutMillis: 30_000,
      connectionTimeoutMillis: 5_000,
    });
  }
  return globalForDb.__controlPool;
}

export function getControlDb(): ControlDb {
  return drizzle(getControlPool(), { schema: controlSchema });
}

export function getSharedPool(): Pool {
  if (!globalForDb.__sharedPool) {
    globalForDb.__sharedPool = new Pool({
      connectionString: getEnv().databaseUrl,
      max: 20,
      idleTimeoutMillis: 30_000,
      connectionTimeoutMillis: 5_000,
    });
  }
  return globalForDb.__sharedPool;
}

export function getAdminPool(): Pool {
  if (!globalForDb.__adminPool) {
    globalForDb.__adminPool = new Pool({
      connectionString: getEnv().databaseAdminUrl,
      max: 5,
      idleTimeoutMillis: 30_000,
      connectionTimeoutMillis: 10_000,
    });
  }
  return globalForDb.__adminPool;
}

