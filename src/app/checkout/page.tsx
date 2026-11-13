'use client';

import React, { useEffect, useMemo, useRef, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import {
  CheckCircle2,
  Loader2,
  ShieldCheck,
  ShoppingBag,
  Tag,
  Truck,
} from 'lucide-react';
import { useStore } from '@/components/providers/StoreContextProvider';
import { StorefrontShell } from '@/components/storefront/StorefrontShell';
import type { PaymentMethod } from '@/db/schema/types';

export default function CheckoutPage() {
  const router = useRouter();
  const {
    ctx,
    locale,
    tr,
    pick,
    formatPrice,
    cart,
    applyCoupon,
    refreshCart,
    trackEvent,
  } = useStore();

  const activeCities = useMemo(
    () => (ctx?.cities || []).filter((c) => c.isActive),
    [ctx?.cities]
  );

  const needsShipping = cart.items.some(
    (item) =>
      item.requiresShipping &&
      item.productType !== 'DIGITAL' &&
      item.productType !== 'SERVICE'
  );

  const enabledGateways = useMemo(
    () =>
      (ctx?.paymentGateways || []).filter((g) => {
        if (!g.isEnabled) return false;
        if (g.gatewayCode === 'COD' && !needsShipping && cart.items.length > 0) return false;
        return true;
      }),
    [ctx?.paymentGateways, needsShipping, cart.items.length]
  );

  const [customerName, setCustomerName] = useState('');
  const [phone, setPhone] = useState('');
  const [customerEmail, setCustomerEmail] = useState('');
  const [cityId, setCityId] = useState('');
  const [shippingAddress, setShippingAddress] = useState('');
  const [customerNotes, setCustomerNotes] = useState('');
  const [customFields, setCustomFields] = useState<Record<string, unknown>>({});
  const [paymentMethod, setPaymentMethod] = useState<PaymentMethod>('COD');
  const [couponInput, setCouponInput] = useState('');
  const [couponError, setCouponError] = useState<string | null>(null);
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
      if (!exists) setPaymentMethod(enabledGateways[0].gatewayCode as PaymentMethod);
    }
  }, [enabledGateways, paymentMethod]);

  useEffect(() => {
    if (formPostAction && postFormRef.current) {
      postFormRef.current.submit();
    }
  }, [formPostAction]);

  const checkoutConfig = ctx?.settings?.checkoutConfig;
  const subtotalAfterDiscount = Math.max(0, cart.subtotal - cart.discountAmount);
  const selectedCity = activeCities.find((c) => c.id === cityId);
  const freeThreshold = selectedCity?.freeShippingMinOrder
    ? Number(selectedCity.freeShippingMinOrder)
    : null;
  const isFreeShipping =
    !needsShipping ||
    cart.freeShippingFromCoupon ||
    (freeThreshold !== null && subtotalAfterDiscount >= freeThreshold);
  const shippingFee = isFreeShipping
    ? 0
    : selectedCity
      ? Number(selectedCity.deliveryFee)
      : 35;
  const codFee =
    paymentMethod === 'COD' && selectedCity ? Number(selectedCity.codFee || 0) : 0;
  const grandTotal = Number((subtotalAfterDiscount + shippingFee + codFee).toFixed(2));

  async function handleCouponSubmit(e: React.FormEvent) {
    e.preventDefault();
    setCouponError(null);
    const res = await applyCoupon(couponInput.trim() || null);
    if (!res.ok) {
      setCouponError(res.error || 'Invalid coupon');
    } else {
      setCouponInput('');
    }
  }

  async function handlePlaceOrder(e: React.FormEvent) {
    e.preventDefault();
    if (cart.items.length === 0) return;
    setErrorMsg(null);
    setSubmitting(true);

    try {
      const eventId = trackEvent('InitiateCheckout', {
        value: grandTotal,
        contentIds: cart.items.map((i) => i.productId),
      });

      const res = await fetch('/api/storefront/checkout', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          checkoutType: 'CART',
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
          couponCode: cart.couponCode || null,
          paymentMethod,
          trackingEventId: eventId,
          items: cart.items.map((item) => ({
            productId: item.productId,
            variantId: item.variantId,
            quantity: item.quantity,
          })),
        }),
      });

      const data = await res.json();
      if (!res.ok) {
        setErrorMsg(data.error || 'Checkout error');
        setSubmitting(false);
        return;
      }

      await refreshCart();

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
      setErrorMsg('An error occurred while placing your order.');
      setSubmitting(false);
    }
  }

  return (
    <StorefrontShell>
      <div className="mx-auto max-w-6xl px-4 py-8 sm:px-6 lg:px-8">
        <h1 className="mb-6 text-2xl sm:text-3xl font-extrabold text-stone-900">
          {tr('cart.proceedCheckout')}
        </h1>

        {cart.items.length === 0 ? (
          <div className="rounded-3xl border border-stone-200 bg-white p-12 text-center space-y-4">
            <ShoppingBag className="mx-auto h-12 w-12 text-stone-300" />
            <p className="text-base font-semibold text-stone-700">{tr('cart.empty')}</p>
            <Link href="/shop" className="btn-store-primary inline-block px-6 py-3 text-sm font-bold">
              {tr('cart.browseShop')}
            </Link>
          </div>
        ) : (
          <div className="grid grid-cols-1 gap-8 lg:grid-cols-12">
            <form
              onSubmit={handlePlaceOrder}
              className="space-y-5 rounded-3xl border border-stone-200 bg-white p-6 shadow-xs lg:col-span-7"
            >
              <div className="flex items-center justify-between border-b border-stone-100 pb-3">
                <h2 className="text-lg font-extrabold text-stone-900">
                  {locale === 'ar'
                    ? 'بيانات التوصيل والدفع'
                    : locale === 'fr'
                      ? 'Informations de livraison et paiement'
                      : 'Shipping & Payment Details'}
                </h2>
                <span className="inline-flex items-center gap-1 text-xs font-bold text-emerald-800">
                  <ShieldCheck className="h-4 w-4" />
                  SSL
                </span>
              </div>

              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
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
                    className="w-full rounded-xl border border-stone-300 px-3.5 py-2.5 text-sm focus:border-emerald-700 focus:outline-none"
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
                    className="w-full rounded-xl border border-stone-300 px-3.5 py-2.5 text-sm text-start focus:border-emerald-700 focus:outline-none"
                  />
                </div>
              </div>

              <div>
                <label className="mb-1 block text-xs font-semibold text-stone-700">
                  {tr('checkout.email')} {(!needsShipping || checkoutConfig?.requireEmail) && '*'}
                </label>
                <input
                  type="email"
                  required={Boolean(!needsShipping || checkoutConfig?.requireEmail)}
                  value={customerEmail}
                  onChange={(e) => setCustomerEmail(e.target.value)}
                  className="w-full rounded-xl border border-stone-300 px-3.5 py-2.5 text-sm focus:border-emerald-700 focus:outline-none"
                />
              </div>

              {needsShipping && (
                <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                  <div>
                    <label className="mb-1 block text-xs font-semibold text-stone-700">
                      {tr('checkout.city')} *
                    </label>
                    <select
                      required
                      value={cityId}
                      onChange={(e) => setCityId(e.target.value)}
                      className="w-full rounded-xl border border-stone-300 px-3.5 py-2.5 text-sm focus:border-emerald-700 focus:outline-none"
                    >
                      <option value="">{tr('checkout.selectCity')}</option>
                      {activeCities.map((city) => (
                        <option key={city.id} value={city.id}>
                          {pick(city.cityNameI18n)} — {formatPrice(city.deliveryFee)}
                        </option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <label className="mb-1 block text-xs font-semibold text-stone-700">
                      {tr('checkout.address')} *
                    </label>
                    <input
                      type="text"
                      required
                      minLength={2}
                      value={shippingAddress}
                      onChange={(e) => setShippingAddress(e.target.value)}
                      className="w-full rounded-xl border border-stone-300 px-3.5 py-2.5 text-sm focus:border-emerald-700 focus:outline-none"
                    />
                  </div>
                </div>
              )}

              {(checkoutConfig?.customFields || [])
                .filter((f) => f.enabled)
                .map((field) => (
                  <div key={field.id}>
                    <label className="mb-1 block text-xs font-semibold text-stone-700">
                      {pick(field.labelI18n)} {field.required && '*'}
                    </label>
                    <input
                      type="text"
                      required={field.required}
                      value={String(customFields[field.key] || '')}
                      onChange={(e) =>
                        setCustomFields((p) => ({ ...p, [field.key]: e.target.value }))
                      }
                      className="w-full rounded-xl border border-stone-300 px-3.5 py-2 text-sm"
                    />
                  </div>
                ))}

              <div>
                <label className="mb-1 block text-xs font-semibold text-stone-700">
                  {tr('checkout.notes')}
                </label>
                <textarea
                  rows={2}
                  value={customerNotes}
                  onChange={(e) => setCustomerNotes(e.target.value)}
                  className="w-full rounded-xl border border-stone-300 px-3.5 py-2 text-sm focus:border-emerald-700 focus:outline-none"
                />
              </div>

              <div>
                <label className="mb-2 block text-xs font-semibold text-stone-700">
                  {tr('checkout.paymentMethod')}
                </label>
                <div className="grid grid-cols-1 gap-2.5 sm:grid-cols-2">
                  {enabledGateways.map((gw) => {
                    const selected = paymentMethod === gw.gatewayCode;
                    return (
                      <button
                        key={gw.gatewayCode}
                        type="button"
                        onClick={() => setPaymentMethod(gw.gatewayCode as PaymentMethod)}
                        className={`flex items-center justify-between rounded-xl border p-3 text-start text-sm font-bold ${
                          selected
                            ? 'border-emerald-800 bg-emerald-50 text-emerald-950'
                            : 'border-stone-200 hover:bg-stone-50'
                        }`}
                      >
                        <div>
                          <div>{pick(gw.displayNameI18n, gw.gatewayCode)}</div>
                          {pick(gw.instructionsI18n) && (
                            <p className="mt-0.5 text-[11px] font-normal text-stone-500">
                              {pick(gw.instructionsI18n)}
                            </p>
                          )}
                        </div>
                        {selected && <CheckCircle2 className="h-4 w-4 text-emerald-700" />}
                      </button>
                    );
                  })}
                </div>
              </div>

              {errorMsg && (
                <div className="rounded-xl border border-red-200 bg-red-50 px-3.5 py-2.5 text-xs font-medium text-red-700">
                  {errorMsg}
                </div>
              )}

              <button
                type="submit"
                disabled={submitting}
                className="btn-store-primary flex w-full items-center justify-center gap-2 py-4 text-base font-extrabold shadow-md disabled:opacity-60"
              >
                {submitting ? (
                  <>
                    <Loader2 className="h-5 w-5 animate-spin" />
                    <span>{tr('checkout.submitting')}</span>
                  </>
                ) : (
                  <span>
                    {tr('checkout.completeOrder')} — {formatPrice(grandTotal)}
                  </span>
                )}
              </button>
            </form>

            {/* Right Summary */}
            <aside className="space-y-4 rounded-3xl border border-stone-200 bg-white p-6 shadow-xs lg:col-span-5 h-fit">
              <h2 className="border-b border-stone-100 pb-3 text-base font-extrabold text-stone-900">
                {tr('cart.title')} ({cart.totalItems})
              </h2>

              <div className="space-y-3">
                {cart.items.map((item) => (
                  <div key={item.id} className="flex items-center gap-3 text-sm">
                    <div className="h-14 w-14 shrink-0 overflow-hidden rounded-xl bg-stone-100">
                      {item.imageUrl && (
                        <img src={item.imageUrl} alt="" className="h-full w-full object-cover" />
                      )}
                    </div>
                    <div className="min-w-0 flex-1">
                      <p className="truncate font-bold text-stone-900">{pick(item.titleI18n)}</p>
                      <p className="text-xs text-stone-500">
                        {item.quantity} × {formatPrice(item.unitPrice)}
                      </p>
                    </div>
                    <span className="font-bold tabular-nums">{formatPrice(item.lineTotal)}</span>
                  </div>
                ))}
              </div>

              {cart.couponCode ? (
                <div className="flex items-center justify-between rounded-xl border border-emerald-200 bg-emerald-50 px-3 py-2 text-xs text-emerald-900">
                  <span className="inline-flex items-center gap-1.5 font-bold">
                    <Tag className="h-3.5 w-3.5" />
                    {cart.couponCode}
                  </span>
                  <button
                    type="button"
                    onClick={() => applyCoupon(null)}
                    className="font-bold text-red-600"
                  >
                    ×
                  </button>
                </div>
              ) : (
                <form onSubmit={handleCouponSubmit} className="flex gap-2 pt-2">
                  <input
                    type="text"
                    value={couponInput}
                    onChange={(e) => setCouponInput(e.target.value)}
                    placeholder={tr('checkout.couponPlaceholder')}
                    className="flex-1 rounded-xl border border-stone-200 px-3 py-2 text-xs"
                  />
                  <button
                    type="submit"
                    className="rounded-xl border border-stone-300 px-3 py-2 text-xs font-bold hover:bg-stone-50"
                  >
                    {tr('checkout.applyCoupon')}
                  </button>
                </form>
              )}
              {couponError && <p className="text-xs text-red-600">{couponError}</p>}

              <div className="space-y-2 border-t border-stone-100 pt-3 text-sm">
                <div className="flex justify-between text-stone-600">
                  <span>{tr('checkout.subtotal')}</span>
                  <span className="tabular-nums">{formatPrice(cart.subtotal)}</span>
                </div>
                {cart.discountAmount > 0 && (
                  <div className="flex justify-between text-emerald-700">
                    <span>{tr('checkout.discount')}</span>
                    <span className="tabular-nums">-{formatPrice(cart.discountAmount)}</span>
                  </div>
                )}
                {needsShipping && (
                  <div className="flex justify-between text-stone-600">
                    <span className="inline-flex items-center gap-1">
                      <Truck className="h-3.5 w-3.5" />
                      {tr('checkout.shipping')}
                    </span>
                    <span className="tabular-nums">
                      {shippingFee === 0 ? tr('checkout.free') : formatPrice(shippingFee)}
                    </span>
                  </div>
                )}
                {codFee > 0 && (
                  <div className="flex justify-between text-stone-600">
                    <span>{tr('checkout.codFee')}</span>
                    <span className="tabular-nums">{formatPrice(codFee)}</span>
                  </div>
                )}
                <div className="flex justify-between border-t border-stone-200 pt-2 text-base font-extrabold text-stone-900">
                  <span>{tr('checkout.total')}</span>
                  <span className="text-store-primary tabular-nums">{formatPrice(grandTotal)}</span>
                </div>
              </div>
            </aside>
          </div>
        )}

        {formPostAction && (
          <form ref={postFormRef} method="POST" action={formPostAction.formUrl} className="hidden">
            {Object.entries(formPostAction.formFields).map(([k, v]) => (
              <input key={k} type="hidden" name={k} value={v} />
            ))}
          </form>
        )}
      </div>
    </StorefrontShell>
  );
}

