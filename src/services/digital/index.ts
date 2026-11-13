import { and, eq } from 'drizzle-orm';
import { digitalDownloads, digitalFiles, orderItems, orders } from '@/db/schema/tenant';
import type { TenantDb } from '@/db/pools';
import { generateSecureToken } from '@/core/crypto';

/**
 * Provisions secure, time-limited & download-limited access tokens
 * for all digital products in a paid order. Strictly verifies that
 * the order is PAID before generating any download tokens.
 */
export async function provisionDigitalDownloadsForOrder(
  db: TenantDb,
  params: {
    storeId: string;
    orderId: string;
    customerId: string | null;
  }
): Promise<void> {
  // Enforce payment requirement: digital downloads are only provisioned once order is PAID
  const [order] = await db
    .select({ paymentStatus: orders.paymentStatus, customerId: orders.customerId })
    .from(orders)
    .where(and(eq(orders.storeId, params.storeId), eq(orders.id, params.orderId)))
    .limit(1);

  if (!order || order.paymentStatus !== 'PAID') {
    return;
  }
  const items = await db
    .select()
    .from(orderItems)
    .where(and(eq(orderItems.storeId, params.storeId), eq(orderItems.orderId, params.orderId)));

  for (const item of items) {
    if (!item.productId) continue;

    const files = await db
      .select()
      .from(digitalFiles)
      .where(
        and(
          eq(digitalFiles.storeId, params.storeId),
          eq(digitalFiles.productId, item.productId)
        )
      );

    for (const file of files) {
      const existing = await db
        .select({ id: digitalDownloads.id })
        .from(digitalDownloads)
        .where(
          and(
            eq(digitalDownloads.storeId, params.storeId),
            eq(digitalDownloads.orderItemId, item.id),
            eq(digitalDownloads.digitalFileId, file.id)
          )
        )
        .limit(1);

      if (existing.length > 0) continue;

      const expiresAt =
        file.expiryDays && file.expiryDays > 0
          ? new Date(Date.now() + file.expiryDays * 24 * 60 * 60 * 1000)
          : null;

      await db.insert(digitalDownloads).values({
        storeId: params.storeId,
        orderId: params.orderId,
        orderItemId: item.id,
        digitalFileId: file.id,
        customerId: params.customerId,
        accessToken: generateSecureToken(32),
        maxDownloads: file.maxDownloads,
        expiresAt,
      });
    }
  }
}

