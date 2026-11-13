import { describe, expect, it } from 'vitest';
import { computeEffectivePrice } from '@/services/catalog/pricing';
import { convertBaseAmountForGateway } from '@/services/payments/types';
import { createCodCheckout } from '@/services/payments/cod';
import { createCmiCheckout, verifyCmiCallbackHash } from '@/services/payments/cmi';

describe('computeEffectivePrice & Promo Windows', () => {
  it('returns regular price when no discount is configured', () => {
    const res = computeEffectivePrice({ regularPrice: '250.00' });
    expect(res).toEqual({
      regularPrice: 250,
      effectivePrice: 250,
      hasActiveDiscount: false,
      discountPercent: 0,
      promoEndsAt: null,
    });
  });

  it('computes explicit salePrice, PERCENT, and FIXED discounts accurately', () => {
    const saleRes = computeEffectivePrice({
      regularPrice: 300,
      salePrice: 210,
    });
    expect(saleRes.effectivePrice).toBe(210);
    expect(saleRes.hasActiveDiscount).toBe(true);
    expect(saleRes.discountPercent).toBe(30);

    const pctRes = computeEffectivePrice({
      regularPrice: 200,
      discountType: 'PERCENT',
      discountValue: 25,
    });
    expect(pctRes.effectivePrice).toBe(150);
    expect(pctRes.discountPercent).toBe(25);

    const fixedRes = computeEffectivePrice({
      regularPrice: 120,
      discountType: 'FIXED',
      discountValue: 150, // capped at 0
    });
    expect(fixedRes.effectivePrice).toBe(0);
    expect(fixedRes.hasActiveDiscount).toBe(true);
    expect(fixedRes.discountPercent).toBe(100);
  });

  it('enforces promoStartsAt and promoEndsAt time boundaries', () => {
    const now = new Date('2026-06-15T12:00:00Z');

    const expired = computeEffectivePrice(
      {
        regularPrice: 400,
        salePrice: 250,
        promoEndsAt: '2026-06-10T00:00:00Z',
      },
      now
    );
    expect(expired.effectivePrice).toBe(400);
    expect(expired.hasActiveDiscount).toBe(false);
    expect(expired.promoEndsAt).toBeNull();

    const notStarted = computeEffectivePrice(
      {
        regularPrice: 400,
        salePrice: 250,
        promoStartsAt: '2026-06-20T00:00:00Z',
        promoEndsAt: '2026-06-30T00:00:00Z',
      },
      now
    );
    expect(notStarted.effectivePrice).toBe(400);
    expect(notStarted.hasActiveDiscount).toBe(false);

    const active = computeEffectivePrice(
      {
        regularPrice: 400,
        salePrice: 300,
        promoStartsAt: '2026-06-01T00:00:00Z',
        promoEndsAt: '2026-06-30T00:00:00Z',
      },
      now
    );
    expect(active.effectivePrice).toBe(300);
    expect(active.hasActiveDiscount).toBe(true);
    expect(active.promoEndsAt?.toISOString()).toBe('2026-06-30T00:00:00.000Z');
  });
});

describe('Gateway Currency Conversion & Adapters', () => {
  it('keeps MAD unchanged and converts MAD -> EUR/USD cleanly', () => {
    const mad = convertBaseAmountForGateway(350, { targetCurrency: 'MAD' });
    expect(mad).toEqual({
      baseCurrency: 'MAD',
      baseAmount: 350,
      chargeCurrency: 'MAD',
      chargeAmount: 350,
      exchangeRateUsed: 1,
    });

    const eur = convertBaseAmountForGateway(500, {
      targetCurrency: 'eur',
      exchangeRate: 0.095,
    });
    expect(eur).toEqual({
      baseCurrency: 'MAD',
      baseAmount: 500,
      chargeCurrency: 'EUR',
      chargeAmount: 47.5,
      exchangeRateUsed: 0.095,
    });

    const minFloor = convertBaseAmountForGateway(1, {
      targetCurrency: 'USD',
      exchangeRate: 0.1,
    });
    expect(minFloor.chargeAmount).toBe(0.5);
  });

  it('generates COMPLETE COD checkout result in MAD', async () => {
    const cod = await createCodCheckout({
      storeId: 'store-1',
      orderId: 'order-1',
      orderNumber: 'NA-2026-0001',
      customerName: 'Salma',
      phone: '212612345678',
      baseAmountMad: 299.5,
      locale: 'ar',
      successUrl: 'http://localhost:3000/thank-you/NA-2026-0001',
      cancelUrl: 'http://localhost:3000/checkout',
      webhookUrl: 'http://localhost:3000/api/webhooks/cod/store-1',
      publicConfig: {},
      secrets: {},
      mode: 'LIVE',
      idempotencyKey: 'idem-cod-1',
    });

    expect(cod.actionType).toBe('COMPLETE');
    expect(cod.externalTransactionId).toBe('COD-NA-2026-0001');
    expect(cod.conversion.chargeCurrency).toBe('MAD');
    expect(cod.conversion.chargeAmount).toBe(299.5);
  });

  it('requires merchant credentials for CMI and produces valid signed FORM_POST payload', async () => {
    const baseInput = {
      storeId: 'store-1',
      orderId: 'order-2',
      orderNumber: 'NA-2026-0002',
      customerName: 'Youssef',
      customerEmail: 'youssef@example.com',
      phone: '212612345678',
      baseAmountMad: 450,
      locale: 'fr',
      successUrl: 'https://nabatalatlas.ma/thank-you/NA-2026-0002',
      cancelUrl: 'https://nabatalatlas.ma/checkout',
      webhookUrl: 'https://nabatalatlas.ma/api/webhooks/cmi/store-1',
      publicConfig: {},
      secrets: {},
      mode: 'TEST' as const,
      idempotencyKey: '1234567890abcdefghij',
    };

    await expect(createCmiCheckout(baseInput)).rejects.toThrow(/CMI merchant credentials/);

    const cmiResult = await createCmiCheckout({
      ...baseInput,
      publicConfig: {
        merchantId: '700000123',
        gatewayUrl: 'https://payment.cmi.co.ma/fim/est3Dgate',
      },
      secrets: {
        storeKey: 'SuperSecretStoreKey123!',
      },
    });

    expect(cmiResult.actionType).toBe('FORM_POST');
    expect(cmiResult.formFields?.currency).toBe('504');
    expect(cmiResult.formFields?.amount).toBe('450.00');
    expect(
      verifyCmiCallbackHash(cmiResult.formFields!, 'SuperSecretStoreKey123!')
    ).toBe(true);
  });
});

