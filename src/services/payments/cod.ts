import type { CreateCheckoutSessionInput, PaymentCheckoutResult } from './types';

export async function createCodCheckout(
  input: CreateCheckoutSessionInput
): Promise<PaymentCheckoutResult> {
  return {
    gatewayCode: 'COD',
    actionType: 'COMPLETE',
    externalTransactionId: `COD-${input.orderNumber}`,
    conversion: {
      baseCurrency: 'MAD',
      baseAmount: Number(input.baseAmountMad.toFixed(2)),
      chargeCurrency: 'MAD',
      chargeAmount: Number(input.baseAmountMad.toFixed(2)),
      exchangeRateUsed: 1,
    },
    rawResponse: { method: 'COD', status: 'PENDING_DELIVERY_PAYMENT' },
  };
}

