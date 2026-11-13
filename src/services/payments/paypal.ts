import {
  convertBaseAmountForGateway,
  type CreateCheckoutSessionInput,
  type GatewayRefundResult,
  type PaymentCheckoutResult,
} from './types';

function getPayPalApiBase(mode: 'TEST' | 'LIVE'): string {
  return mode === 'LIVE'
    ? 'https://api-m.paypal.com'
    : 'https://api-m.sandbox.paypal.com';
}

async function getPayPalAccessToken(
  clientId: string,
  clientSecret: string,
  mode: 'TEST' | 'LIVE'
): Promise<string> {
  const base = getPayPalApiBase(mode);
  const auth = Buffer.from(`${clientId}:${clientSecret}`).toString('base64');
  const res = await fetch(`${base}/v1/oauth2/token`, {
    method: 'POST',
    headers: {
      Authorization: `Basic ${auth}`,
      'Content-Type': 'application/x-www-form-urlencoded',
    },
    body: 'grant_type=client_credentials',
  });
  const json = (await res.json()) as { access_token?: string; error_description?: string };
  if (!res.ok || !json.access_token) {
    throw new Error(json.error_description || 'Failed to obtain PayPal OAuth access token.');
  }
  return json.access_token;
}

export async function createPayPalCheckout(
  input: CreateCheckoutSessionInput
): Promise<PaymentCheckoutResult> {
  const clientId = String(input.publicConfig.clientId || '');
  const clientSecret = input.secrets.clientSecret;
  if (!clientId || !clientSecret) {
    throw new Error('PayPal clientId / clientSecret is not configured for this store.');
  }

  // PayPal does not support MAD directly in Checkout; convert to USD or EUR
  const conversion = convertBaseAmountForGateway(input.baseAmountMad, {
    targetCurrency: 'USD',
    ...input.publicConfig,
    ...(input.publicConfig.targetCurrency === 'MAD' ? { targetCurrency: 'USD' } : {}),
  });

  const accessToken = await getPayPalAccessToken(clientId, clientSecret, input.mode);
  const base = getPayPalApiBase(input.mode);

  const res = await fetch(`${base}/v2/checkout/orders`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${accessToken}`,
      'Content-Type': 'application/json',
      'PayPal-Request-Id': input.idempotencyKey,
    },
    body: JSON.stringify({
      intent: 'CAPTURE',
      purchase_units: [
        {
          reference_id: input.orderId,
          custom_id: `${input.storeId}:${input.orderId}`,
          description: `Order #${input.orderNumber} (${conversion.baseAmount.toFixed(2)} MAD)`,
          amount: {
            currency_code: conversion.chargeCurrency,
            value: conversion.chargeAmount.toFixed(2),
          },
        },
      ],
      application_context: {
        return_url: input.successUrl,
        cancel_url: input.cancelUrl,
        user_action: 'PAY_NOW',
      },
    }),
  });

  const json = (await res.json()) as {
    id?: string;
    links?: Array<{ rel: string; href: string }>;
    message?: string;
  };
  if (!res.ok || !json.id) {
    throw new Error(json.message || 'PayPal order creation failed.');
  }

  const approveLink = json.links?.find((l) => l.rel === 'approve')?.href;
  return {
    gatewayCode: 'PAYPAL',
    actionType: 'REDIRECT',
    redirectUrl: approveLink || input.successUrl,
    externalTransactionId: json.id,
    conversion,
    rawResponse: json as unknown as Record<string, unknown>,
  };
}

export async function capturePayPalOrder(params: {
  clientId: string;
  clientSecret: string;
  mode: 'TEST' | 'LIVE';
  paypalOrderId: string;
}): Promise<{ captured: boolean; captureId?: string; raw: Record<string, unknown> }> {
  const token = await getPayPalAccessToken(params.clientId, params.clientSecret, params.mode);
  const base = getPayPalApiBase(params.mode);
  const res = await fetch(`${base}/v2/checkout/orders/${params.paypalOrderId}/capture`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json',
    },
  });
  const json = (await res.json()) as {
    status?: string;
    purchase_units?: Array<{ payments?: { captures?: Array<{ id: string }> } }>;
  };
  const captureId = json.purchase_units?.[0]?.payments?.captures?.[0]?.id;
  return {
    captured: res.ok && json.status === 'COMPLETED',
    captureId,
    raw: json as unknown as Record<string, unknown>,
  };
}

export async function verifyPayPalWebhookSignature(params: {
  clientId: string;
  clientSecret: string;
  webhookId: string;
  mode: 'TEST' | 'LIVE';
  headers: Headers;
  rawBody: Record<string, unknown>;
}): Promise<boolean> {
  const token = await getPayPalAccessToken(params.clientId, params.clientSecret, params.mode);
  const base = getPayPalApiBase(params.mode);

  const res = await fetch(`${base}/v1/notifications/verify-webhook-signature`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      auth_algo: params.headers.get('paypal-auth-algo'),
      cert_url: params.headers.get('paypal-cert-url'),
      transmission_id: params.headers.get('paypal-transmission-id'),
      transmission_sig: params.headers.get('paypal-transmission-sig'),
      transmission_time: params.headers.get('paypal-transmission-time'),
      webhook_id: params.webhookId,
      webhook_event: params.rawBody,
    }),
  });
  const json = (await res.json()) as { verification_status?: string };
  return res.ok && json.verification_status === 'SUCCESS';
}

export async function refundPayPalCapture(params: {
  clientId: string;
  clientSecret: string;
  mode: 'TEST' | 'LIVE';
  captureId: string;
}): Promise<GatewayRefundResult> {
  try {
    const token = await getPayPalAccessToken(params.clientId, params.clientSecret, params.mode);
    const base = getPayPalApiBase(params.mode);
    const res = await fetch(`${base}/v2/payments/captures/${params.captureId}/refund`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${token}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({}),
    });
    const json = (await res.json()) as { id?: string; message?: string };
    if (!res.ok || !json.id) {
      return { success: false, error: json.message || `HTTP ${res.status}` };
    }
    return { success: true, refundId: json.id };
  } catch (err) {
    return { success: false, error: err instanceof Error ? err.message : 'PayPal refund error' };
  }
}

