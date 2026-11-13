import { notifications } from '@/db/schema/tenant';
import type { TenantDb } from '@/db/pools';
import { publishTenantNotification } from '@/core/jobs/pubsub';
import type { I18nMap } from '@/db/schema/types';

export type NotificationType =
  | 'NEW_ORDER'
  | 'NEW_CUSTOMER'
  | 'PAYMENT_CONFIRMED'
  | 'PAYMENT_FAILED'
  | 'LOW_STOCK'
  | 'OUT_OF_STOCK'
  | 'ORDER_CANCELLED'
  | 'NEW_REVIEW'
  | 'SYSTEM_ALERT';

/**
 * Inserts a persistent notification inside the tenant's DB transaction
 * and broadcasts a real-time SSE alert.
 */
export async function createTenantNotification(
  db: TenantDb,
  params: {
    storeId: string;
    type: NotificationType;
    titleI18n: I18nMap;
    messageI18n: I18nMap;
    linkUrl?: string;
    entityType?: string;
    entityId?: string;
  }
): Promise<void> {
  const [row] = await db
    .insert(notifications)
    .values({
      storeId: params.storeId,
      type: params.type,
      titleI18n: params.titleI18n,
      messageI18n: params.messageI18n,
      linkUrl: params.linkUrl,
      entityType: params.entityType,
      entityId: params.entityId,
    })
    .returning();

  await publishTenantNotification({
    id: row.id,
    storeId: row.storeId,
    type: row.type,
    titleI18n: row.titleI18n,
    messageI18n: row.messageI18n,
    linkUrl: row.linkUrl,
    createdAt: row.createdAt.toISOString(),
  });
}

