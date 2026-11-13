'use client';

import React, { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import type { StorefrontContextData } from '@/core/storefront/load-context';
import { formatMoney, pickI18n, t as translate } from '@/core/i18n/dictionaries';
import type { I18nMap } from '@/db/schema/types';

export interface CartItemView {
  id: string;
  productId: string;
  slug: string;
  productType: string;
  requiresShipping: boolean;
  titleI18n: I18nMap;
  variantId: string | null;
  variantTitleI18n: I18nMap | null;
  unitPrice: number;
  regularPrice: number;
  quantity: number;
  lineTotal: number;
  imageUrl: string | null;
}

export interface CartState {
  cartId?: string;
  couponCode: string | null;
  items: CartItemView[];
  subtotal: number;
  discountAmount: number;
  freeShippingFromCoupon: boolean;
  totalItems: number;
}

interface StoreContextValue {
  ctx: StorefrontContextData | null;
  locale: string;
  direction: 'rtl' | 'ltr';
  setLocale: (loc: string) => void;
  tr: (key: string) => string;
  pick: (map: I18nMap | null | undefined, fallback?: string) => string;
  formatPrice: (amount: number | string) => string;
  cart: CartState;
  cartOpen: boolean;
  setCartOpen: (open: boolean) => void;
  cartLoading: boolean;
  refreshCart: () => Promise<void>;
  addToCart: (productId: string, variantId?: string | null, quantity?: number, openDrawer?: boolean) => Promise<void>;
  updateCartQty: (itemId: string, quantity: number) => Promise<void>;
  removeCartItem: (itemId: string) => Promise<void>;
  applyCoupon: (code: string | null) => Promise<{ ok: boolean; error?: string }>;
  clearCart: () => Promise<void>;
  trackEvent: (
    eventName: 'ViewContent' | 'AddToCart' | 'InitiateCheckout' | 'Purchase' | 'Lead',
    data?: { value?: number; contentIds?: string[]; orderNumber?: string; eventId?: string }
  ) => string;
}

const EMPTY_CART: CartState = {
  couponCode: null,
  items: [],
  subtotal: 0,
  discountAmount: 0,
  freeShippingFromCoupon: false,
  totalItems: 0,
};

const StoreContext = createContext<StoreContextValue | null>(null);

export function StoreContextProvider({
  initialContext,
  children,
}: {
  initialContext: StorefrontContextData | null;
  children: React.ReactNode;
}) {
  const router = useRouter();
  const [locale, setLocaleState] = useState(initialContext?.locale || 'ar');
  const [cart, setCart] = useState<CartState>(EMPTY_CART);
  const [cartOpen, setCartOpen] = useState(false);
  const [cartLoading, setCartLoading] = useState(false);

  const direction: 'rtl' | 'ltr' = useMemo(() => {
    const matched = initialContext?.languages?.find((l) => l.locale === locale);
    if (matched) return matched.direction === 'rtl' ? 'rtl' : 'ltr';
    return locale === 'ar' ? 'rtl' : 'ltr';
  }, [initialContext?.languages, locale]);

  const activeOverrides = useMemo(() => {
    return initialContext?.languages?.find((l) => l.locale === locale)?.overrides || {};
  }, [initialContext?.languages, locale]);

  const setLocale = useCallback(
    (nextLocale: string) => {
      document.cookie = `nabat_locale=${nextLocale}; path=/; max-age=31536000; SameSite=Lax`;
      setLocaleState(nextLocale);
      const nextDir =
        initialContext?.languages?.find((l) => l.locale === nextLocale)?.direction ||
        (nextLocale === 'ar' ? 'rtl' : 'ltr');
      document.documentElement.lang = nextLocale;
      document.documentElement.dir = nextDir;
      router.refresh();
    },
    [initialContext?.languages, router]
  );

  const refreshCart = useCallback(async () => {
    try {
      const res = await fetch('/api/storefront/cart', { cache: 'no-store' });
      if (res.ok) {
        const json = (await res.json()) as CartState;
        setCart(json);
      }
    } catch {
      // Ignore network hiccup
    }
  }, []);

  useEffect(() => {
    void refreshCart();
  }, [refreshCart]);

  const trackEvent = useCallback(
    (
      eventName: 'ViewContent' | 'AddToCart' | 'InitiateCheckout' | 'Purchase' | 'Lead',
      data?: { value?: number; contentIds?: string[]; orderNumber?: string; eventId?: string }
    ): string => {
      const eventId = data?.eventId || `${eventName}_${Date.now()}_${Math.random().toString(36).slice(2, 10)}`;
      if (typeof window !== 'undefined') {
        const w = window as unknown as {
          fbq?: (...args: unknown[]) => void;
          ttq?: { track: (ev: string, payload?: unknown) => void };
          gtag?: (...args: unknown[]) => void;
          dataLayer?: Array<Record<string, unknown>>;
        };
        const currency = initialContext?.settings?.defaultCurrency || 'MAD';
        if (w.fbq) {
          w.fbq(
            'track',
            eventName,
            {
              value: data?.value,
              currency,
              content_ids: data?.contentIds,
              content_type: 'product',
            },
            { eventID: eventId }
          );
        }
        if (w.ttq) {
          const ttName =
            eventName === 'Purchase' ? 'CompletePayment' : eventName;
          w.ttq.track(ttName, { value: data?.value, currency, content_id: data?.contentIds?.[0] });
        }
        if (w.gtag) {
          w.gtag('event', eventName.toLowerCase(), {
            value: data?.value,
            currency,
            transaction_id: data?.orderNumber,
          });
        }
        if (Array.isArray(w.dataLayer)) {
          w.dataLayer.push({
            event: eventName,
            eventId,
            value: data?.value,
            currency,
            orderNumber: data?.orderNumber,
          });
        }
        if (eventName !== 'Purchase') {
          void fetch('/api/storefront/tracking/event', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              eventName,
              eventId,
              eventSourceUrl: window.location.href,
              value: data?.value,
              currency,
              contentIds: data?.contentIds,
            }),
          }).catch(() => undefined);
        }
      }
      return eventId;
    },
    [initialContext?.settings?.defaultCurrency]
  );

  const addToCart = useCallback(
    async (productId: string, variantId?: string | null, quantity = 1, openDrawer = true) => {
      setCartLoading(true);
      try {
        const res = await fetch('/api/storefront/cart', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ action: 'ADD', productId, variantId, quantity }),
        });
        if (res.ok) {
          const json = (await res.json()) as CartState;
          setCart(json);
          if (openDrawer) setCartOpen(true);
          trackEvent('AddToCart', { contentIds: [productId] });
        }
      } finally {
        setCartLoading(false);
      }
    },
    [trackEvent]
  );

  const updateCartQty = useCallback(async (itemId: string, quantity: number) => {
    setCartLoading(true);
    try {
      const res = await fetch('/api/storefront/cart', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'UPDATE', itemId, quantity }),
      });
      if (res.ok) setCart(await res.json());
    } finally {
      setCartLoading(false);
    }
  }, []);

  const removeCartItem = useCallback(async (itemId: string) => {
    setCartLoading(true);
    try {
      const res = await fetch('/api/storefront/cart', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'REMOVE', itemId }),
      });
      if (res.ok) setCart(await res.json());
    } finally {
      setCartLoading(false);
    }
  }, []);

  const applyCoupon = useCallback(async (code: string | null) => {
    setCartLoading(true);
    try {
      const res = await fetch('/api/storefront/cart', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'APPLY_COUPON', couponCode: code }),
      });
      const json = await res.json();
      if (!res.ok) {
        return { ok: false, error: json.error || 'Invalid coupon' };
      }
      setCart(json);
      return { ok: true };
    } finally {
      setCartLoading(false);
    }
  }, []);

  const clearCart = useCallback(async () => {
    const res = await fetch('/api/storefront/cart', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action: 'CLEAR' }),
    });
    if (res.ok) setCart(await res.json());
  }, []);

  const tr = useCallback(
    (key: string) => translate(locale, key, activeOverrides),
    [locale, activeOverrides]
  );

  const pick = useCallback(
    (map: I18nMap | null | undefined, fallback = '') => pickI18n(map, locale, fallback),
    [locale]
  );

  const formatPrice = useCallback(
    (amount: number | string) =>
      formatMoney(
        amount,
        locale,
        initialContext?.settings?.currencySymbols || { ar: 'د.م.', fr: 'DH', en: 'MAD' },
        (initialContext?.settings?.currencyPosition as 'before' | 'after') || 'after'
      ),
    [initialContext?.settings?.currencyPosition, initialContext?.settings?.currencySymbols, locale]
  );

  const value: StoreContextValue = {
    ctx: initialContext,
    locale,
    direction,
    setLocale,
    tr,
    pick,
    formatPrice,
    cart,
    cartOpen,
    setCartOpen,
    cartLoading,
    refreshCart,
    addToCart,
    updateCartQty,
    removeCartItem,
    applyCoupon,
    clearCart,
    trackEvent,
  };

  return <StoreContext.Provider value={value}>{children}</StoreContext.Provider>;
}

export function useStore() {
  const ctx = useContext(StoreContext);
  if (!ctx) throw new Error('useStore must be used inside StoreContextProvider');
  return ctx;
}

