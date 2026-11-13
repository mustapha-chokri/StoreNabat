import Stripe from 'stripe';
import {
  convertBaseAmountForGateway,
  type CreateCheckoutSessionInput,
  type GatewayRefundResult,
  type PaymentCheckoutResult,
} from './types';

export async function createStripeCheckout(
  input: CreateCheckoutSessionInput
): Promise<PaymentCheckoutResult> {
  const secretKey = input.secrets.secretKey;
  if (!secretKey) {
    throw new Error('Stripe secretKey is not configured for this store.');
  }

  const conversion = convertBaseAmountForGateway(input.baseAmountMad, {
    targetCurrency: 'EUR',
    ...input.publicConfig,
  });

  const stripe = new Stripe(secretKey);
  const unitAmountCents = Math.round(conversion.chargeAmount * 100);

  const session = await stripe.checkout.sessions.create(
    {
      mode: 'payment',
      customer_email: input.customerEmail || undefined,
      client_reference_id: input.orderId,
      line_items: [
        {
          price_data: {
            currency: conversion.chargeCurrency.toLowerCase(),
            product_data: {
              name: `Order #${input.orderNumber}`,
              description: `Base total: ${conversion.baseAmount.toFixed(2)} MAD (Rate: ${conversion.exchangeRateUsed})`,
            },
            unit_amount: unitAmountCents,
          },
          quantity: 1,
        },
      ],
      metadata: {
        storeId: input.storeId,
        orderId: input.orderId,
        orderNumber: input.orderNumber,
        baseAmountMad: String(conversion.baseAmount),
        exchangeRateUsed: String(conversion.exchangeRateUsed),
      },
      success_url: input.successUrl,
      cancel_url: input.cancelUrl,
    },
    { idempotencyKey: input.idempotencyKey }
  );

  return {
    gatewayCode: 'STRIPE',
    actionType: 'REDIRECT',
    redirectUrl: session.url || input.successUrl,
    externalTransactionId: session.id,
    conversion,
    rawResponse: { sessionId: session.id, paymentIntent: session.payment_intent },
  };
}

export function verifyStripeWebhookSignature(params: {
  rawBody: string;
  signatureHeader: string;
  webhookSecret: string;
  secretKey: string;
}): Stripe.Event {
  const stripe = new Stripe(params.secretKey);
  return stripe.webhooks.constructEvent(
    params.rawBody,
    params.signatureHeader,
    params.webhookSecret
  );
}

export async function refundStripePayment(params: {
  secretKey: string;
  paymentIntentId: string;
  amountCents?: number;
}): Promise<GatewayRefundResult> {
  try {
    const stripe = new Stripe(params.secretKey);
    const refund = await stripe.refunds.create({
      payment_intent: params.paymentIntentId,
      amount: params.amountCents,
    });
    return { success: true, refundId: refund.id };
  } catch (err) {
    return {
      success: false,
      error: err instanceof Error ? err.message : 'Stripe refund failed',
    };
  }
}

