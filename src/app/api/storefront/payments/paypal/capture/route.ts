import { NextRequest, NextResponse } from 'next/server';
import { and, eq } from 'drizzle-orm';
import { orders, paymentGatewayConfigs, paymentTransactions } from '@/db/schema/tenant';
import { getRequestTenant, withTenantDb } from '@/core/tenancy/context';
import { decryptJsonSecret } from '@/core/crypto';
import { capturePayPalOrder } from '@/services/payments/paypal';
import { updateOrderStatus } from '@/services/orders';
import { createTenantNotification } from '@/services/notifications';
import { assertSameOrigin } from '@/core/http/api';

/**
 * Captures an approved PayPal order when the customer returns from PayPal Checkout
 * onto the Thank You page, ensuring instant confirmation even if webhooks lag in dev.
 */
export async function POST(req: NextRequest) {
  const csrfErr = assertSameOrigin(req);
  if (csrfErr) return csrfErr;

  try {
    const { paypalOrderId, orderNumber } = (await req.json()) as {
      paypalOrderId?: string;
      orderNumber?: string;
    };

    if (!paypalOrderId || !orderNumber) {
      return NextResponse.json({ error: 'Missing paypalOrderId or orderNumber' }, { status: 400 });
    }

    const tenant = await getRequestTenant();
    const res = await withTenantDb(tenant, async (db) => {
      const [order] = await db
        .select()
        .from(orders)
        .where(and(eq(orders.storeId, tenant.id), eq(orders.orderNumber, orderNumber)))
        .limit(1);

      if (!order) return { captured: false, error: 'Order not found' };
      if (order.paymentStatus === 'PAID') return { captured: true, alreadyPaid: true };

      const [cfg] = await db
        .select()
        .from(paymentGatewayConfigs)
        .where(
          and(
            eq(paymentGatewayConfigs.storeId, tenant.id),
            eq(paymentGatewayConfigs.gatewayCode, 'PAYPAL')
          )
        )
        .limit(1);

      const secrets = decryptJsonSecret<Record<string, string>>(cfg?.encryptedSecrets) || {};
      const clientId = String(cfg?.publicConfig?.clientId || '');
      const mode: 'TEST' | 'LIVE' = cfg?.mode === 'LIVE' ? 'LIVE' : 'TEST';

      if (!clientId || !secrets.clientSecret) {
        return { captured: false, error: 'PayPal credentials unavailable' };
      }

      const capture = await capturePayPalOrder({
        clientId,
        clientSecret: secrets.clientSecret,
        mode,
        paypalOrderId,
      });

      if (capture.captured) {
        await db
          .update(paymentTransactions)
          .set({
            status: 'SUCCEEDED',
            rawResponse: { ...capture.raw, captureId: capture.captureId },
            updatedAt: new Date(),
          })
          .where(
            and(
              eq(paymentTransactions.storeId, tenant.id),
              eq(paymentTransactions.orderId, order.id),
              eq(paymentTransactions.gatewayCode, 'PAYPAL')
            )
          );

        await updateOrderStatus(db, {
          storeId: tenant.id,
          orderId: order.id,
          newStatus: 'CONFIRMED',
          paymentStatus: 'PAID',
          note: 'PayPal capture completed upon customer return',
          actorEmail: 'paypal-capture',
        });

        await createTenantNotification(db, {
          storeId: tenant.id,
          type: 'PAYMENT_CONFIRMED',
          titleI18n: {
            ar: `دفع PayPal مكتمل #${order.orderNumber}`,
            fr: `Paiement PayPal complété #${order.orderNumber}`,
            en: `PayPal Capture Completed #${order.orderNumber}`,
          },
          messageI18n: {
            ar: `تم تأكيد الدفع للطلب #${order.orderNumber}`,
            fr: `Paiement confirmé pour #${order.orderNumber}`,
            en: `Payment confirmed for #${order.orderNumber}`,
          },
          linkUrl: `/admin/orders?order=${order.id}`,
          entityType: 'order',
          entityId: order.id,
        });
      }

      return capture;
    });

    return NextResponse.json(res);
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : 'Capture failed' },
      { status: 500 }
    );
  }
}

