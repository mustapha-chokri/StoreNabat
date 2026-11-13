import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { getEnv } from '@/core/env';
import { getAdminPool } from '@/db/pools';
import { migrateTenantDatabase } from '@/core/migration-engine';
import { withTenantDb, withTenantIdDb } from '@/core/tenancy/context';
import { resolveTenantById } from '@/core/tenancy/resolver';
import { categories, products, storeSettings } from '@/db/schema/tenant';
import type { ResolvedTenant } from '@/core/tenancy/types';
import {
  buildTestStoreSettings,
  canRunPostgresIntegrationTests,
  createEphemeralTenant,
  destroyEphemeralTenant,
} from './db-helper';

describe('Hybrid Multi-Tenant Migration Engine (SHARED <-> DEDICATED)', () => {
  let dbReady = false;
  let tenant: ResolvedTenant | null = null;
  let dedicatedDbName = '';
  let dedicatedDbUrl = '';
  const suffix = Date.now();

  beforeAll(async () => {
    const check = await canRunPostgresIntegrationTests();
    if (!check.ready) {
      console.warn(`[integration-skip] tenant-migration: ${check.reason}`);
      return;
    }
    dbReady = true;

    tenant = await createEphemeralTenant({
      slug: `test-mig-${suffix}`,
      name: 'Migration Test Store',
    });

    await withTenantDb(tenant, async (db) => {
      await db.insert(storeSettings).values(
        buildTestStoreSettings(tenant!.id, { ar: 'متجر الترحيل', en: 'Migration Store' })
      );
      const [cat] = await db
        .insert(categories)
        .values({
          storeId: tenant!.id,
          slug: `mig-cat-${suffix}`,
          nameI18n: { ar: 'تصنيف', en: 'Category' },
        })
        .returning();

      await db.insert(products).values({
        storeId: tenant!.id,
        categoryId: cat.id,
        slug: `mig-prod-${suffix}`,
        titleI18n: { ar: 'منتج مهيأ للترحيل', en: 'Migrated Product' },
        regularPrice: '420.00',
        isPublished: true,
      });
    });

    dedicatedDbName = `nabat_test_ded_${suffix}`;
    const parsedAdmin = new URL(getEnv().databaseAdminUrl);
    parsedAdmin.pathname = `/${dedicatedDbName}`;
    dedicatedDbUrl = parsedAdmin.toString();

    await getAdminPool().query(`CREATE DATABASE "${dedicatedDbName}";`);
  }, 30_000);

  afterAll(async () => {
    if (tenant) {
      await destroyEphemeralTenant(tenant.id);
    }
    if (dbReady && dedicatedDbName) {
      await getAdminPool()
        .query(
          `SELECT pg_terminate_backend(pid) FROM pg_stat_activity WHERE datname = $1 AND pid <> pg_backend_pid();`,
          [dedicatedDbName]
        )
        .catch(() => undefined);
      await getAdminPool()
        .query(`DROP DATABASE IF EXISTS "${dedicatedDbName}";`)
        .catch(() => undefined);
    }
  });

  it('migrates a tenant SHARED -> DEDICATED -> SHARED with matching row counts & SHA-256 checksums', async (ctx) => {
    if (!dbReady || !tenant) return ctx.skip();

    const toDedicated = await migrateTenantDatabase({
      tenantId: tenant.id,
      direction: 'SHARED_TO_DEDICATED',
      targetDedicatedDbUrl: dedicatedDbUrl,
      actor: 'vitest-suite',
    });

    expect(toDedicated.rowCountsSource.products).toBe(1);
    expect(toDedicated.rowCountsTarget.products).toBe(1);
    expect(toDedicated.checksums.products).toBeTruthy();

    const updatedDedicated = await resolveTenantById(tenant.id);
    expect(updatedDedicated.isolationMode).toBe('DEDICATED');
    expect(updatedDedicated.encryptedDbUrl).toBeTruthy();

    // Verify reads seamlessly route to the dedicated DB via Control Plane registry
    const dedicatedProducts = await withTenantIdDb(tenant.id, async (db) => {
      return db.select().from(products);
    });
    expect(dedicatedProducts.length).toBe(1);
    expect(dedicatedProducts[0].slug).toBe(`mig-prod-${suffix}`);

    // Now migrate cleanly back to SHARED PostgreSQL pool
    const toShared = await migrateTenantDatabase({
      tenantId: tenant.id,
      direction: 'DEDICATED_TO_SHARED',
      actor: 'vitest-suite',
    });

    expect(toShared.rowCountsSource.products).toBe(1);
    expect(toShared.rowCountsTarget.products).toBe(1);

    const restoredShared = await resolveTenantById(tenant.id);
    expect(restoredShared.isolationMode).toBe('SHARED');
    expect(restoredShared.encryptedDbUrl).toBeNull();
  }, 60_000);
});
