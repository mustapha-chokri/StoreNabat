import { NextRequest, NextResponse } from 'next/server';
import { and, desc, eq } from 'drizzle-orm';
import {
  auditLogs,
  orderItems,
  orders,
  orderStatusHistory,
  paymentTransactions,
  storeSettings,
  whatsappConfigs,
  whatsappLogs,
} from '@/db/schema/tenant';
import { getRequestTenant, withTenantDb } from '@/core/tenancy/context';
import { requireAdmin } from '@/core/auth/admin-session';
import { updateOrderStatus } from '@/services/orders';
import { refundGatewayTransaction } from '@/services/payments';
import {
  buildClickToChatUrl,
  DEFAULT_WHATSAPP_TEMPLATES,
  renderWhatsAppTemplate,
} from '@/services/whatsapp';
import { enqueueJob } from '@/core/jobs/queue';
import { assertSameOrigin, errorResponse } from '@/core/http/api';
import type { OrderStatus, PaymentStatus } from '@/db/schema/types';

export async function GET(
  _req: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await context.params;
    const tenant = await getRequestTenant();
    await requireAdmin(tenant, 'orders.read');

    const data = await withTenantDb(tenant, async (db) => {
      const [order] = await db
        .select()
        .from(orders)
        .where(and(eq(orders.storeId, tenant.id), eq(orders.id, id)))
        .limit(1);

      if (!order) return null;

      const items = await db
        .select()
        .from(orderItems)
        .where(and(eq(orderItems.storeId, tenant.id), eq(orderItems.orderId, id)));

      const history = await db
        .select()
        .from(orderStatusHistory)
        .where(
          and(eq(orderStatusHistory.storeId, tenant.id), eq(orderStatusHistory.orderId, id))
        )
        .orderBy(desc(orderStatusHistory.createdAt));

      const transactions = await db
        .select()
        .from(paymentTransactions)
        .where(
          and(eq(paymentTransactions.storeId, tenant.id), eq(paymentTransactions.orderId, id))
        );

      const waLogs = await db
        .select()
        .from(whatsappLogs)
        .where(and(eq(whatsappLogs.storeId, tenant.id), eq(whatsappLogs.orderId, id)))
        .orderBy(desc(whatsappLogs.createdAt));

      const [settings] = await db
        .select()
        .from(storeSettings)
        .where(eq(storeSettings.storeId, tenant.id))
        .limit(1);

      const [waCfg] = await db
        .select()
        .from(whatsappConfigs)
        .where(eq(whatsappConfigs.storeId, tenant.id))
        .limit(1);

      const langKey = order.locale === 'fr' ? 'fr' : order.locale === 'en' ? 'en' : 'ar';
      const storeName = settings?.storeNameI18n?.[langKey] || 'Nabat Al Atlas';
      const tpl =
        waCfg?.templates?.[langKey]?.admin_order_confirmed ||
        DEFAULT_WHATSAPP_TEMPLATES[langKey].admin_order_confirmed;
      const msg = renderWhatsAppTemplate(tpl, {
        customer_name: order.customerName,
        order_number: order.orderNumber,
        store_name: storeName,
        total: order.totalAmount,
        currency: settings?.currencySymbols?.[langKey] || order.currency,
        tracking_number: order.trackingNumber || '-',
      });

      const whatsappQuickUrl = buildClickToChatUrl(
        order.whatsappNumber || order.phone,
        msg
      );

      return {
        order,
        items,
        history,
        transactions,
        whatsappLogs: waLogs,
        whatsappQuickUrl,
        whatsappCloudEnabled: Boolean(waCfg?.cloudApiEnabled),
      };
    });

    if (!data) return NextResponse.json({ error: 'Order not found' }, { status: 404 });
    return NextResponse.json(data);
  } catch (err) {
    return errorResponse(err);
  }
}

export async function PATCH(
  req: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  const csrfErr = assertSameOrigin(req);
  if (csrfErr) return csrfErr;

  try {
    const { id } = await context.params;
    const tenant = await getRequestTenant();
    const admin = await requireAdmin(tenant, 'orders.write');
    const body = (await req.json()) as {
      action?: 'UPDATE_STATUS' | 'EDIT_DETAILS' | 'REFUND' | 'WHATSAPP_ACTION';
      orderStatus?: OrderStatus;
      paymentStatus?: PaymentStatus;
      trackingNumber?: string;
      internalNotes?: string;
      customerName?: string;
      phone?: string;
      cityName?: string;
      shippingAddress?: string;
      note?: string;
      whatsappConfirmationStatus?: string;
      templateKey?: string;
      sendViaCloudApi?: boolean;
    };

    const result = await withTenantDb(tenant, async (db) => {
      if (body.action === 'REFUND') {
        const refundRes = await refundGatewayTransaction(db, {
          storeId: tenant.id,
          orderId: id,
        });
        if (!refundRes.success) {
          throw new Error(refundRes.error || 'Refund failed');
        }
        const updated = await updateOrderStatus(db, {
          storeId: tenant.id,
          orderId: id,
          newStatus: 'REFUNDED',
          paymentStatus: 'REFUNDED',
          note: `Refunded (${refundRes.refundId || 'OK'})`,
          actorEmail: admin.email,
        });
        return { order: updated, refund: refundRes };
      }

      if (body.action === 'EDIT_DETAILS') {
        const [updated] = await db
          .update(orders)
          .set({
            customerName: body.customerName,
            phone: body.phone,
            cityName: body.cityName,
            shippingAddress: body.shippingAddress,
            internalNotes: body.internalNotes,
            trackingNumber: body.trackingNumber,
            updatedAt: new Date(),
          })
          .where(and(eq(orders.storeId, tenant.id), eq(orders.id, id)))
          .returning();

        await db.insert(auditLogs).values({
          storeId: tenant.id,
          adminUserId: admin.id,
          actorEmail: admin.email,
          action: 'order.details_edited',
          entityType: 'order',
          entityId: id,
        });

        return { order: updated };
      }

      if (body.action === 'WHATSAPP_ACTION') {
        const [order] = await db
          .select()
          .from(orders)
          .where(and(eq(orders.storeId, tenant.id), eq(orders.id, id)))
          .limit(1);
        if (!order) throw new Error('ORDER_NOT_FOUND');

        const nextWaStatus = body.whatsappConfirmationStatus || 'CONFIRMED_BY_CUSTOMER';
        const [updated] = await db
          .update(orders)
          .set({
            whatsappConfirmationStatus: nextWaStatus,
            whatsappConfirmedAt:
              nextWaStatus === 'CONFIRMED_BY_CUSTOMER' ? new Date() : order.whatsappConfirmedAt,
            updatedAt: new Date(),
          })
          .where(and(eq(orders.storeId, tenant.id), eq(orders.id, id)))
          .returning();

        if (body.sendViaCloudApi) {
          const tplKey = body.templateKey || 'admin_order_confirmed';
          const langKey = order.locale === 'fr' ? 'fr' : order.locale === 'en' ? 'en' : 'ar';
          const tpl = DEFAULT_WHATSAPP_TEMPLATES[langKey][tplKey] || '';
          const fallbackText = renderWhatsAppTemplate(tpl, {
            customer_name: order.customerName,
            order_number: order.orderNumber,
            store_name: tenant.name,
            total: order.totalAmount,
            currency: order.currency,
            tracking_number: order.trackingNumber || '-',
          });

          void enqueueJob({
            name: 'send-whatsapp-cloud',
            tenantId: tenant.id,
            orderId: order.id,
            recipientPhone: order.whatsappNumber || order.phone,
            templateKey: tplKey,
            templateName: tplKey,
            languageCode: langKey,
            bodyParams: [order.customerName, order.orderNumber, order.totalAmount],
            fallbackText,
          });
        }

        return { order: updated };
      }

      if (!body.orderStatus) {
        throw new Error('orderStatus is required');
      }

      const updated = await updateOrderStatus(db, {
        storeId: tenant.id,
        orderId: id,
        newStatus: body.orderStatus,
        paymentStatus: body.paymentStatus,
        trackingNumber: body.trackingNumber,
        internalNotes: body.internalNotes,
        note: body.note,
        actorEmail: admin.email,
      });
      return { order: updated };
    });

    return NextResponse.json(result);
  } catch (err) {
    return errorResponse(err);
  }
}

