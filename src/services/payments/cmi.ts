import crypto from 'node:crypto';
import type { CreateCheckoutSessionInput, PaymentCheckoutResult } from './types';

/**
 * Computes CMI / HPS standard Base64(SHA-512(...)) signature over sorted parameters
 * concatenated with the merchant Store Key.
 */
export function computeCmiHash(
  fields: Record<string, string>,
  storeKey: string
): string {
  const keys = Object.keys(fields)
    .filter((k) => k.toLowerCase() !== 'hash' && k.toLowerCase() !== 'encoding')
    .sort((a, b) => a.toLowerCase().localeCompare(b.toLowerCase()));

  const escaped = keys.map((k) => {
    const val = String(fields[k] ?? '')
      .replace(/\\/g, '\\\\')
      .replace(/\|/g, '\\|');
    return val;
  });

  const escapedKey = storeKey.replace(/\\/g, '\\\\').replace(/\|/g, '\\|');
  const hashInput = `${escaped.join('|')}|${escapedKey}`;
  return crypto.createHash('sha512').update(hashInput, 'utf8').digest('base64');
}

/**
 * Modular Moroccan CMI / Bank Card Gateway Adapter.
 * Generates signed hosted checkout parameters once merchant credentials
 * (merchantId, storeKey, gatewayUrl) are configured in Admin Dashboard.
 */
export async function createCmiCheckout(
  input: CreateCheckoutSessionInput
): Promise<PaymentCheckoutResult> {
  const merchantId = String(input.publicConfig.merchantId || '');
  const gatewayUrl = String(input.publicConfig.gatewayUrl || '');
  const storeKey = input.secrets.storeKey || '';

  if (!merchantId || !gatewayUrl || !storeKey) {
    throw new Error(
      'CMI merchant credentials (merchantId, gatewayUrl, storeKey) must be configured in Dashboard before enabling Moroccan card payments.'
    );
  }

  const amountStr = input.baseAmountMad.toFixed(2);
  const lang = input.locale === 'ar' ? 'ar' : input.locale === 'en' ? 'en' : 'fr';

  const fields: Record<string, string> = {
    clientid: merchantId,
    amount: amountStr,
    okUrl: input.successUrl,
    failUrl: input.cancelUrl,
    TranType: 'PreAuth',
    callbackUrl: input.webhookUrl,
    shopurl: input.cancelUrl,
    currency: '504', // ISO 4217 numeric code for MAD
    rnd: input.idempotencyKey.slice(0, 20),
    storetype: '3D_PAY_HOSTING',
    hashAlgorithm: 'ver3',
    lang,
    oid: input.orderNumber,
    BillToName: input.customerName,
    tel: input.phone,
    email: input.customerEmail || 'customer@example.com',
    encoding: 'UTF-8',
  };

  fields.HASH = computeCmiHash(fields, storeKey);

  return {
    gatewayCode: 'CMI',
    actionType: 'FORM_POST',
    formUrl: gatewayUrl,
    formFields: fields,
    externalTransactionId: `CMI-${input.orderNumber}`,
    conversion: {
      baseCurrency: 'MAD',
      baseAmount: Number(amountStr),
      chargeCurrency: 'MAD',
      chargeAmount: Number(amountStr),
      exchangeRateUsed: 1,
    },
    rawResponse: { oid: input.orderNumber, mode: input.mode },
  };
}

export function verifyCmiCallbackHash(
  payload: Record<string, string>,
  storeKey: string
): boolean {
  const receivedHash = payload.HASH || payload.hash;
  if (!receivedHash || !storeKey) return false;
  const expected = computeCmiHash(payload, storeKey);
  const a = Buffer.from(receivedHash);
  const b = Buffer.from(expected);
  if (a.length !== b.length) return false;
  return crypto.timingSafeEqual(a, b);
}

