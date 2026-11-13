'use client';

import React, { useState } from 'react';
import Link from 'next/link';
import { Minus, Plus, ShoppingBag, Tag, Trash2, X } from 'lucide-react';
import { useStore } from '@/components/providers/StoreContextProvider';

export function CartDrawer() {
  const {
    cart,
    cartOpen,
    setCartOpen,
    cartLoading,
    updateCartQty,
    removeCartItem,
    applyCoupon,
    tr,
    pick,
    formatPrice,
    locale,
  } = useStore();

  const [couponInput, setCouponInput] = useState('');
  const [couponFeedback, setCouponFeedback] = useState<string | null>(null);

  if (!cartOpen) return null;

  async function handleCouponSubmit(e: React.FormEvent) {
    e.preventDefault();
    setCouponFeedback(null);
    const res = await applyCoupon(couponInput.trim() || null);
    if (!res.ok) {
      setCouponFeedback(
        res.error ||
          (locale === 'ar'
            ? 'كود الخصم غير صالح'
            : locale === 'fr'
              ? 'Code promo invalide'
              : 'Invalid coupon code')
      );
    } else {
      setCouponInput('');
    }
  }

  const netSubtotal = Math.max(0, cart.subtotal - cart.discountAmount);

  return (
    <div className="fixed inset-0 z-50 flex justify-end">
      <div
        className="fixed inset-0 bg-black/45 backdrop-blur-xs"
        onClick={() => setCartOpen(false)}
      />
      <aside className="relative z-10 flex h-full w-full max-w-md flex-col bg-white shadow-2xl">
        <div className="flex items-center justify-between border-b border-stone-200 px-5 py-4">
          <div className="flex items-center gap-2">
            <ShoppingBag className="h-5 w-5 text-store-primary" />
            <h2 className="text-base font-bold text-stone-900">
              {tr('cart.title')} ({cart.totalItems})
            </h2>
          </div>
          <button
            type="button"
            onClick={() => setCartOpen(false)}
            className="rounded-lg p-1.5 text-stone-500 hover:bg-stone-100"
            aria-label="Close cart"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto px-5 py-4">
          {cart.items.length === 0 ? (
            <div className="flex h-full flex-col items-center justify-center gap-4 text-center">
              <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-stone-100 text-stone-400">
                <ShoppingBag className="h-8 w-8" />
              </div>
              <p className="text-sm font-medium text-stone-600">{tr('cart.empty')}</p>
              <Link
                href="/shop"
                onClick={() => setCartOpen(false)}
                className="btn-store-primary px-5 py-2.5 text-sm font-semibold"
              >
                {tr('cart.browseShop')}
              </Link>
            </div>
          ) : (
            <div className="space-y-4">
              {cart.items.map((item) => (
                <div
                  key={item.id}
                  className="flex gap-3 rounded-2xl border border-stone-200/80 bg-stone-50/50 p-3"
                >
                  <Link
                    href={`/products/${item.slug}`}
                    onClick={() => setCartOpen(false)}
                    className="h-20 w-20 shrink-0 overflow-hidden rounded-xl bg-stone-100"
                  >
                    {item.imageUrl && (
                      <img
                        src={item.imageUrl}
                        alt={pick(item.titleI18n)}
                        className="h-full w-full object-cover"
                      />
                    )}
                  </Link>

                  <div className="flex min-w-0 flex-1 flex-col justify-between">
                    <div className="flex items-start justify-between gap-2">
                      <div>
                        <Link
                          href={`/products/${item.slug}`}
                          onClick={() => setCartOpen(false)}
                          className="line-clamp-1 text-sm font-semibold text-stone-900 hover:text-store-primary"
                        >
                          {pick(item.titleI18n)}
                        </Link>
                        {item.variantTitleI18n && (
                          <p className="text-xs text-stone-500">
                            {pick(item.variantTitleI18n)}
                          </p>
                        )}
                      </div>
                      <button
                        type="button"
                        disabled={cartLoading}
                        onClick={() => removeCartItem(item.id)}
                        className="rounded-lg p-1 text-stone-400 hover:bg-red-50 hover:text-red-600"
                        title={tr('cart.remove')}
                      >
                        <Trash2 className="h-4 w-4" />
                      </button>
                    </div>

                    <div className="mt-2 flex items-center justify-between">
                      <div className="inline-flex items-center rounded-xl border border-stone-200 bg-white">
                        <button
                          type="button"
                          disabled={cartLoading}
                          onClick={() =>
                            item.quantity > 1
                              ? updateCartQty(item.id, item.quantity - 1)
                              : removeCartItem(item.id)
                          }
                          className="px-2 py-1 text-stone-600 hover:text-stone-900 disabled:opacity-40"
                        >
                          <Minus className="h-3.5 w-3.5" />
                        </button>
                        <span className="min-w-7 text-center text-xs font-bold tabular-nums">
                          {item.quantity}
                        </span>
                        <button
                          type="button"
                          disabled={cartLoading}
                          onClick={() => updateCartQty(item.id, item.quantity + 1)}
                          className="px-2 py-1 text-stone-600 hover:text-stone-900 disabled:opacity-40"
                        >
                          <Plus className="h-3.5 w-3.5" />
                        </button>
                      </div>
                      <span className="text-sm font-bold text-stone-900 tabular-nums">
                        {formatPrice(item.lineTotal)}
                      </span>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {cart.items.length > 0 && (
          <div className="border-t border-stone-200 bg-stone-50/70 px-5 py-4 space-y-3">
            {cart.couponCode ? (
              <div className="flex items-center justify-between rounded-xl border border-emerald-200 bg-emerald-50 px-3 py-2 text-xs text-emerald-900">
                <span className="inline-flex items-center gap-1.5 font-semibold">
                  <Tag className="h-3.5 w-3.5" />
                  {cart.couponCode}
                </span>
                <button
                  type="button"
                  onClick={() => applyCoupon(null)}
                  className="font-bold text-red-600 hover:underline"
                >
                  ×
                </button>
              </div>
            ) : (
              <form onSubmit={handleCouponSubmit} className="flex gap-2">
                <input
                  type="text"
                  value={couponInput}
                  onChange={(e) => setCouponInput(e.target.value)}
                  placeholder={tr('checkout.couponPlaceholder')}
                  className="flex-1 rounded-xl border border-stone-200 bg-white px-3 py-2 text-xs focus:border-emerald-700 focus:outline-none"
                />
                <button
                  type="submit"
                  disabled={cartLoading || !couponInput.trim()}
                  className="rounded-xl border border-stone-300 bg-white px-3 py-2 text-xs font-semibold text-stone-800 hover:bg-stone-100 disabled:opacity-50"
                >
                  {tr('checkout.applyCoupon')}
                </button>
              </form>
            )}
            {couponFeedback && (
              <p className="text-xs text-red-600">{couponFeedback}</p>
            )}

            <div className="space-y-1.5 text-sm">
              <div className="flex justify-between text-stone-600">
                <span>{tr('checkout.subtotal')}</span>
                <span className="font-medium tabular-nums">
                  {formatPrice(cart.subtotal)}
                </span>
              </div>
              {cart.discountAmount > 0 && (
                <div className="flex justify-between text-emerald-700">
                  <span>{tr('checkout.discount')}</span>
                  <span className="font-semibold tabular-nums">
                    -{formatPrice(cart.discountAmount)}
                  </span>
                </div>
              )}
              <div className="flex justify-between border-t border-stone-200 pt-2 text-base font-bold text-stone-900">
                <span>{tr('checkout.total')}</span>
                <span className="tabular-nums">{formatPrice(netSubtotal)}</span>
              </div>
            </div>

            <Link
              href="/checkout"
              onClick={() => setCartOpen(false)}
              className="btn-store-primary block w-full py-3.5 text-center text-sm font-bold shadow-sm"
            >
              {tr('cart.proceedCheckout')}
            </Link>
          </div>
        )}
      </aside>
    </div>
  );
}

