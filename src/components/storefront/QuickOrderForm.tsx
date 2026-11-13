'use client';

import React, { useEffect, useMemo, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import { CheckCircle2, Loader2, Minus, Plus, ShieldCheck, Tag, Truck } from 'lucide-react';
import { useStore } from '@/components/providers/StoreContextProvider';
import { computeEffectivePrice } from '@/services/catalog/pricing';
import type { I18nMap, PaymentMethod } from '@/db/schema/types';

export interface QuickOrderProductInfo {
  id: string;
  productType: string;
  requiresShipping: boolean;
  titleI18n: I18nMap;
  regularPrice: string | number;
  salePrice: string | number | null;
  discountType: string | null;
  discountValue: string | number | null;
  promoStartsAt: string | Date | null;
  promoEndsAt: string | Date | null;
  shippingConfig?: { freeShipping?: boolean; extraShippingFee?: number };
}

export interface QuickOrderVariantInfo {
  id: string;
  titleI18n: I18nMap;
  regularPrice: string | number;
  salePrice: string | number | null;
}

export function QuickOrderForm({
  product,
  selectedVariant,
  quantity: controlledQty,
  onQuantityChange,
  checkoutType = 'QUICK_ORDER',
  landingPageId,
  showQuantityControl = true,
  anchorId = 'quick-order-form',
}: {
  product: QuickOrderProductInfo;
  selectedVariant?: QuickOrderVariantInfo | null;
  quantity?: number;
  onQuantityChange?: (qty: number) => void;
  checkoutType?: 'QUICK_ORDER' | 'LANDING_PAGE';
  landingPageId?: string;
  showQuantityControl?: boolean;
  anchorId?: string;
}) {
  const router = useRouter();
  const { ctx, locale, tr, pick, formatPrice, trackEvent } = useStore();

  const [internalQty, setInternalQty] = useState(1);
  const quantity = controlledQty ?? internalQty;
  const setQty = (q: number) => {
    const clamped = Math.max(1, Math.min(200, q));
    if (onQuantityChange) onQuantityChange(clamped);
    else setInternalQty(clamped);
  };

  const activeCities = useMemo(
    () => (ctx?.cities || []).filter((c) => c.isActive),
    [ctx?.cities]
  );

  const needsShipping =
    product.requiresShipping &&
    product.productType !== 'DIGITAL' &&
    product.productType !== 'SERVICE';

  const enabledGateways = useMemo(
    () =>
      (ctx?.paymentGateways || []).filter((g) => {
        if (!g.isEnabled) return false;
        if (g.gatewayCode === 'COD' && !needsShipping) return false;
        return true;
      }),
    [ctx?.paymentGateways, needsShipping]
  );

  const [customerName, setCustomerName] = useState('');
  const [phone, setPhone] = useState('');
  const [customerEmail, setCustomerEmail] = useState('');
  const [cityId, setCityId] = useState<string>('');
  const [shippingAddress, setShippingAddress] = useState('');
  const [customerNotes, setCustomerNotes] = useState('');
  const [customFields, setCustomFields] = useState<Record<string, unknown>>({});
  const [paymentMethod, setPaymentMethod] = useState<PaymentMethod>('COD');
  const [couponInput, setCouponInput] = useState('');
  const [appliedCoupon, setAppliedCoupon] = useState<{
    code: string;
    discountAmount: number;
    freeShipping: boolean;
  } | null>(null);
  const [couponMsg, setCouponMsg] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [formPostAction, setFormPostAction] = useState<{
    formUrl: string;
    formFields: Record<string, string>;
  } | null>(null);
  const postFormRef = useRef<HTMLFormElement | null>(null);

  useEffect(() => {
    if (activeCities.length > 0 && !cityId) {
      setCityId(activeCities[0].id);
    }
  }, [activeCities, cityId]);

  useEffect(() => {
    if (enabledGateways.length > 0) {
      const exists = enabledGateways.some((g) => g.gatewayCode === paymentMethod);
      if (!exists) {
        setPaymentMethod(enabledGateways[0].gatewayCode as PaymentMethod);
      }
    }
  }, [enabledGateways, paymentMethod]);

  useEffect(() => {
    if (formPostAction && postFormRef.current) {
      postFormRef.current.submit();
    }
  }, [formPostAction]);

  const checkoutConfig = ctx?.settings?.checkoutConfig;

  const priceCalc = selectedVariant
    ? computeEffectivePrice({
        regularPrice: selectedVariant.regularPrice,
        salePrice: selectedVariant.salePrice,
        promoStartsAt: product.promoStartsAt,
        promoEndsAt: product.promoEndsAt,
      })
    : computeEffectivePrice({
        regularPrice: product.regularPrice,
        salePrice: product.salePrice,
        discountType: product.discountType,
        discountValue: product.discountValue,
        promoStartsAt: product.promoStartsAt,
        promoEndsAt: product.promoEndsAt,
      });

  const subtotal = Number((priceCalc.effectivePrice * quantity).toFixed(2));
  const discountAmount = appliedCoupon?.discountAmount || 0;
  const subtotalAfterDiscount = Math.max(0, subtotal - discountAmount);

  const selectedCity = activeCities.find((c) => c.id === cityId);
  const freeThreshold = selectedCity?.freeShippingMinOrder
    ? Number(selectedCity.freeShippingMinOrder)
    : null;
  const isFreeShipping =
    !needsShipping ||
    Boolean(appliedCoupon?.freeShipping) ||
    Boolean(product.shippingConfig?.freeShipping) ||
    (freeThreshold !== null && subtotalAfterDiscount >= freeThreshold);

  const baseShippingFee = selectedCity ? Number(selectedCity.deliveryFee) : 35;
  const extraFee = Number(product.shippingConfig?.extraShippingFee || 0) * quantity;
  const shippingFee = isFreeShipping ? 0 : Number((baseShippingFee + extraFee).toFixed(2));
  const codFee =
    paymentMethod === 'COD' && selectedCity ? Number(selectedCity.codFee || 0) : 0;
  const grandTotal = Number((subtotalAfterDiscount + shippingFee + codFee).toFixed(2));

  async function handleValidateCoupon() {
    if (!couponInput.trim()) return;
    setCouponMsg(null);
    try {
      const res = await fetch('/api/storefront/coupons/validate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ code: couponInput.trim(), subtotal }),
      });
      const data = await res.json();
      if (!res.ok || !data.valid) {
        setAppliedCoupon(null);
        setCouponMsg(
          locale === 'ar'
            ? 'كود الخصم غير صالح أو لم يبلغ الحد الأدنى'
            : locale === 'fr'
              ? 'Code promo invalide ou montant insuffisant'
              : 'Invalid coupon or minimum not met'
        );
      } else {
        setAppliedCoupon({
          code: data.code,
          discountAmount: data.discountAmount,
          freeShipping: data.freeShipping,
        });
      }
    } catch {
      setCouponMsg('Error');
    }
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setErrorMsg(null);
    setSubmitting(true);

    try {
      const eventId = trackEvent('InitiateCheckout', {
        value: grandTotal,
        contentIds: [product.id],
      });

      const res = await fetch('/api/storefront/checkout', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          checkoutType,
          landingPageId: landingPageId || null,
          locale,
          customerName,
          customerEmail: customerEmail || null,
          phone,
          cityId: needsShipping ? cityId || null : null,
          cityName: needsShipping
            ? selectedCity
              ? pick(selectedCity.cityNameI18n)
              : undefined
            : 'Digital Delivery',
          shippingAddress: needsShipping
            ? shippingAddress
            : 'Digital / Online Delivery',
          customerNotes: customerNotes || null,
          customFields,
          couponCode: appliedCoupon?.code || null,
          paymentMethod,
          trackingEventId: eventId,
          items: [
            {
              productId: product.id,
              variantId: selectedVariant?.id || null,
              quantity,
            },
          ],
        }),
      });

      const data = await res.json();
      if (!res.ok) {
        setErrorMsg(data.error || 'Checkout failed');
        setSubmitting(false);
        return;
      }

      if (data.paymentAction?.actionType === 'REDIRECT' && data.paymentAction.redirectUrl) {
        window.location.href = data.paymentAction.redirectUrl;
        return;
      }

      if (
        data.paymentAction?.actionType === 'FORM_POST' &&
        data.paymentAction.formUrl &&
        data.paymentAction.formFields
      ) {
        setFormPostAction({
          formUrl: data.paymentAction.formUrl,
          formFields: data.paymentAction.formFields,
        });
        return;
      }

      router.push(`/thank-you/${encodeURIComponent(data.order.orderNumber)}`);
    } catch {
      setErrorMsg(
        locale === 'ar'
          ? 'حدث خطأ أثناء إرسال الطلب، يرجى المحاولة مرة أخرى'
          : 'An error occurred while placing your order.'
      );
      setSubmitting(false);
    }
  }

  return (
    <div
      id={anchorId}
      className="rounded-2xl border-2 border-emerald-900/15 bg-white p-4 sm:p-6 shadow-md"
    >
      <div className="mb-4 flex items-center justify-between gap-2 border-b border-stone-100 pb-3">
        <h3 className="text-base sm:text-lg font-extrabold text-stone-900">
          {tr('checkout.quickTitle')}
        </h3>
        <span className="inline-flex items-center gap-1 rounded-full bg-emerald-50 px-2.5 py-1 text-xs font-bold text-emerald-900">
          <ShieldCheck className="h-3.5 w-3.5" />
          100%
        </span>
      </div>

      <form onSubmit={handleSubmit} className="space-y-3.5">
        {showQuantityControl && (
          <div className="flex items-center justify-between rounded-xl border border-stone-200 bg-stone-50/70 px-3 py-2">
            <span className="text-sm font-semibold text-stone-800">
              {tr('product.quantity')}
            </span>
            <div className="inline-flex items-center rounded-xl border border-stone-200 bg-white">
              <button
                type="button"
                onClick={() => setQty(quantity - 1)}
                className="px-3 py-1.5 text-stone-700 hover:bg-stone-100"
              >
                <Minus className="h-4 w-4" />
              </button>
              <span className="min-w-8 text-center text-sm font-bold tabular-nums">
                {quantity}
              </span>
              <button
                type="button"
                onClick={() => setQty(quantity + 1)}
                className="px-3 py-1.5 text-stone-700 hover:bg-stone-100"
              >
                <Plus className="h-4 w-4" />
              </button>
            </div>
          </div>
        )}

        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          <div>
            <label className="mb-1 block text-xs font-semibold text-stone-700">
              {tr('checkout.fullName')} *
            </label>
            <input
              type="text"
              required
              minLength={2}
              value={customerName}
              onChange={(e) => setCustomerName(e.target.value)}
              placeholder={tr('checkout.fullName')}
              className="w-full rounded-xl border border-stone-300 bg-stone-50/40 px-3.5 py-2.5 text-sm focus:border-emerald-700 focus:bg-white focus:outline-none"
            />
          </div>

          <div>
            <label className="mb-1 block text-xs font-semibold text-stone-700">
              {tr('checkout.phone')} *
            </label>
            <input
              type="tel"
              required
              dir="ltr"
              value={phone}
              onChange={(e) => setPhone(e.target.value)}
              placeholder="0612345678"
              className="w-full rounded-xl border border-stone-300 bg-stone-50/40 px-3.5 py-2.5 text-sm text-start focus:border-emerald-700 focus:bg-white focus:outline-none"
            />
          </div>
        </div>

        {(checkoutConfig?.requireEmail || !needsShipping) && (
          <div>
            <label className="mb-1 block text-xs font-semibold text-stone-700">
              {tr('checkout.email')} {(!needsShipping || checkoutConfig?.requireEmail) && '*'}
            </label>
            <input
              type="email"
              required={Boolean(checkoutConfig?.requireEmail || !needsShipping)}
              value={customerEmail}
              onChange={(e) => setCustomerEmail(e.target.value)}
              placeholder="name@example.com"
              className="w-full rounded-xl border border-stone-300 bg-stone-50/40 px-3.5 py-2.5 text-sm focus:border-emerald-700 focus:bg-white focus:outline-none"
            />
          </div>
        )}

        {needsShipping && (
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <div>
              <label className="mb-1 block text-xs font-semibold text-stone-700">
                {tr('checkout.city')} {checkoutConfig?.requireCity !== false && '*'}
              </label>
              <select
                value={cityId}
                required={checkoutConfig?.requireCity !== false}
                onChange={(e) => setCityId(e.target.value)}
                className="w-full rounded-xl border border-stone-300 bg-stone-50/40 px-3.5 py-2.5 text-sm focus:border-emerald-700 focus:bg-white focus:outline-none"
              >
                <option value="">{tr('checkout.selectCity')}</option>
                {activeCities.map((city) => (
                  <option key={city.id} value={city.id}>
                    {pick(city.cityNameI18n)} — {formatPrice(city.deliveryFee)} (
                    {pick(city.estimatedDaysI18n)})
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="mb-1 block text-xs font-semibold text-stone-700">
                {tr('checkout.address')} {checkoutConfig?.requireAddress !== false && '*'}
              </label>
              <input
                type="text"
                required={checkoutConfig?.requireAddress !== false}
                minLength={2}
                value={shippingAddress}
                onChange={(e) => setShippingAddress(e.target.value)}
                placeholder={tr('checkout.address')}
                className="w-full rounded-xl border border-stone-300 bg-stone-50/40 px-3.5 py-2.5 text-sm focus:border-emerald-700 focus:bg-white focus:outline-none"
              />
            </div>
          </div>
        )}

        {/* Custom dynamic checkout fields configured from admin */}
        {(checkoutConfig?.customFields || [])
          .filter((f) => f.enabled)
          .map((field) => (
            <div key={field.id}>
              <label className="mb-1 block text-xs font-semibold text-stone-700">
                {pick(field.labelI18n)} {field.required && '*'}
              </label>
              {field.type === 'textarea' ? (
                <textarea
                  required={field.required}
                  rows={2}
                  value={String(customFields[field.key] || '')}
                  onChange={(e) =>
                    setCustomFields((prev) => ({ ...prev, [field.key]: e.target.value }))
                  }
                  className="w-full rounded-xl border border-stone-300 px-3.5 py-2 text-sm focus:border-emerald-700 focus:outline-none"
                />
              ) : field.type === 'select' ? (
                <select
                  required={field.required}
                  value={String(customFields[field.key] || '')}
                  onChange={(e) =>
                    setCustomFields((prev) => ({ ...prev, [field.key]: e.target.value }))
                  }
                  className="w-full rounded-xl border border-stone-300 px-3.5 py-2.5 text-sm focus:border-emerald-700 focus:outline-none"
                >
                  <option value="">--</option>
                  {(field.options || []).map((opt) => (
                    <option key={opt.value} value={opt.value}>
                      {pick(opt.labelI18n)}
                    </option>
                  ))}
                </select>
              ) : field.type === 'checkbox' ? (
                <label className="inline-flex items-center gap-2 text-sm text-stone-700">
                  <input
                    type="checkbox"
                    required={field.required}
                    checked={Boolean(customFields[field.key])}
                    onChange={(e) =>
                      setCustomFields((prev) => ({ ...prev, [field.key]: e.target.checked }))
                    }
                  />
                  <span>{pick(field.labelI18n)}</span>
                </label>
              ) : (
                <input
                  type="text"
                  required={field.required}
                  value={String(customFields[field.key] || '')}
                  onChange={(e) =>
                    setCustomFields((prev) => ({ ...prev, [field.key]: e.target.value }))
                  }
                  className="w-full rounded-xl border border-stone-300 px-3.5 py-2 text-sm focus:border-emerald-700 focus:outline-none"
                />
              )}
            </div>
          ))}

        {checkoutConfig?.requireNotes && (
          <div>
            <label className="mb-1 block text-xs font-semibold text-stone-700">
              {tr('checkout.notes')}
            </label>
            <input
              type="text"
              value={customerNotes}
              onChange={(e) => setCustomerNotes(e.target.value)}
              placeholder={tr('checkout.notes')}
              className="w-full rounded-xl border border-stone-300 bg-stone-50/40 px-3.5 py-2 text-sm focus:border-emerald-700 focus:outline-none"
            />
          </div>
        )}

        {/* Payment method selection */}
        {enabledGateways.length > 0 && (
          <div>
            <label className="mb-1.5 block text-xs font-semibold text-stone-700">
              {tr('checkout.paymentMethod')}
            </label>
            <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
              {enabledGateways.map((gw) => {
                const selected = paymentMethod === gw.gatewayCode;
                return (
                  <button
                    key={gw.gatewayCode}
                    type="button"
                    onClick={() => setPaymentMethod(gw.gatewayCode as PaymentMethod)}
                    className={`flex items-center justify-between rounded-xl border px-3 py-2.5 text-start text-xs font-bold transition-colors ${
                      selected
                        ? 'border-emerald-800 bg-emerald-50 text-emerald-950'
                        : 'border-stone-200 bg-white text-stone-700 hover:bg-stone-50'
                    }`}
                  >
                    <span>{pick(gw.displayNameI18n, gw.gatewayCode)}</span>
                    {selected && <CheckCircle2 className="h-4 w-4 text-emerald-700" />}
                  </button>
                );
              })}
            </div>
          </div>
        )}

        {/* Coupon box */}
        {appliedCoupon ? (
          <div className="flex items-center justify-between rounded-xl border border-emerald-200 bg-emerald-50 px-3 py-2 text-xs text-emerald-900">
            <span className="inline-flex items-center gap-1.5 font-bold">
              <Tag className="h-3.5 w-3.5" />
              {appliedCoupon.code}
            </span>
            <button
              type="button"
              onClick={() => {
                setAppliedCoupon(null);
                setCouponInput('');
              }}
              className="font-bold text-red-600"
            >
              ×
            </button>
          </div>
        ) : (
          <div className="flex gap-2">
            <input
              type="text"
              value={couponInput}
              onChange={(e) => setCouponInput(e.target.value)}
              placeholder={tr('checkout.couponPlaceholder')}
              className="flex-1 rounded-xl border border-stone-200 px-3 py-2 text-xs focus:border-emerald-700 focus:outline-none"
            />
            <button
              type="button"
              onClick={handleValidateCoupon}
              className="rounded-xl border border-stone-300 bg-stone-50 px-3 py-2 text-xs font-semibold text-stone-800 hover:bg-stone-100"
            >
              {tr('checkout.applyCoupon')}
            </button>
          </div>
        )}
        {couponMsg && <p className="text-xs text-red-600">{couponMsg}</p>}

        {/* Live totals summary */}
        <div className="space-y-1.5 rounded-xl bg-stone-50 p-3 text-xs sm:text-sm">
          <div className="flex justify-between text-stone-600">
            <span>{tr('checkout.subtotal')}</span>
            <span className="font-semibold tabular-nums">{formatPrice(subtotal)}</span>
          </div>
          {discountAmount > 0 && (
            <div className="flex justify-between text-emerald-700">
              <span>{tr('checkout.discount')}</span>
              <span className="font-semibold tabular-nums">
                -{formatPrice(discountAmount)}
              </span>
            </div>
          )}
          {needsShipping && (
            <div className="flex justify-between text-stone-600">
              <span className="inline-flex items-center gap-1">
                <Truck className="h-3.5 w-3.5" />
                {tr('checkout.shipping')}
              </span>
              <span className="font-semibold tabular-nums">
                {shippingFee === 0 ? tr('checkout.free') : formatPrice(shippingFee)}
              </span>
            </div>
          )}
          {codFee > 0 && (
            <div className="flex justify-between text-stone-600">
              <span>{tr('checkout.codFee')}</span>
              <span className="font-semibold tabular-nums">{formatPrice(codFee)}</span>
            </div>
          )}
          <div className="flex justify-between border-t border-stone-200 pt-2 text-base font-extrabold text-stone-900">
            <span>{tr('checkout.total')}</span>
            <span className="text-store-primary tabular-nums">
              {formatPrice(grandTotal)}
            </span>
          </div>
        </div>

        {errorMsg && (
          <div className="rounded-xl border border-red-200 bg-red-50 px-3 py-2 text-xs font-medium text-red-700">
            {errorMsg}
          </div>
        )}

        <button
          type="submit"
          disabled={submitting}
          className="btn-store-primary flex w-full items-center justify-center gap-2 py-3.5 text-sm sm:text-base font-extrabold shadow-md disabled:opacity-60"
        >
          {submitting ? (
            <>
              <Loader2 className="h-4 w-4 animate-spin" />
              <span>{tr('checkout.submitting')}</span>
            </>
          ) : (
            <span>
              {pick(checkoutConfig?.buttonTextI18n, tr('checkout.completeOrder'))} —{' '}
              {formatPrice(grandTotal)}
            </span>
          )}
        </button>
      </form>

      {formPostAction && (
        <form
          ref={postFormRef}
          method="POST"
          action={formPostAction.formUrl}
          className="hidden"
        >
          {Object.entries(formPostAction.formFields).map(([k, v]) => (
            <input key={k} type="hidden" name={k} value={v} />
          ))}
        </form>
      )}
    </div>
  );
}

