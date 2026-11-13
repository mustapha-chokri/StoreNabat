import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { sql } from 'drizzle-orm';
import { products, storeSettings } from '@/db/schema/tenant';
import { withTenantDb } from '@/core/tenancy/context';
import { resolveTenantFromHost } from '@/core/tenancy/resolver';
import { getSharedPool } from '@/db/pools';
import type { ResolvedTenant } from '@/core/tenancy/types';
import {
  buildTestStoreSettings,
  canRunPostgresIntegrationTests,
  createEphemeralTenant,
  destroyEphemeralTenant,
} from './db-helper';

describe('Multi-Tenant PostgreSQL RLS & Host Isolation', () => {
  let dbReady = false;
  let tenantA: ResolvedTenant | null = null;
  let tenantB: ResolvedTenant | null = null;
  const suffix = Date.now();
  const domainA = `store-a-${suffix}.test`;
  const domainB = `store-b-${suffix}.test`;

  beforeAll(async () => {
    const check = await canRunPostgresIntegrationTests();
    if (!check.ready) {
      console.warn(`[integration-skip] tenant-isolation: ${check.reason}`);
      return;
    }
    dbReady = true;

    tenantA = await createEphemeralTenant({
      slug: `test-iso-a-${suffix}`,
      name: 'Test Store Alpha',
      domain: domainA,
    });
    tenantB = await createEphemeralTenant({
      slug: `test-iso-b-${suffix}`,
      name: 'Test Store Beta',
      domain: domainB,
    });

    await withTenantDb(tenantA, async (db) => {
      await db.insert(storeSettings).values(
        buildTestStoreSettings(tenantA!.id, { ar: 'متجر أ', en: 'Store Alpha' })
      );
      await db.insert(products).values({
        storeId: tenantA!.id,
        slug: `prod-a-${suffix}`,
        titleI18n: { ar: 'منتج أ', en: 'Product Alpha' },
        regularPrice: '150.00',
        isPublished: true,
      });
    });

    await withTenantDb(tenantB, async (db) => {
      await db.insert(storeSettings).values(
        buildTestStoreSettings(tenantB!.id, { ar: 'متجر ب', en: 'Store Beta' })
      );
      await db.insert(products).values({
        storeId: tenantB!.id,
        slug: `prod-b-${suffix}`,
        titleI18n: { ar: 'منتج ب', en: 'Product Beta' },
        regularPrice: '290.00',
        isPublished: true,
      });
    });
  });

  afterAll(async () => {
    if (tenantA) await destroyEphemeralTenant(tenantA.id);
    if (tenantB) await destroyEphemeralTenant(tenantB.id);
  });

  it('resolves distinct tenants strictly by HTTP Host mapping', async (ctx) => {
    if (!dbReady || !tenantA || !tenantB) return ctx.skip();

    const resolvedA = await resolveTenantFromHost(`${domainA}:3000`);
    const resolvedB = await resolveTenantFromHost(domainB);

    expect(resolvedA.id).toBe(tenantA.id);
    expect(resolvedB.id).toBe(tenantB.id);
    expect(resolvedA.id).not.toBe(resolvedB.id);
  });

  it('enforces PostgreSQL Row-Level Security across stores on shared runtime pool', async (ctx) => {
    if (!dbReady || !tenantA || !tenantB) return ctx.skip();

    // Unfiltered SELECT inside Tenant A context must ONLY see Tenant A rows
    const rowsSeenByA = await withTenantDb(tenantA, async (db) => {
      return db.select().from(products);
    });
    expect(rowsSeenByA.length).toBe(1);
    expect(rowsSeenByA[0].storeId).toBe(tenantA.id);
    expect(rowsSeenByA[0].slug).toBe(`prod-a-${suffix}`);

    // Unfiltered SELECT inside Tenant B context must ONLY see Tenant B rows
    const rowsSeenByB = await withTenantDb(tenantB, async (db) => {
      return db.select().from(products);
    });
    expect(rowsSeenByB.length).toBe(1);
    expect(rowsSeenByB[0].storeId).toBe(tenantB.id);

    // Cross-tenant INSERT with Tenant B's storeId inside Tenant A's tx MUST fail RLS WITH CHECK
    await expect(
      withTenantDb(tenantA, async (db) => {
        await db.execute(
          sql`INSERT INTO products (store_id, slug, title_i18n, regular_price)
              VALUES (${tenantB!.id}, ${`forged-${suffix}`}, '{"en":"Forged"}'::jsonb, 10.00)`
        );
      })
    ).rejects.toThrow();

    // Raw query on runtime pool without app.current_tenant_id sees zero rows (NOBYPASSRLS + FORCE RLS)
    const rawNoContext = await getSharedPool().query('SELECT id FROM products WHERE slug = $1', [
      `prod-a-${suffix}`,
    ]);
    expect(rawNoContext.rows.length).toBe(0);
  });
});
