import { eq } from 'drizzle-orm';
import { getControlDb } from '@/db/pools';
import { tenantDomains, tenants } from '@/db/schema/control-plane';
import { getEnv } from '@/core/env';
import type { ResolvedTenant } from './types';
import type { TenantIsolationMode, TenantStatus } from '@/db/schema/types';

function mapTenantRow(row: typeof tenants.$inferSelect): ResolvedTenant {
  return {
    id: row.id,
    slug: row.slug,
    name: row.name,
    status: row.status as TenantStatus,
    isolationMode: row.isolationMode as TenantIsolationMode,
    encryptedDbUrl: row.encryptedDbUrl,
    migrationVersion: row.migrationVersion,
    planTier: row.planTier,
    isDefault: row.isDefault,
  };
}

export function normalizeHost(rawHost: string | null | undefined): string {
  if (!rawHost) return '';
  return rawHost.split(':')[0].trim().toLowerCase();
}

/**
 * Resolves a tenant strictly on the server via verified domain mapping,
 * falling back to the default single-store tenant only when SINGLE_STORE_MODE=true.
 */
export async function resolveTenantFromHost(rawHost: string | null | undefined): Promise<ResolvedTenant> {
  const controlDb = getControlDb();
  const host = normalizeHost(rawHost);

  if (host) {
    const domainRows = await controlDb
      .select({
        tenant: tenants,
        domain: tenantDomains,
      })
      .from(tenantDomains)
      .innerJoin(tenants, eq(tenantDomains.tenantId, tenants.id))
      .where(eq(tenantDomains.domain, host))
      .limit(1);

    if (domainRows.length > 0) {
      const matched = mapTenantRow(domainRows[0].tenant);
      if (matched.status === 'SUSPENDED') {
        throw new Error(`Tenant ${matched.slug} is currently suspended.`);
      }
      return matched;
    }
  }

  const env = getEnv();
  if (env.singleStoreMode) {
    const defaultRows = await controlDb
      .select()
      .from(tenants)
      .where(eq(tenants.isDefault, true))
      .limit(1);

    if (defaultRows.length > 0) {
      return mapTenantRow(defaultRows[0]);
    }

    const bySlug = await controlDb
      .select()
      .from(tenants)
      .where(eq(tenants.slug, env.defaultTenantSlug))
      .limit(1);

    if (bySlug.length > 0) {
      return mapTenantRow(bySlug[0]);
    }
  }

  throw new Error(`Unable to resolve tenant for host: ${host || '(empty)'}`);
}

/**
 * Resolves a tenant by immutable UUID (used by authenticated sessions,
 * webhook endpoints, and background jobs).
 */
export async function resolveTenantById(tenantId: string): Promise<ResolvedTenant> {
  const controlDb = getControlDb();
  const rows = await controlDb
    .select()
    .from(tenants)
    .where(eq(tenants.id, tenantId))
    .limit(1);

  if (rows.length === 0) {
    throw new Error(`Tenant not found: ${tenantId}`);
  }
  const tenant = mapTenantRow(rows[0]);
  if (tenant.status === 'SUSPENDED') {
    throw new Error(`Tenant ${tenant.slug} is suspended.`);
  }
  return tenant;
}

export async function resolveTenantBySlug(slug: string): Promise<ResolvedTenant> {
  const controlDb = getControlDb();
  const rows = await controlDb
    .select()
    .from(tenants)
    .where(eq(tenants.slug, slug))
    .limit(1);

  if (rows.length === 0) {
    throw new Error(`Tenant slug not found: ${slug}`);
  }
  return mapTenantRow(rows[0]);
}

