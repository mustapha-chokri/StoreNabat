import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { and, eq } from 'drizzle-orm';
import {
  digitalDownloads,
  digitalFiles,
  orders,
  paymentGatewayConfigs,
  products,
  shippingCities,
  shippingZones,
  storeSettings,
} from '@/db/schema/tenant';
import { withTenantDb } from '@/core/tenancy/context';
import { createTenantOrder, updateOrderStatus } from '@/services/orders';
import { provisionDigitalDownloadsForOrder } from '@/services/digital';
import type { ResolvedTenant } from '@/core/tenancy/types';
import {
  buildTestStoreSettings,
  canRunPostgresIntegrationTests,
  createEphemeralTenant,
  destroyEphemeralTenant,
} from './db-helper';

describe('Digital Download Access Gating & Payment Enforcement', () => {
  let dbReady = false;
  let tenant: ResolvedTenant | null = null;
  let productId = '';
  let digitalFileId = '';
  let cityId = '';
  const suffix = Date.now();

  beforeAll(async () => {
    const check = await canRunPostgresIntegrationTests();
    if (!check.ready) {
      console.warn(`[integration-skip] digital-download-gating: ${check.reason}`);
      return;
    }
    dbReady = true;

    tenant = await createEphemeralTenant({
      slug: `test-digital-${suffix}`,
      name: 'Digital Gating Test Store',
    });

    await withTenantDb(tenant, async (db) => {
      await db.insert(storeSettings).values(
        buildTestStoreSettings(tenant!.id, { ar: 'متجر رقمي', en: 'Digital Store' })
      );

      await db.insert(paymentGatewayConfigs).values({
        storeId: tenant!.id,
        gatewayCode: 'COD',
        isEnabled: true,
        mode: 'LIVE',
        displayNameI18n: { ar: 'الدفع عند الاستلام', en: 'Cash on Delivery' },
      });

      const [zone] = await db
        .insert(shippingZones)
        .values({
          storeId: tenant!.id,
          nameI18n: { ar: 'كل المغرب', en: 'All Morocco' },
          defaultFee: '0.00',
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
          regionCode: 'RABAT_SALE',
          regionNameI18n: { ar: 'الرباط', en: 'Rabat' },
          cityNameI18n: { ar: 'الرباط', en: 'Rabat' },
          deliveryFee: '0.00',
          codFee: '0.00',
          codEnabled: true,
          isActive: true,
        })
        .returning();
      cityId = city.id;

      const [prod] = await db
        .insert(products)
        .values({
          storeId: tenant!.id,
          productType: 'DIGITAL',
          slug: `ebook-guide-${suffix}`,
          titleI18n: { ar: 'دليل رقمي شامل', en: 'Comprehensive E-Book' },
          regularPrice: '120.00',
          isPublished: true,
        })
        .returning();
      productId = prod.id;

      const [df] = await db
        .insert(digitalFiles)
        .values({
          storeId: tenant!.id,
          productId: prod.id,
          fileName: 'atlas-guide.pdf',
          storageKey: `digital/${tenant!.id}/atlas-guide.pdf`,
          fileSizeBytes: 1024 * 50,
          mimeType: 'application/pdf',
          maxDownloads: 5,
          expiryDays: 30,
        })
        .returning();
      digitalFileId = df.id;
    });
  });

  afterAll(async () => {
    if (tenant) {
      await destroyEphemeralTenant(tenant.id);
    }
  });

  it('strictly blocks digital download token provisioning until order is PAID', async (ctx) => {
    if (!dbReady || !tenant) return ctx.skip();

    // 1. Create an order with the digital product (unpaid / PENDING)
    const result = await withTenantDb(tenant, (db) =>
      createTenantOrder(db, {
        storeId: tenant!.id,
        checkoutType: 'QUICK_ORDER',
        locale: 'ar',
        customerName: 'Yassine Atlas',
        phone: '0612345678',
        cityName: 'Rabat',
        cityId,
        shippingAddress: 'Avenue Hassan II, Rabat',
        paymentMethod: 'COD',
        items: [
          {
            productId,
            quantity: 1,
          },
        ],
      })
    );

    expect(result.order.orderNumber).toBeDefined();

    // 2. Verify that NO digital download record exists for this unpaid order
    await withTenantDb(tenant, async (db) => {
      const recordsBefore = await db
        .select()
        .from(digitalDownloads)
        .where(
          and(
            eq(digitalDownloads.storeId, tenant!.id),
            eq(digitalDownloads.orderId, result.order.id)
          )
        );
      expect(recordsBefore.length).toBe(0);

      // Attempt to invoke provisionDigitalDownloadsForOrder directly on unpaid order
      await provisionDigitalDownloadsForOrder(db, {
        storeId: tenant!.id,
        orderId: result.order.id,
        customerId: null,
      });

      const recordsAfterManual = await db
        .select()
        .from(digitalDownloads)
        .where(
          and(
            eq(digitalDownloads.storeId, tenant!.id),
            eq(digitalDownloads.orderId, result.order.id)
          )
        );
      expect(recordsAfterManual.length).toBe(0);

      // 3. Update payment status to PAID
      await updateOrderStatus(db, {
        storeId: tenant!.id,
        orderId: result.order.id,
        newStatus: 'CONFIRMED',
        paymentStatus: 'PAID',
        actorEmail: 'admin@nabat.ma',
        note: 'Customer paid successfully via bank card',
      });

      // 4. Verify that digital download token is now automatically provisioned
      const recordsPaid = await db
        .select()
        .from(digitalDownloads)
        .where(
          and(
            eq(digitalDownloads.storeId, tenant!.id),
            eq(digitalDownloads.orderId, result.order.id)
          )
        );

      expect(recordsPaid.length).toBe(1);
      expect(recordsPaid[0].digitalFileId).toBe(digitalFileId);
      expect(recordsPaid[0].accessToken.length).toBeGreaterThan(20);
      expect(recordsPaid[0].maxDownloads).toBe(5);
      expect(recordsPaid[0].downloadCount).toBe(0);
      expect(recordsPaid[0].isRevoked).toBe(false);

      const token = recordsPaid[0].accessToken;

      // 5. Query token join orders and verify paymentStatus gating logic
      const [tokenRow] = await db
        .select({
          download: digitalDownloads,
          file: digitalFiles,
          order: orders,
        })
        .from(digitalDownloads)
        .innerJoin(digitalFiles, eq(digitalDownloads.digitalFileId, digitalFiles.id))
        .innerJoin(orders, eq(digitalDownloads.orderId, orders.id))
        .where(
          and(
            eq(digitalDownloads.storeId, tenant!.id),
            eq(digitalDownloads.accessToken, token)
          )
        )
        .limit(1);

      expect(tokenRow).toBeDefined();
      expect(tokenRow.order.paymentStatus).toBe('PAID');

      // 6. If the order is refunded, order.paymentStatus !== 'PAID' blocks access
      await updateOrderStatus(db, {
        storeId: tenant!.id,
        orderId: result.order.id,
        newStatus: 'REFUNDED',
        paymentStatus: 'REFUNDED',
        actorEmail: 'admin@nabat.ma',
        note: 'Order refunded upon customer request',
      });

      const [refundedRow] = await db
        .select({
          order: orders,
        })
        .from(orders)
        .where(and(eq(orders.storeId, tenant!.id), eq(orders.id, result.order.id)))
        .limit(1);

      expect(refundedRow.order.paymentStatus).not.toBe('PAID');
    });
  });
});
