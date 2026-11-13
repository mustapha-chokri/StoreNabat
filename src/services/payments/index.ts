import crypto from 'node:crypto';
import { and, eq } from 'drizzle-orm';
import { paymentGatewayConfigs, paymentTransactions } from '@/db/schema/tenant';
import type { TenantDb } from '@/db/pools';
import { decryptJsonSecret } from '@/core/crypto';
import type { PaymentMethod } from '@/db/schema/types';
import { getEnv } from '@/core/env';
import { createCodCheckout } from './cod';
import { createStripeCheckout, refundStripePayment } from './stripe';
import { createPayPalCheckout, refundPayPalCapture } from './paypal';
import { createCmiCheckout } from './cmi';
import type { GatewayRefundResult, PaymentCheckoutResult } from './types';

export * from './types';
export * from './stripe';
export * from './paypal';
export * from './cmi';

export async function initiateOrderPayment(
  db: TenantDb,
  params: {
    storeId: string;
    orderId: string;
    orderNumber: string;
    gatewayCode: PaymentMethod;
    baseAmountMad: number;
    customerName: string;
    customerEmail?: string | null;
    phone: string;
    locale: string;
    baseUrl?: string;
  }
): Promise<PaymentCheckoutResult> {
  const rows = await db
    .select()
    .from(paymentGatewayConfigs)
    .where(
      and(
        eq(paymentGatewayConfigs.storeId, params.storeId),
        eq(paymentGatewayConfigs.gatewayCode, params.gatewayCode)
      )
    )
    .limit(1);

  const cfg = rows[0];
  if (!cfg || !cfg.isEnabled) {
    throw new Error(`Payment method ${params.gatewayCode} is not enabled for this store.`);
  }

  const secrets =
    decryptJsonSecret<Record<string, string>>(cfg.encryptedSecrets) || {};
  const publicConfig = cfg.publicConfig || {};
  const mode: 'TEST' | 'LIVE' = cfg.mode === 'LIVE' ? 'LIVE' : 'TEST';
  const appBaseUrl = (params.baseUrl || getEnv().appUrl).replace(/\/$/, '');
  const idempotencyKey = crypto
    .createHash('sha256')
    .update(`${params.storeId}:${params.orderId}:${params.gatewayCode}`)
    .digest('hex')
    .slice(0, 48);

  const input = {
    storeId: params.storeId,
    orderId: params.orderId,
    orderNumber: params.orderNumber,
    customerEmail: params.customerEmail,
    customerName: params.customerName,
    phone: params.phone,
    baseAmountMad: params.baseAmountMad,
    locale: params.locale,
    successUrl: `${appBaseUrl}/thank-you/${params.orderNumber}?payment=success&gateway=${params.gatewayCode}`,
    cancelUrl: `${appBaseUrl}/thank-you/${params.orderNumber}?payment=cancelled&gateway=${params.gatewayCode}`,
    webhookUrl: `${appBaseUrl}/api/webhooks/${params.gatewayCode.toLowerCase()}/${params.storeId}`,
    publicConfig,
    secrets,
    mode,
    idempotencyKey,
  };

  let result: PaymentCheckoutResult;
  switch (params.gatewayCode) {
    case 'COD':
      result = await createCodCheckout(input);
      break;
    case 'STRIPE':
      result = await createStripeCheckout(input);
      break;
    case 'PAYPAL':
      result = await createPayPalCheckout(input);
      break;
    case 'CMI':
      result = await createCmiCheckout(input);
      break;
    default:
      throw new Error(`Unsupported payment gateway: ${params.gatewayCode}`);
  }

  await db
    .insert(paymentTransactions)
    .values({
      storeId: params.storeId,
      orderId: params.orderId,
      gatewayCode: params.gatewayCode,
      externalTransactionId: result.externalTransactionId || null,
      idempotencyKey,
      status: params.gatewayCode === 'COD' ? 'PENDING' : 'INITIATED',
      baseCurrency: result.conversion.baseCurrency,
      baseAmount: result.conversion.baseAmount.toFixed(2),
      chargeCurrency: result.conversion.chargeCurrency,
      chargeAmount: result.conversion.chargeAmount.toFixed(2),
      exchangeRateUsed: result.conversion.exchangeRateUsed.toFixed(6),
      rawResponse: result.rawResponse || {},
    })
    .onConflictDoNothing();

  return result;
}

export async function refundGatewayTransaction(
  db: TenantDb,
  params: {
    storeId: string;
    orderId: string;
  }
): Promise<GatewayRefundResult> {
  const txRows = await db
    .select()
    .from(paymentTransactions)
    .where(
      and(
        eq(paymentTransactions.storeId, params.storeId),
        eq(paymentTransactions.orderId, params.orderId),
        eq(paymentTransactions.status, 'SUCCEEDED')
      )
    )
    .limit(1);

  if (txRows.length === 0) {
    return { success: false, error: 'No succeeded online transaction found to refund.' };
  }

  const tx = txRows[0];
  if (tx.gatewayCode === 'COD') {
    await db
      .update(paymentTransactions)
      .set({ status: 'REFUNDED', updatedAt: new Date() })
      .where(and(eq(paymentTransactions.storeId, params.storeId), eq(paymentTransactions.id, tx.id)));
    return { success: true, refundId: `COD-REFUND-${tx.id}` };
  }

  const cfgRows = await db
    .select()
    .from(paymentGatewayConfigs)
    .where(
      and(
        eq(paymentGatewayConfigs.storeId, params.storeId),
        eq(paymentGatewayConfigs.gatewayCode, tx.gatewayCode)
      )
    )
    .limit(1);

  if (cfgRows.length === 0) {
    return { success: false, error: 'Gateway config missing.' };
  }
  const cfg = cfgRows[0];
  const secrets = decryptJsonSecret<Record<string, string>>(cfg.encryptedSecrets) || {};
  const mode: 'TEST' | 'LIVE' = cfg.mode === 'LIVE' ? 'LIVE' : 'TEST';

  if (tx.gatewayCode === 'STRIPE') {
    const pi = String(tx.rawResponse?.paymentIntent || '');
    if (!pi || !secrets.secretKey) {
      return { success: false, error: 'Stripe paymentIntent or secretKey unavailable.' };
    }
    const res = await refundStripePayment({ secretKey: secrets.secretKey, paymentIntentId: pi });
    if (res.success) {
      await db
        .update(paymentTransactions)
        .set({ status: 'REFUNDED', updatedAt: new Date() })
        .where(and(eq(paymentTransactions.storeId, params.storeId), eq(paymentTransactions.id, tx.id)));
    }
    return res;
  }

  if (tx.gatewayCode === 'PAYPAL') {
    const captureId = String(tx.rawResponse?.captureId || '');
    const clientId = String(cfg.publicConfig?.clientId || '');
    if (!captureId || !clientId || !secrets.clientSecret) {
      return { success: false, error: 'PayPal captureId or credentials unavailable.' };
    }
    const res = await refundPayPalCapture({
      clientId,
      clientSecret: secrets.clientSecret,
      mode,
      captureId,
    });
    if (res.success) {
      await db
        .update(paymentTransactions)
        .set({ status: 'REFUNDED', updatedAt: new Date() })
        .where(and(eq(paymentTransactions.storeId, params.storeId), eq(paymentTransactions.id, tx.id)));
    }
    return res;
  }

  return {
    success: false,
    error: `Automated refund is not supported by ${tx.gatewayCode}; process manually via bank portal.`,
  };
}
