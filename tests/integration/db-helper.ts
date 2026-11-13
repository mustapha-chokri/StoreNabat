import '@/core/load-env';
import { Pool } from 'pg';
import { eq } from 'drizzle-orm';
import { getEnv } from '@/core/env';
import { getAdminPool, getControlDb } from '@/db/pools';
import { TENANT_TABLES_ORDERED } from '@/db/rls';
import { tenants, tenantDomains } from '@/db/schema/control-plane';
import type { ResolvedTenant } from '@/core/tenancy/types';
import type { I18nMap } from '@/db/schema/types';

export function buildTestStoreSettings(
  storeId: string,
  storeNameI18n: I18nMap,
  deductOnStatus: 'ON_CONFIRMED' | 'ON_ORDER_CREATED' = 'ON_CONFIRMED'
) {
  return {
    storeId,
    storeNameI18n,
    checkoutConfig: {
      cartEnabled: true,
      quickOrderEnabled: true,
      defaultExperience: 'BOTH' as const,
      phoneValidationMode: 'MOROCCO_SMART' as const,
      requireEmail: false,
      requireAddress: true,
      requireCity: true,
      requireNotes: false,
      customFields: [],
      buttonTextI18n: { ar: 'تأكيد', fr: 'Confirmer', en: 'Confirm' },
      confirmationMessageI18n: { ar: 'شكراً', fr: 'Merci', en: 'Thanks' },
    },
    inventoryConfig: {
      deductOnStatus,
      restoreOnCancel: true,
      allowBackordersDefault: false,
      lowStockThresholdDefault: 5,
    },
    announcementBar: {
      enabled: false,
      textI18n: { ar: '', fr: '', en: '' },
      bgColor: '#14532D',
      textColor: '#FAF9F6',
    },
  };
}

/**
 * Checks whether a live migrated PostgreSQL instance is configured and reachable.
 * Integration tests skip cleanly with an informative message when DB credentials
 * are not yet configured locally.
 */
export async function canRunPostgresIntegrationTests(): Promise<{
  ready: boolean;
  reason?: string;
}> {
  if (!process.env.DATABASE_ADMIN_URL && !process.env.DATABASE_URL) {
    return {
      ready: false,
      reason: 'DATABASE_ADMIN_URL / DATABASE_URL not set in environment or .env',
    };
  }

  const probePool = new Pool({
    connectionString: getEnv().databaseAdminUrl,
    max: 1,
    connectionTimeoutMillis: 1500,
  });

  try {
    await probePool.query('SELECT 1');
    const regRes = await probePool.query<{ tbl: string | null }>(
      `SELECT to_regclass('control_plane.tenants') AS tbl`
    );
    if (!regRes.rows[0]?.tbl) {
      return {
        ready: false,
        reason: 'control_plane.tenants does not exist yet (run npm run db:migrate)',
      };
    }
    return { ready: true };
  } catch (err) {
    return {
      ready: false,
      reason: err instanceof Error ? err.message : 'Unable to reach PostgreSQL',
    };
  } finally {
    await probePool.end().catch(() => undefined);
  }
}

export async function createEphemeralTenant(params: {
  slug: string;
  name: string;
  domain?: string;
}): Promise<ResolvedTenant> {
  const controlDb = getControlDb();
  const [row] = await controlDb
    .insert(tenants)
    .values({
      slug: params.slug,
      name: params.name,
      status: 'ACTIVE',
      isolationMode: 'SHARED',
      isDefault: false,
    })
    .returning();

  if (params.domain) {
    await controlDb.insert(tenantDomains).values({
      tenantId: row.id,
      domain: params.domain,
      isPrimary: true,
      isVerified: true,
      sslStatus: 'ACTIVE',
    });
  }

  return {
    id: row.id,
    slug: row.slug,
    name: row.name,
    status: 'ACTIVE',
    isolationMode: 'SHARED',
    encryptedDbUrl: row.encryptedDbUrl,
    migrationVersion: row.migrationVersion,
    planTier: row.planTier,
    isDefault: row.isDefault,
  };
}

export async function destroyEphemeralTenant(tenantId: string): Promise<void> {
  const adminPool = getAdminPool();
  const client = await adminPool.connect();
  try {
    await client.query('BEGIN');
    await client.query("SELECT set_config('app.current_tenant_id', $1, true)", [tenantId]);
    for (const table of [...TENANT_TABLES_ORDERED].reverse()) {
      await client.query(`DELETE FROM "${table}" WHERE store_id = $1`, [tenantId]);
    }
    await client.query('COMMIT');
  } catch {
    await client.query('ROLLBACK').catch(() => undefined);
  } finally {
    client.release();
  }

  await getControlDb().delete(tenants).where(eq(tenants.id, tenantId));
}
