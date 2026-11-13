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
import { verifyStripeWebhookSignature } from '@/services/payments/stripe';
import { updateOrderStatus } from '@/services/orders';
import { createTenantNotification } from '@/services/notifications';
import { enqueueJob } from '@/core/jobs/queue';

export async function POST(
  req: NextRequest,
  context: { params: Promise<{ storeId: string }> }
) {
  const { storeId } = await context.params;
  const sig = req.headers.get('stripe-signature');
  if (!sig) {
    return NextResponse.json({ error: 'Missing stripe-signature' }, { status: 400 });
  }

  const rawBody = await req.text();

  try {
    const result = await withTenantIdDb(storeId, async (db) => {
      const [cfg] = await db
        .select()
        .from(paymentGatewayConfigs)
        .where(
          and(
            eq(paymentGatewayConfigs.storeId, storeId),
            eq(paymentGatewayConfigs.gatewayCode, 'STRIPE')
          )
        )
        .limit(1);

      const secrets = decryptJsonSecret<Record<string, string>>(cfg?.encryptedSecrets) || {};
      if (!secrets.secretKey || !secrets.webhookSecret) {
        throw new Error('Stripe webhook secrets not configured');
      }

      let event;
      try {
        event = verifyStripeWebhookSignature({
          rawBody,
          signatureHeader: sig,
          webhookSecret: secrets.webhookSecret,
          secretKey: secrets.secretKey,
        });
      } catch (err) {
        await db.insert(webhookLogs).values({
          storeId,
          provider: 'STRIPE',
          signatureValid: false,
          payload: { rawLength: rawBody.length },
          processingStatus: 'FAILED',
          errorMessage: err instanceof Error ? err.message : 'Invalid signature',
        });
        return { valid: false };
      }

      // Deduplicate webhook events
      const existingLog = await db
        .select({ id: webhookLogs.id })
        .from(webhookLogs)
        .where(
          and(
            eq(webhookLogs.storeId, storeId),
            eq(webhookLogs.provider, 'STRIPE'),
            eq(webhookLogs.eventId, event.id),
            eq(webhookLogs.processingStatus, 'PROCESSED')
          )
        )
        .limit(1);

      if (existingLog.length > 0) {
        return { valid: true, duplicate: true };
      }

      if (event.type === 'checkout.session.completed') {
        const session = event.data.object;
        const orderId = session.metadata?.orderId || session.client_reference_id;
        if (orderId) {
          const [tx] = await db
            .select()
            .from(paymentTransactions)
            .where(
              and(
                eq(paymentTransactions.storeId, storeId),
                eq(paymentTransactions.orderId, orderId),
                eq(paymentTransactions.gatewayCode, 'STRIPE')
              )
            )
            .limit(1);

          if (tx && tx.status !== 'SUCCEEDED') {
            await db
              .update(paymentTransactions)
              .set({
                status: 'SUCCEEDED',
                rawResponse: {
                  ...tx.rawResponse,
                  paymentIntent: session.payment_intent,
                  eventId: event.id,
                },
                updatedAt: new Date(),
              })
              .where(
                and(eq(paymentTransactions.storeId, storeId), eq(paymentTransactions.id, tx.id))
              );

            const updatedOrder = await updateOrderStatus(db, {
              storeId,
              orderId,
              newStatus: 'CONFIRMED',
              paymentStatus: 'PAID',
              note: 'Payment verified via Stripe Webhook',
              actorEmail: 'stripe-webhook',
            });

            await createTenantNotification(db, {
              storeId,
              type: 'PAYMENT_CONFIRMED',
              titleI18n: {
                ar: `تأكيد دفع Stripe #${updatedOrder.orderNumber}`,
                fr: `Paiement Stripe confirmé #${updatedOrder.orderNumber}`,
                en: `Stripe Payment Confirmed #${updatedOrder.orderNumber}`,
              },
              messageI18n: {
                ar: `تم استلام مبلغ ${tx.chargeAmount} ${tx.chargeCurrency} (${tx.baseAmount} MAD)`,
                fr: `Reçu ${tx.chargeAmount} ${tx.chargeCurrency} (${tx.baseAmount} MAD)`,
                en: `Received ${tx.chargeAmount} ${tx.chargeCurrency} (${tx.baseAmount} MAD)`,
              },
              linkUrl: `/admin/orders?order=${orderId}`,
              entityType: 'order',
              entityId: orderId,
            });

            void enqueueJob({
              name: 'send-meta-capi',
              tenantId: storeId,
              eventName: 'Purchase',
              eventId: `stripe_${event.id}`,
              email: updatedOrder.customerEmail,
              phone: updatedOrder.normalizedPhone,
              value: Number(updatedOrder.totalAmount),
              currency: 'MAD',
              orderNumber: updatedOrder.orderNumber,
            });
          }
        }
      } else if (event.type === 'checkout.session.expired' || event.type === 'payment_intent.payment_failed') {
        const obj = event.data.object as { metadata?: { orderId?: string } };
        const orderId = obj.metadata?.orderId;
        if (orderId) {
          await db
            .update(paymentTransactions)
            .set({ status: 'FAILED', failureReason: event.type, updatedAt: new Date() })
            .where(
              and(
                eq(paymentTransactions.storeId, storeId),
                eq(paymentTransactions.orderId, orderId),
                eq(paymentTransactions.gatewayCode, 'STRIPE')
              )
            );
          await db
            .update(orders)
            .set({ paymentStatus: 'FAILED', updatedAt: new Date() })
            .where(and(eq(orders.storeId, storeId), eq(orders.id, orderId)));

          await createTenantNotification(db, {
            storeId,
            type: 'PAYMENT_FAILED',
            titleI18n: {
              ar: 'فشل عملية دفع عبر Stripe',
              fr: 'Échec de paiement Stripe',
              en: 'Stripe Payment Failed',
            },
            messageI18n: {
              ar: `فشلت محاولة الدفع للطلب`,
              fr: `Échec du paiement pour la commande`,
              en: `Payment failed for order`,
            },
            linkUrl: `/admin/orders?order=${orderId}`,
            entityType: 'order',
            entityId: orderId,
          });
        }
      }

      await db.insert(webhookLogs).values({
        storeId,
        provider: 'STRIPE',
        eventId: event.id,
        eventType: event.type,
        signatureValid: true,
        payload: { id: event.id, type: event.type },
        processingStatus: 'PROCESSED',
      });

      return { valid: true };
    });

    if (!result.valid) {
      return NextResponse.json({ error: 'Invalid webhook signature' }, { status: 400 });
    }
    return NextResponse.json({ received: true });
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : 'Webhook error' },
      { status: 400 }
    );
  }
}

