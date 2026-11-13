import { and, eq, sql } from 'drizzle-orm';
import {
  inventoryMovements,
  orderItems,
  orders,
  productBundleItems,
  products,
  productVariants,
} from '@/db/schema/tenant';
import type { TenantDb } from '@/db/pools';
import { createTenantNotification } from '@/services/notifications';

interface StockTarget {
  productId: string;
  variantId: string | null;
  quantity: number;
  title: string;
}

async function expandOrderTargets(
  db: TenantDb,
  storeId: string,
  orderId: string
): Promise<StockTarget[]> {
  const items = await db
    .select()
    .from(orderItems)
    .where(and(eq(orderItems.storeId, storeId), eq(orderItems.orderId, orderId)));

  const targets: StockTarget[] = [];

  for (const item of items) {
    if (!item.productId) continue;
    if (item.productType === 'DIGITAL' || item.productType === 'SERVICE') continue;

    if (item.productType === 'BUNDLE') {
      const bundleRows = await db
        .select()
        .from(productBundleItems)
        .where(
          and(
            eq(productBundleItems.storeId, storeId),
            eq(productBundleItems.bundleProductId, item.productId)
          )
        );
      for (const b of bundleRows) {
        targets.push({
          productId: b.itemProductId,
          variantId: b.itemVariantId,
          quantity: b.quantity * item.quantity,
          title: item.productTitle,
        });
      }
    } else {
      targets.push({
        productId: item.productId,
        variantId: item.variantId,
        quantity: item.quantity,
        title: item.productTitle,
      });
    }
  }

  return targets;
}

/**
 * Atomically checks & deducts stock for an order inside the current tenant DB transaction.
 * Prevents overselling with row-level locks (`FOR UPDATE`) and logs every movement.
 */
export async function deductOrderStock(
  db: TenantDb,
  params: {
    storeId: string;
    orderId: string;
    reason: 'ORDER_CREATED' | 'ORDER_CONFIRMATION';
    actorEmail?: string;
  }
): Promise<void> {
  const { storeId, orderId, reason, actorEmail } = params;

  const orderRows = await db
    .select()
    .from(orders)
    .where(and(eq(orders.storeId, storeId), eq(orders.id, orderId)))
    .limit(1);

  if (orderRows.length === 0) throw new Error('Order not found for stock deduction.');
  if (orderRows[0].stockDeducted) return;

  const targets = await expandOrderTargets(db, storeId, orderId);

  for (const target of targets) {
    const prodRes = await db.execute(
      sql`SELECT id, track_inventory, stock_quantity, low_stock_threshold, allow_backorders, title_i18n
          FROM products
          WHERE store_id = ${storeId} AND id = ${target.productId}
          FOR UPDATE`
    );
    const prod = prodRes.rows[0] as
      | {
          id: string;
          track_inventory: boolean;
          stock_quantity: number;
          low_stock_threshold: number;
          allow_backorders: boolean;
          title_i18n: Record<string, string>;
        }
      | undefined;

    if (!prod || !prod.track_inventory) continue;

    if (target.variantId) {
      const varRes = await db.execute(
        sql`SELECT id, stock_quantity FROM product_variants
            WHERE store_id = ${storeId} AND id = ${target.variantId}
            FOR UPDATE`
      );
      const variant = varRes.rows[0] as { id: string; stock_quantity: number } | undefined;
      if (!variant) continue;

      const prev = variant.stock_quantity;
      const next = prev - target.quantity;
      if (next < 0 && !prod.allow_backorders) {
        throw new Error(`INSUFFICIENT_STOCK:${target.title}`);
      }

      await db
        .update(productVariants)
        .set({ stockQuantity: next, updatedAt: new Date() })
        .where(and(eq(productVariants.storeId, storeId), eq(productVariants.id, target.variantId)));

      await db.insert(inventoryMovements).values({
        storeId,
        productId: target.productId,
        variantId: target.variantId,
        orderId,
        changeAmount: -target.quantity,
        previousQuantity: prev,
        newQuantity: next,
        reason,
        actorEmail: actorEmail || 'system',
      });

      await maybeEmitStockAlert(db, {
        storeId,
        productId: target.productId,
        titleI18n: prod.title_i18n,
        newQuantity: next,
        threshold: prod.low_stock_threshold,
      });
    } else {
      const prev = prod.stock_quantity;
      const next = prev - target.quantity;
      if (next < 0 && !prod.allow_backorders) {
        throw new Error(`INSUFFICIENT_STOCK:${target.title}`);
      }

      await db
        .update(products)
        .set({ stockQuantity: next, updatedAt: new Date() })
        .where(and(eq(products.storeId, storeId), eq(products.id, target.productId)));

      await db.insert(inventoryMovements).values({
        storeId,
        productId: target.productId,
        variantId: null,
        orderId,
        changeAmount: -target.quantity,
        previousQuantity: prev,
        newQuantity: next,
        reason,
        actorEmail: actorEmail || 'system',
      });

      await maybeEmitStockAlert(db, {
        storeId,
        productId: target.productId,
        titleI18n: prod.title_i18n,
        newQuantity: next,
        threshold: prod.low_stock_threshold,
      });
    }
  }

  await db
    .update(orders)
    .set({ stockDeducted: true, updatedAt: new Date() })
    .where(and(eq(orders.storeId, storeId), eq(orders.id, orderId)));
}

/**
 * Restores previously deducted stock when an order is cancelled or returned.
 */
export async function restoreOrderStock(
  db: TenantDb,
  params: {
    storeId: string;
    orderId: string;
    reason: 'ORDER_CANCELLATION' | 'ORDER_RETURN';
    actorEmail?: string;
  }
): Promise<void> {
  const { storeId, orderId, reason, actorEmail } = params;

  const orderRows = await db
    .select()
    .from(orders)
    .where(and(eq(orders.storeId, storeId), eq(orders.id, orderId)))
    .limit(1);

  if (orderRows.length === 0 || !orderRows[0].stockDeducted) return;

  const targets = await expandOrderTargets(db, storeId, orderId);

  for (const target of targets) {
    if (target.variantId) {
      const varRes = await db.execute(
        sql`SELECT stock_quantity FROM product_variants
            WHERE store_id = ${storeId} AND id = ${target.variantId}
            FOR UPDATE`
      );
      const variant = varRes.rows[0] as { stock_quantity: number } | undefined;
      if (!variant) continue;

      const prev = variant.stock_quantity;
      const next = prev + target.quantity;
      await db
        .update(productVariants)
        .set({ stockQuantity: next, updatedAt: new Date() })
        .where(and(eq(productVariants.storeId, storeId), eq(productVariants.id, target.variantId)));

      await db.insert(inventoryMovements).values({
        storeId,
        productId: target.productId,
        variantId: target.variantId,
        orderId,
        changeAmount: target.quantity,
        previousQuantity: prev,
        newQuantity: next,
        reason,
        actorEmail: actorEmail || 'system',
      });
    } else {
      const prodRes = await db.execute(
        sql`SELECT track_inventory, stock_quantity FROM products
            WHERE store_id = ${storeId} AND id = ${target.productId}
            FOR UPDATE`
      );
      const prod = prodRes.rows[0] as { track_inventory: boolean; stock_quantity: number } | undefined;
      if (!prod || !prod.track_inventory) continue;

      const prev = prod.stock_quantity;
      const next = prev + target.quantity;
      await db
        .update(products)
        .set({ stockQuantity: next, updatedAt: new Date() })
        .where(and(eq(products.storeId, storeId), eq(products.id, target.productId)));

      await db.insert(inventoryMovements).values({
        storeId,
        productId: target.productId,
        variantId: null,
        orderId,
        changeAmount: target.quantity,
        previousQuantity: prev,
        newQuantity: next,
        reason,
        actorEmail: actorEmail || 'system',
      });
    }
  }

  await db
    .update(orders)
    .set({ stockDeducted: false, updatedAt: new Date() })
    .where(and(eq(orders.storeId, storeId), eq(orders.id, orderId)));
}

export async function adjustManualStock(
  db: TenantDb,
  params: {
    storeId: string;
    productId: string;
    variantId?: string | null;
    newQuantity: number;
    note?: string;
    actorEmail: string;
  }
): Promise<void> {
  const { storeId, productId, variantId, newQuantity, note, actorEmail } = params;

  if (variantId) {
    const varRows = await db
      .select()
      .from(productVariants)
      .where(and(eq(productVariants.storeId, storeId), eq(productVariants.id, variantId)))
      .limit(1);
    if (varRows.length === 0) throw new Error('Variant not found');
    const prev = varRows[0].stockQuantity;
    await db
      .update(productVariants)
      .set({ stockQuantity: newQuantity, updatedAt: new Date() })
      .where(and(eq(productVariants.storeId, storeId), eq(productVariants.id, variantId)));
    await db.insert(inventoryMovements).values({
      storeId,
      productId,
      variantId,
      changeAmount: newQuantity - prev,
      previousQuantity: prev,
      newQuantity,
      reason: 'MANUAL_ADJUSTMENT',
      note,
      actorEmail,
    });
  } else {
    const prodRows = await db
      .select()
      .from(products)
      .where(and(eq(products.storeId, storeId), eq(products.id, productId)))
      .limit(1);
    if (prodRows.length === 0) throw new Error('Product not found');
    const prev = prodRows[0].stockQuantity;
    await db
      .update(products)
      .set({ stockQuantity: newQuantity, updatedAt: new Date() })
      .where(and(eq(products.storeId, storeId), eq(products.id, productId)));
    await db.insert(inventoryMovements).values({
      storeId,
      productId,
      variantId: null,
      changeAmount: newQuantity - prev,
      previousQuantity: prev,
      newQuantity,
      reason: 'MANUAL_ADJUSTMENT',
      note,
      actorEmail,
    });
  }
}

async function maybeEmitStockAlert(
  db: TenantDb,
  params: {
    storeId: string;
    productId: string;
    titleI18n: Record<string, string>;
    newQuantity: number;
    threshold: number;
  }
): Promise<void> {
  if (params.newQuantity <= 0) {
    await createTenantNotification(db, {
      storeId: params.storeId,
      type: 'OUT_OF_STOCK',
      titleI18n: {
        ar: 'نفاد المخزون',
        fr: 'Rupture de stock',
        en: 'Out of Stock Alert',
      },
      messageI18n: {
        ar: `نفد مخزون المنتج: ${params.titleI18n.ar || params.titleI18n.fr || ''}`,
        fr: `Produit en rupture de stock : ${params.titleI18n.fr || params.titleI18n.ar || ''}`,
        en: `Product out of stock: ${params.titleI18n.en || params.titleI18n.fr || ''}`,
      },
      linkUrl: `/admin/inventory`,
      entityType: 'product',
      entityId: params.productId,
    });
  } else if (params.newQuantity <= params.threshold) {
    await createTenantNotification(db, {
      storeId: params.storeId,
      type: 'LOW_STOCK',
      titleI18n: {
        ar: 'تنبيه انخفاض المخزون',
        fr: 'Stock faible',
        en: 'Low Stock Alert',
      },
      messageI18n: {
        ar: `المخزون المتبقي (${params.newQuantity}) من: ${params.titleI18n.ar || ''}`,
        fr: `Stock restant (${params.newQuantity}) pour : ${params.titleI18n.fr || ''}`,
        en: `Remaining stock (${params.newQuantity}) for: ${params.titleI18n.en || ''}`,
      },
      linkUrl: `/admin/inventory`,
      entityType: 'product',
      entityId: params.productId,
    });
  }
}

