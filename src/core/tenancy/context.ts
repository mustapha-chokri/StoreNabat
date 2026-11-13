import { headers } from 'next/headers';
import { drizzle } from 'drizzle-orm/node-postgres';
import type { Pool, PoolClient } from 'pg';
import * as tenantSchema from '@/db/schema/tenant';
import { getSharedPool, type TenantDb } from '@/db/pools';
import { getTenantPoolManager } from './tenant-pool-manager';
import { resolveTenantById, resolveTenantFromHost } from './resolver';
import type { ResolvedTenant } from './types';

function getPoolForTenant(tenant: ResolvedTenant): Pool {
  if (tenant.isolationMode === 'DEDICATED') {
    if (!tenant.encryptedDbUrl) {
      throw new Error(`Dedicated tenant ${tenant.slug} is missing encryptedDbUrl.`);
    }
    return getTenantPoolManager().getPool(tenant.id, tenant.encryptedDbUrl);
  }
  return getSharedPool();
}

/**
 * Executes database operations strictly inside the tenant's isolated context.
 * - SHARED mode: routes to shared PostgreSQL pool inside a transaction with
 *   `set_config('app.current_tenant_id', tenant.id, true)` enforcing RLS.
 * - DEDICATED mode: routes to the tenant's dedicated connection pool and also sets
 *   `app.current_tenant_id` so repositories remain 100% uniform.
 */
export async function withTenantDb<T>(
  tenant: ResolvedTenant,
  callback: (db: TenantDb, tenant: ResolvedTenant, client: PoolClient) => Promise<T>
): Promise<T> {
  if (tenant.status === 'MIGRATING') {
    throw new Error(`Tenant ${tenant.slug} is currently undergoing database maintenance.`);
  }

  const pool = getPoolForTenant(tenant);
  const client = await pool.connect();

  try {
    await client.query('BEGIN');
    await client.query("SELECT set_config('app.current_tenant_id', $1, true)", [tenant.id]);

    const txDb = drizzle(client, { schema: tenantSchema }) as TenantDb;
    const result = await callback(txDb, tenant, client);

    await client.query('COMMIT');
    return result;
  } catch (error) {
    try {
      await client.query('ROLLBACK');
    } catch {
      // Ignore rollback errors if connection already closed
    }
    throw error;
  } finally {
    client.release();
  }
}

/**
 * Convenience helper for Next.js Server Components and Route Handlers to resolve
 * the current tenant exclusively from the verified HTTP Host header.
 */
export async function getRequestTenant(): Promise<ResolvedTenant> {
  const hdrs = await headers();
  const host = hdrs.get('x-forwarded-host') || hdrs.get('host');
  return resolveTenantFromHost(host);
}

/**
 * Executes a callback inside the resolved request tenant's isolated DB transaction.
 */
export async function withRequestTenantDb<T>(
  callback: (db: TenantDb, tenant: ResolvedTenant) => Promise<T>
): Promise<T> {
  const tenant = await getRequestTenant();
  return withTenantDb(tenant, (db, resolved) => callback(db, resolved));
}

/**
 * Executes a callback inside a specific tenantId's isolated DB transaction
 * (for authenticated admin actions, webhooks, and BullMQ worker jobs).
 */
export async function withTenantIdDb<T>(
  tenantId: string,
  callback: (db: TenantDb, tenant: ResolvedTenant) => Promise<T>
): Promise<T> {
  const tenant = await resolveTenantById(tenantId);
  return withTenantDb(tenant, (db, resolved) => callback(db, resolved));
}

