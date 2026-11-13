import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { eq } from 'drizzle-orm';
import {
  inventoryMovements,
  orders,
  paymentGatewayConfigs,
  products,
  shippingCities,
  shippingZones,
  storeSettings,
} from '@/db/schema/tenant';
import { withTenantDb } from '@/core/tenancy/context';
import { createTenantOrder } from '@/services/orders';
import type { ResolvedTenant } from '@/core/tenancy/types';
import {
  buildTestStoreSettings,
  canRunPostgresIntegrationTests,
  createEphemeralTenant,
  destroyEphemeralTenant,
} from './db-helper';

describe('Concurrent Order & Atomic Inventory Locking (Overselling Prevention)', () => {
  let dbReady = false;
  let tenant: ResolvedTenant | null = null;
  let productId = '';
  let cityId = '';
  const suffix = Date.now();

  beforeAll(async () => {
    const check = await canRunPostgresIntegrationTests();
    if (!check.ready) {
      console.warn(`[integration-skip] order-concurrency: ${check.reason}`);
      return;
    }
    dbReady = true;

    tenant = await createEphemeralTenant({
      slug: `test-conc-${suffix}`,
      name: 'Concurrency Test Store',
    });

    await withTenantDb(tenant, async (db) => {
      await db.insert(storeSettings).values(
        buildTestStoreSettings(
          tenant!.id,
          { ar: 'متجر التزامن', en: 'Concurrency Store' },
          'ON_ORDER_CREATED'
        )
      );

      const [zone] = await db
        .insert(shippingZones)
        .values({
          storeId: tenant!.id,
          nameI18n: { ar: 'الدار البيضاء', en: 'Casablanca' },
          defaultFee: '25.00',
          codFee: '0.00',
          codEnabled: true,
          isActive: true,
        })
        .returning();

      const [city] = await db
        .insert(shippingCities)
        .values({
          storeId: tenant!.id,
          zoneId: zone.id,
          regionCode: 'CASA_SETTAT',
          regionNameI18n: { ar: 'الدار البيضاء - سطات', en: 'Casablanca-Settat' },
          cityNameI18n: { ar: 'الدار البيضاء', en: 'Casablanca' },
          deliveryFee: '25.00',
          codFee: '0.00',
          codEnabled: true,
          isActive: true,
        })
        .returning();
      cityId = city.id;

      await db.insert(paymentGatewayConfigs).values({
        storeId: tenant!.id,
        gatewayCode: 'COD',
        isEnabled: true,
        mode: 'LIVE',
        displayNameI18n: { ar: 'الدفع عند الاستلام', en: 'Cash on Delivery' },
      });

      const [prod] = await db
        .insert(products)
        .values({
          storeId: tenant!.id,
          slug: `limited-item-${suffix}`,
          titleI18n: { ar: 'منتج نادر', en: 'Limited Item' },
          regularPrice: '200.00',
          trackInventory: true,
          allowBackorders: false,
          stockQuantity: 1,
          isPublished: true,
        })
        .returning();
      productId = prod.id;
    });
  });

  afterAll(async () => {
    if (tenant) await destroyEphemeralTenant(tenant.id);
  });

  it('prevents overselling when 5 simultaneous checkouts race for 1 unit in stock', async (ctx) => {
    if (!dbReady || !tenant) return ctx.skip();

    const attempts = Array.from({ length: 5 }, (_, idx) =>
      withTenantDb(tenant!, (db) =>
        createTenantOrder(db, {
          storeId: tenant!.id,
          checkoutType: 'QUICK_ORDER',
          locale: 'ar',
          customerName: `Concurrent Buyer ${idx + 1}`,
          phone: `061122334${idx}`,
          cityId,
          shippingAddress: `Rue Test ${idx + 1}`,
          paymentMethod: 'COD',
          items: [{ productId, quantity: 1 }],
        })
      )
    );

    const results = await Promise.allSettled(attempts);
    const succeeded = results.filter((r) => r.status === 'fulfilled');
    const failed = results.filter((r) => r.status === 'rejected');

    expect(succeeded.length).toBe(1);
    expect(failed.length).toBe(4);

    // Confirm final stock is strictly 0 and only 1 order + 1 stock movement exist
    const verification = await withTenantDb(tenant, async (db) => {
      const [prod] = await db
        .select()
        .from(products)
        .where(eq(products.id, productId))
        .limit(1);
      const allOrders = await db.select().from(orders);
      const movements = await db.select().from(inventoryMovements);
      return { prod, allOrders, movements };
    });

    expect(verification.prod.stockQuantity).toBe(0);
    expect(verification.allOrders.length).toBe(1);
    expect(verification.movements.length).toBe(1);
    expect(verification.movements[0].changeAmount).toBe(-1);
  }, 30_000);
});
