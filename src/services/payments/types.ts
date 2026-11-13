import type { PaymentMethod } from '@/db/schema/types';

export interface CurrencyConversionResult {
  baseCurrency: string;
  baseAmount: number;
  chargeCurrency: string;
  chargeAmount: number;
  exchangeRateUsed: number;
}

export function convertBaseAmountForGateway(
  baseAmountMad: number,
  publicConfig: Record<string, unknown>
): CurrencyConversionResult {
  const targetCurrency =
    typeof publicConfig.targetCurrency === 'string' && publicConfig.targetCurrency
      ? publicConfig.targetCurrency.toUpperCase()
      : 'MAD';

  if (targetCurrency === 'MAD') {
    return {
      baseCurrency: 'MAD',
      baseAmount: Number(baseAmountMad.toFixed(2)),
      chargeCurrency: 'MAD',
      chargeAmount: Number(baseAmountMad.toFixed(2)),
      exchangeRateUsed: 1,
    };
  }

  const rawRate = Number(publicConfig.exchangeRate || 0);
  const defaultRate = targetCurrency === 'EUR' ? 0.092 : targetCurrency === 'USD' ? 0.1 : 1;
  const rate = rawRate > 0 ? rawRate : defaultRate;
  const converted = Number((baseAmountMad * rate).toFixed(2));

  return {
    baseCurrency: 'MAD',
    baseAmount: Number(baseAmountMad.toFixed(2)),
    chargeCurrency: targetCurrency,
    chargeAmount: Math.max(0.5, converted),
    exchangeRateUsed: rate,
  };
}

export interface CreateCheckoutSessionInput {
  storeId: string;
  orderId: string;
  orderNumber: string;
  customerEmail?: string | null;
  customerName: string;
  phone: string;
  baseAmountMad: number;
  locale: string;
  successUrl: string;
  cancelUrl: string;
  webhookUrl: string;
  publicConfig: Record<string, unknown>;
  secrets: Record<string, string>;
  mode: 'TEST' | 'LIVE';
  idempotencyKey: string;
}

export interface PaymentCheckoutResult {
  gatewayCode: PaymentMethod;
  actionType: 'COMPLETE' | 'REDIRECT' | 'FORM_POST';
  redirectUrl?: string;
  formUrl?: string;
  formFields?: Record<string, string>;
  externalTransactionId?: string;
  conversion: CurrencyConversionResult;
  rawResponse?: Record<string, unknown>;
}

export interface GatewayRefundResult {
  success: boolean;
  refundId?: string;
  error?: string;
}

