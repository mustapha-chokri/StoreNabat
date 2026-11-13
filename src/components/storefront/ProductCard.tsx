'use client';

import React, { useState } from 'react';
import Link from 'next/link';
import { ShoppingBag, Star } from 'lucide-react';
import { useStore } from '@/components/providers/StoreContextProvider';
import { computeEffectivePrice } from '@/services/catalog/pricing';
import type { I18nMap } from '@/db/schema/types';

export interface ProductCardData {
  id: string;
  slug: string;
  productType: string;
  titleI18n: I18nMap;
  shortDescriptionI18n?: I18nMap;
  regularPrice: string | number;
  salePrice: string | number | null;
  discountType: string | null;
  discountValue: string | number | null;
  promoStartsAt: string | Date | null;
  promoEndsAt: string | Date | null;
  stockQuantity: number;
  trackInventory: boolean;
  allowBackorders: boolean;
  hasVariants: boolean;
  isBestSeller?: boolean;
  badgeI18n?: I18nMap | null;
  averageRating?: string | number;
  reviewsCount?: number;
  media?: Array<{ url: string; mediaType: string }>;
  variants?: Array<{ id: string; stockQuantity: number; isDefault: boolean }>;
}

export function ProductCard({ product }: { product: ProductCardData }) {
  const { ctx, tr, pick, formatPrice, addToCart } = useStore();
  const [adding, setAdding] = useState(false);

  const price = computeEffectivePrice({
    regularPrice: product.regularPrice,
    salePrice: product.salePrice,
    discountType: product.discountType,
    discountValue: product.discountValue,
    promoStartsAt: product.promoStartsAt,
    promoEndsAt: product.promoEndsAt,
  });

  const primaryImg = product.media?.find((m) => m.mediaType === 'IMAGE')?.url;
  const isOutOfStock =
    product.trackInventory &&
    !product.allowBackorders &&
    (product.hasVariants && product.variants?.length
      ? product.variants.every((v) => v.stockQuantity <= 0)
      : product.stockQuantity <= 0);

  const cartEnabled = ctx?.settings?.checkoutConfig?.cartEnabled ?? true;
  const rating = Number(product.averageRating || 0);

  async function handleQuickAdd() {
    if (adding || isOutOfStock) return;
    setAdding(true);
    try {
      const defaultVar =
        product.variants?.find((v) => v.isDefault && v.stockQuantity > 0) ||
        product.variants?.find((v) => v.stockQuantity > 0) ||
        product.variants?.[0];
      await addToCart(product.id, defaultVar?.id || null, 1, true);
    } finally {
      setAdding(false);
    }
  }

  return (
    <article className="group flex flex-col overflow-hidden rounded-2xl border border-stone-200/80 bg-white transition-all hover:-translate-y-0.5 hover:shadow-lg">
      <Link
        href={`/products/${product.slug}`}
        className="relative aspect-4/3 overflow-hidden bg-stone-100"
      >
        {primaryImg ? (
          <img
            src={primaryImg}
            alt={pick(product.titleI18n)}
            className="h-full w-full object-cover transition-transform duration-300 group-hover:scale-105"
          />
        ) : (
          <div className="flex h-full items-center justify-center text-xs text-stone-400">
            Nabat Al Atlas
          </div>
        )}

        <div className="absolute top-2.5 start-2.5 flex flex-wrap gap-1.5">
          {price.hasActiveDiscount && price.discountPercent > 0 && (
            <span className="rounded-full bg-amber-600 px-2.5 py-0.5 text-[11px] font-bold text-white shadow-xs">
              -{price.discountPercent}%
            </span>
          )}
          {product.badgeI18n && pick(product.badgeI18n) && (
            <span className="rounded-full bg-store-primary px-2.5 py-0.5 text-[11px] font-semibold text-white shadow-xs">
              {pick(product.badgeI18n)}
            </span>
          )}
          {product.productType === 'DIGITAL' && (
            <span className="rounded-full bg-sky-700 px-2.5 py-0.5 text-[11px] font-semibold text-white shadow-xs">
              PDF
            </span>
          )}
          {product.productType === 'SUBSCRIPTION' && (
            <span className="rounded-full bg-violet-700 px-2.5 py-0.5 text-[11px] font-semibold text-white shadow-xs">
              VIP
            </span>
          )}
        </div>

        {isOutOfStock && (
          <div className="absolute inset-0 flex items-center justify-center bg-black/45">
            <span className="rounded-xl bg-white/95 px-3 py-1 text-xs font-bold text-stone-900">
              {tr('product.outOfStock')}
            </span>
          </div>
        )}
      </Link>

      <div className="flex flex-1 flex-col p-4">
        {rating > 0 && (
          <div className="mb-1.5 flex items-center gap-1 text-xs text-amber-600">
            <Star className="h-3.5 w-3.5 fill-amber-500 text-amber-500" />
            <span className="font-bold">{rating.toFixed(1)}</span>
            <span className="text-stone-400">({product.reviewsCount || 0})</span>
          </div>
        )}

        <Link
          href={`/products/${product.slug}`}
          className="line-clamp-2 text-sm sm:text-base font-bold text-stone-900 group-hover:text-store-primary"
        >
          {pick(product.titleI18n)}
        </Link>

        {product.shortDescriptionI18n && (
          <p className="mt-1 line-clamp-2 text-xs text-stone-500">
            {pick(product.shortDescriptionI18n)}
          </p>
        )}

        <div className="mt-auto pt-3 flex items-baseline gap-2">
          <span className="text-base sm:text-lg font-extrabold text-store-primary tabular-nums">
            {formatPrice(price.effectivePrice)}
          </span>
          {price.hasActiveDiscount && (
            <span className="text-xs text-stone-400 line-through tabular-nums">
              {formatPrice(price.regularPrice)}
            </span>
          )}
        </div>

        <div className="mt-3 flex gap-2">
          <Link
            href={`/products/${product.slug}`}
            className="flex-1 rounded-xl border border-stone-200 py-2 text-center text-xs font-bold text-stone-800 hover:border-emerald-700 hover:text-store-primary"
          >
            {tr('product.buyNowQuick')}
          </Link>
          {cartEnabled && !isOutOfStock && (
            <button
              type="button"
              onClick={handleQuickAdd}
              disabled={adding}
              className="btn-store-primary inline-flex items-center justify-center px-3 py-2 text-xs font-bold disabled:opacity-50"
              aria-label={tr('product.addToCart')}
              title={tr('product.addToCart')}
            >
              <ShoppingBag className="h-4 w-4" />
            </button>
          )}
        </div>
      </div>
    </article>
  );
}

