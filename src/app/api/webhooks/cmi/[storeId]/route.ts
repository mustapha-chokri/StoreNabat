import { NextRequest, NextResponse } from 'next/server';
import { and, eq } from 'drizzle-orm';
import {
  orders,
  paymentGatewayConfigs,
  paymentTransactions,
  webhookLogs,
} from '@/db/schema/tenant';
import { withTenantIdDb } from '@/core/tenancy/context';
import { decryptJsonSecret } from '@/core/crypto';
import { verifyCmiCallbackHash } from '@/services/payments/cmi';
import { updateOrderStatus } from '@/services/orders';
import { createTenantNotification } from '@/services/notifications';
import { enqueueJob } from '@/core/jobs/queue';

/**
 * CMI / Moroccan bank server-to-server callback endpoint.
 * Expects application/x-www-form-urlencoded POST signed with SHA-512 HMAC/HASH.
 * Returns `ACTION=POSTAUTH` on valid authorization per CMI specification.
 */
export async function POST(
  req: NextRequest,
  context: { params: Promise<{ storeId: string }> }
) {
  const { storeId } = await context.params;
  const formData = await req.formData();
  const payload: Record<string, string> = {};
  formData.forEach((value, key) => {
    payload[key] = String(value);
  });

  try {
    const responseText = await withTenantIdDb(storeId, async (db) => {
      const [cfg] = await db
        .select()
        .from(paymentGatewayConfigs)
        .where(
          and(
            eq(paymentGatewayConfigs.storeId, storeId),
            eq(paymentGatewayConfigs.gatewayCode, 'CMI')
          )
        )
        .limit(1);

      const secrets = decryptJsonSecret<Record<string, string>>(cfg?.encryptedSecrets) || {};
      const storeKey = secrets.storeKey || '';

      const valid = verifyCmiCallbackHash(payload, storeKey);
      const oid = payload.oid || '';

      if (!valid) {
        await db.insert(webhookLogs).values({
          storeId,
          provider: 'CMI',
          eventId: payload.TransId || oid,
          eventType: payload.ProcReturnCode || 'CALLBACK',
          signatureValid: false,
          payload,
          processingStatus: 'FAILED',
          errorMessage: 'CMI HASH signature mismatch',
        });
        return 'FAILURE';
      }

      const [order] = await db
        .select()
        .from(orders)
        .where(and(eq(orders.storeId, storeId), eq(orders.orderNumber, oid)))
        .limit(1);

      if (!order) return 'FAILURE';

      const isApproved = payload.ProcReturnCode === '00';
      const [tx] = await db
        .select()
        .from(paymentTransactions)
        .where(
          and(
            eq(paymentTransactions.storeId, storeId),
            eq(paymentTransactions.orderId, order.id),
            eq(paymentTransactions.gatewayCode, 'CMI')
          )
        )
        .limit(1);

      if (isApproved) {
        if (tx && tx.status !== 'SUCCEEDED') {
          await db
            .update(paymentTransactions)
            .set({
              status: 'SUCCEEDED',
              externalTransactionId: payload.TransId || tx.externalTransactionId,
              rawResponse: payload,
              updatedAt: new Date(),
            })
            .where(and(eq(paymentTransactions.storeId, storeId), eq(paymentTransactions.id, tx.id)));

          await updateOrderStatus(db, {
            storeId,
            orderId: order.id,
            newStatus: 'CONFIRMED',
            paymentStatus: 'PAID',
            note: `CMI Payment Approved (AuthCode: ${payload.AuthCode || 'N/A'})`,
            actorEmail: 'cmi-callback',
          });

          await createTenantNotification(db, {
            storeId,
            type: 'PAYMENT_CONFIRMED',
            titleI18n: {
              ar: `تأكيد دفع CMI #${order.orderNumber}`,
              fr: `Paiement CMI confirmé #${order.orderNumber}`,
              en: `CMI Payment Confirmed #${order.orderNumber}`,
            },
            messageI18n: {
              ar: `تم الدفع بنجاح بمبلغ ${order.totalAmount} د.م.`,
              fr: `Paiement réussi : ${order.totalAmount} DH`,
              en: `Paid successfully: ${order.totalAmount} MAD`,
            },
            linkUrl: `/admin/orders?order=${order.id}`,
            entityType: 'order',
            entityId: order.id,
          });

          void enqueueJob({
            name: 'send-meta-capi',
            tenantId: storeId,
            eventName: 'Purchase',
            eventId: `cmi_${payload.TransId || oid}`,
            email: order.customerEmail,
            phone: order.normalizedPhone,
            value: Number(order.totalAmount),
            currency: 'MAD',
            orderNumber: order.orderNumber,
          });
        }

        await db.insert(webhookLogs).values({
          storeId,
          provider: 'CMI',
          eventId: payload.TransId || oid,
          eventType: 'APPROVED',
          signatureValid: true,
          payload,
          processingStatus: 'PROCESSED',
        });

        return 'ACTION=POSTAUTH';
      }

      await db
        .update(orders)
        .set({ paymentStatus: 'FAILED', updatedAt: new Date() })
        .where(and(eq(orders.storeId, storeId), eq(orders.id, order.id)));

      await db.insert(webhookLogs).values({
        storeId,
        provider: 'CMI',
        eventId: payload.TransId || oid,
        eventType: `DECLINED_${payload.ProcReturnCode || ''}`,
        signatureValid: true,
        payload,
        processingStatus: 'PROCESSED',
      });

      return 'APPROVED';
    });

    return new NextResponse(responseText, {
      status: 200,
      headers: { 'Content-Type': 'text/plain' },
    });
  } catch {
    return new NextResponse('FAILURE', { status: 400 });
  }
}

