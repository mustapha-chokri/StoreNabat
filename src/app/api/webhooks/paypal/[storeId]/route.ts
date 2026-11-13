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
import { verifyPayPalWebhookSignature } from '@/services/payments/paypal';
import { updateOrderStatus } from '@/services/orders';
import { createTenantNotification } from '@/services/notifications';
import { enqueueJob } from '@/core/jobs/queue';

export async function POST(
  req: NextRequest,
  context: { params: Promise<{ storeId: string }> }
) {
  const { storeId } = await context.params;
  const rawBody = (await req.json()) as Record<string, unknown>;

  try {
    const valid = await withTenantIdDb(storeId, async (db) => {
      const [cfg] = await db
        .select()
        .from(paymentGatewayConfigs)
        .where(
          and(
            eq(paymentGatewayConfigs.storeId, storeId),
            eq(paymentGatewayConfigs.gatewayCode, 'PAYPAL')
          )
        )
        .limit(1);

      const secrets = decryptJsonSecret<Record<string, string>>(cfg?.encryptedSecrets) || {};
      const clientId = String(cfg?.publicConfig?.clientId || '');
      const webhookId = String(cfg?.publicConfig?.webhookId || '');
      const mode: 'TEST' | 'LIVE' = cfg?.mode === 'LIVE' ? 'LIVE' : 'TEST';

      if (!clientId || !secrets.clientSecret || !webhookId) {
        throw new Error('PayPal webhook credentials incomplete');
      }

      const verified = await verifyPayPalWebhookSignature({
        clientId,
        clientSecret: secrets.clientSecret,
        webhookId,
        mode,
        headers: req.headers,
        rawBody,
      });

      const eventId = String(rawBody.id || '');
      const eventType = String(rawBody.event_type || '');

      if (!verified) {
        await db.insert(webhookLogs).values({
          storeId,
          provider: 'PAYPAL',
          eventId,
          eventType,
          signatureValid: false,
          payload: rawBody,
          processingStatus: 'FAILED',
          errorMessage: 'PayPal signature verification returned non-SUCCESS',
        });
        return false;
      }

      const existingLog = await db
        .select({ id: webhookLogs.id })
        .from(webhookLogs)
        .where(
          and(
            eq(webhookLogs.storeId, storeId),
            eq(webhookLogs.provider, 'PAYPAL'),
            eq(webhookLogs.eventId, eventId),
            eq(webhookLogs.processingStatus, 'PROCESSED')
          )
        )
        .limit(1);

      if (existingLog.length > 0) return true;

      if (eventType === 'PAYMENT.CAPTURE.COMPLETED') {
        const resource = (rawBody.resource || {}) as {
          id?: string;
          custom_id?: string;
          supplementary_data?: { related_ids?: { order_id?: string } };
        };
        const orderIdFromCustom = resource.custom_id?.split(':')[1];
        const paypalOrderId = resource.supplementary_data?.related_ids?.order_id;

        const txRows = paypalOrderId
          ? await db
              .select()
              .from(paymentTransactions)
              .where(
                and(
                  eq(paymentTransactions.storeId, storeId),
                  eq(paymentTransactions.externalTransactionId, paypalOrderId)
                )
              )
              .limit(1)
          : orderIdFromCustom
            ? await db
                .select()
                .from(paymentTransactions)
                .where(
                  and(
                    eq(paymentTransactions.storeId, storeId),
                    eq(paymentTransactions.orderId, orderIdFromCustom),
                    eq(paymentTransactions.gatewayCode, 'PAYPAL')
                  )
                )
                .limit(1)
            : [];

        const tx = txRows[0];
        if (tx && tx.status !== 'SUCCEEDED') {
          await db
            .update(paymentTransactions)
            .set({
              status: 'SUCCEEDED',
              rawResponse: { ...tx.rawResponse, captureId: resource.id, eventId },
              updatedAt: new Date(),
            })
            .where(and(eq(paymentTransactions.storeId, storeId), eq(paymentTransactions.id, tx.id)));

          const updatedOrder = await updateOrderStatus(db, {
            storeId,
            orderId: tx.orderId,
            newStatus: 'CONFIRMED',
            paymentStatus: 'PAID',
            note: 'Payment verified via PayPal Webhook',
            actorEmail: 'paypal-webhook',
          });

          await createTenantNotification(db, {
            storeId,
            type: 'PAYMENT_CONFIRMED',
            titleI18n: {
              ar: `تأكيد دفع PayPal #${updatedOrder.orderNumber}`,
              fr: `Paiement PayPal confirmé #${updatedOrder.orderNumber}`,
              en: `PayPal Payment Confirmed #${updatedOrder.orderNumber}`,
            },
            messageI18n: {
              ar: `تم استلام ${tx.chargeAmount} ${tx.chargeCurrency} (${tx.baseAmount} MAD)`,
              fr: `Reçu ${tx.chargeAmount} ${tx.chargeCurrency}`,
              en: `Received ${tx.chargeAmount} ${tx.chargeCurrency}`,
            },
            linkUrl: `/admin/orders?order=${tx.orderId}`,
            entityType: 'order',
            entityId: tx.orderId,
          });

          void enqueueJob({
            name: 'send-meta-capi',
            tenantId: storeId,
            eventName: 'Purchase',
            eventId: `paypal_${eventId}`,
            email: updatedOrder.customerEmail,
            phone: updatedOrder.normalizedPhone,
            value: Number(updatedOrder.totalAmount),
            currency: 'MAD',
            orderNumber: updatedOrder.orderNumber,
          });
        }
      } else if (eventType === 'PAYMENT.CAPTURE.DENIED') {
        const resource = (rawBody.resource || {}) as { custom_id?: string };
        const orderId = resource.custom_id?.split(':')[1];
        if (orderId) {
          await db
            .update(orders)
            .set({ paymentStatus: 'FAILED', updatedAt: new Date() })
            .where(and(eq(orders.storeId, storeId), eq(orders.id, orderId)));
        }
      }

      await db.insert(webhookLogs).values({
        storeId,
        provider: 'PAYPAL',
        eventId,
        eventType,
        signatureValid: true,
        payload: { id: eventId, event_type: eventType },
        processingStatus: 'PROCESSED',
      });

      return true;
    });

    if (!valid) {
      return NextResponse.json({ error: 'Invalid PayPal signature' }, { status: 400 });
    }
    return NextResponse.json({ received: true });
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : 'PayPal webhook error' },
      { status: 400 }
    );
  }
}

