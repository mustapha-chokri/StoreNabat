'use client';

import React, { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import {
  Check,
  Download,
  Layers,
  MessageCircle,
  Minus,
  PackageCheck,
  PlayCircle,
  Plus,
  Share2,
  ShoppingBag,
  Sparkles,
  Star,
} from 'lucide-react';
import { useStore } from '@/components/providers/StoreContextProvider';
import { computeEffectivePrice } from '@/services/catalog/pricing';
import { QuickOrderForm } from './QuickOrderForm';
import { CountdownTimer } from './CountdownTimer';
import { ProductCard, type ProductCardData } from './ProductCard';
import type {
  I18nMap,
  ProductSpecificationItem,
  VariantOptionDefinition,
} from '@/db/schema/types';

export interface ProductDetailData {
  product: {
    id: string;
    slug: string;
    productType: string;
    titleI18n: I18nMap;
    shortDescriptionI18n: I18nMap;
    descriptionSanitizedI18n: I18nMap;
    specificationsI18n: Record<string, ProductSpecificationItem[]>;
    regularPrice: string;
    salePrice: string | null;
    discountType: string | null;
    discountValue: string | null;
    promoStartsAt: string | null;
    promoEndsAt: string | null;
    sku: string | null;
    barcode: string | null;
    trackInventory: boolean;
    stockQuantity: number;
    allowBackorders: boolean;
    hasVariants: boolean;
    variantOptions: VariantOptionDefinition[];
    requiresShipping: boolean;
    shippingConfig: { weightKg?: number; freeShipping?: boolean; extraShippingFee?: number };
    subscriptionConfig?: {
      interval?: 'MONTHLY' | 'QUARTERLY' | 'YEARLY';
      durationLabelI18n?: I18nMap;
    } | null;
    badgeI18n: I18nMap | null;
    averageRating: string;
    reviewsCount: number;
  };
  category: { id: string; slug: string; nameI18n: I18nMap } | null;
  media: Array<{
    id: string;
    mediaType: string;
    url: string;
    altI18n: I18nMap;
  }>;
  variants: Array<{
    id: string;
    titleI18n: I18nMap;
    optionValues: Record<string, string>;
    sku: string | null;
    barcode: string | null;
    regularPrice: string;
    salePrice: string | null;
    stockQuantity: number;
    imageUrl: string | null;
    isDefault: boolean;
  }>;
  reviews: Array<{
    id: string;
    customerName: string;
    rating: number;
    title: string | null;
    comment: string | null;
    isVerifiedPurchase: boolean;
    createdAt: string;
  }>;
  bundleItems: Array<{
    quantity: number;
    itemProduct: {
      id: string;
      slug: string;
      titleI18n: I18nMap;
    };
  }>;
  relatedProducts: ProductCardData[];
  frequentlyBoughtTogether: ProductCardData[];
}

export function ProductDetailClient({ data }: { data: ProductDetailData }) {
  const { product, category, media, variants, reviews, bundleItems, relatedProducts, frequentlyBoughtTogether } =
    data;
  const { ctx, locale, tr, pick, formatPrice, addToCart, trackEvent } = useStore();

  const defaultVariant =
    variants.find((v) => v.isDefault && v.stockQuantity > 0) ||
    variants.find((v) => v.stockQuantity > 0) ||
    variants[0] ||
    null;

  const [selectedVariantId, setSelectedVariantId] = useState<string | null>(
    defaultVariant?.id || null
  );
  const [selectedOptions, setSelectedOptions] = useState<Record<string, string>>(
    defaultVariant?.optionValues || {}
  );
  const [activeMediaIdx, setActiveMediaIdx] = useState(0);
  const [quantity, setQuantity] = useState(1);
  const [activeTab, setActiveTab] = useState<'desc' | 'specs' | 'reviews'>('desc');
  const [addingCart, setAddingCart] = useState(false);
  const [copiedShare, setCopiedShare] = useState(false);

  // Frequently bought together checkboxes
  const [fbtSelectedIds, setFbtSelectedIds] = useState<string[]>(() =>
    frequentlyBoughtTogether.map((p) => p.id)
  );
  const [addingFbt, setAddingFbt] = useState(false);

  // Review submission state
  const [revName, setRevName] = useState('');
  const [revRating, setRevRating] = useState(5);
  const [revTitle, setRevTitle] = useState('');
  const [revComment, setRevComment] = useState('');
  const [revSubmitting, setRevSubmitting] = useState(false);
  const [revFeedback, setRevFeedback] = useState<string | null>(null);

  const selectedVariant = useMemo(
    () => variants.find((v) => v.id === selectedVariantId) || null,
    [variants, selectedVariantId]
  );

  // Sync variant image to active gallery item if variant has an explicit image
  useEffect(() => {
    if (selectedVariant?.imageUrl) {
      const idx = media.findIndex((m) => m.url === selectedVariant.imageUrl);
      if (idx >= 0) setActiveMediaIdx(idx);
    }
  }, [selectedVariant?.imageUrl, media]);

  const effectivePrice = useMemo(() => {
    if (selectedVariant) {
      return computeEffectivePrice({
        regularPrice: selectedVariant.regularPrice,
        salePrice: selectedVariant.salePrice,
        promoStartsAt: product.promoStartsAt,
        promoEndsAt: product.promoEndsAt,
      });
    }
    return computeEffectivePrice({
      regularPrice: product.regularPrice,
      salePrice: product.salePrice,
      discountType: product.discountType,
      discountValue: product.discountValue,
      promoStartsAt: product.promoStartsAt,
      promoEndsAt: product.promoEndsAt,
    });
  }, [product, selectedVariant]);

  useEffect(() => {
    trackEvent('ViewContent', {
      value: effectivePrice.effectivePrice,
      contentIds: [product.id],
    });
  }, [product.id, effectivePrice.effectivePrice, trackEvent]);

  const availableStock = selectedVariant
    ? selectedVariant.stockQuantity
    : product.stockQuantity;
  const isOutOfStock =
    product.trackInventory && !product.allowBackorders && availableStock <= 0;

  const checkoutConfig = ctx?.settings?.checkoutConfig;
  const quickOrderEnabled = checkoutConfig?.quickOrderEnabled ?? true;
  const cartEnabled = checkoutConfig?.cartEnabled ?? true;

  function handleOptionSelect(optId: string, val: string) {
    const next = { ...selectedOptions, [optId]: val };
    setSelectedOptions(next);
    const match = variants.find((v) =>
      Object.entries(next).every(([k, ov]) => v.optionValues[k] === ov)
    );
    if (match) {
      setSelectedVariantId(match.id);
    } else {
      const partial = variants.find((v) => v.optionValues[optId] === val);
      if (partial) {
        setSelectedVariantId(partial.id);
        setSelectedOptions(partial.optionValues);
      }
    }
  }

  async function handleAddToCart() {
    if (addingCart || isOutOfStock) return;
    setAddingCart(true);
    try {
      await addToCart(product.id, selectedVariant?.id || null, quantity, true);
    } finally {
      setAddingCart(false);
    }
  }

  async function handleAddFbtBundle() {
    if (addingFbt) return;
    setAddingFbt(true);
    try {
      await addToCart(product.id, selectedVariant?.id || null, 1, false);
      for (const pid of fbtSelectedIds) {
        await addToCart(pid, null, 1, false);
      }
      await addToCart(product.id, selectedVariant?.id || null, 0, true).catch(() => {});
    } finally {
      setAddingFbt(false);
    }
  }

  async function handleShare() {
    const shareUrl = typeof window !== 'undefined' ? window.location.href : '';
    const title = pick(product.titleI18n);
    if (navigator.share) {
      try {
        await navigator.share({ title, url: shareUrl });
        return;
      } catch {
        // User cancelled or unsupported
      }
    }
    if (navigator.clipboard && shareUrl) {
      await navigator.clipboard.writeText(shareUrl);
      setCopiedShare(true);
      setTimeout(() => setCopiedShare(false), 2000);
    }
  }

  async function handleReviewSubmit(e: React.FormEvent) {
    e.preventDefault();
    setRevSubmitting(true);
    setRevFeedback(null);
    try {
      const res = await fetch(`/api/storefront/products/${encodeURIComponent(product.slug)}/reviews`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          customerName: revName,
          rating: revRating,
          title: revTitle || undefined,
          comment: revComment,
        }),
      });
      if (res.ok) {
        setRevFeedback(
          locale === 'ar'
            ? 'شكراً لك! تم استلام تقييمك وسيتم نشره بعد المراجعة.'
            : locale === 'fr'
              ? 'Merci ! Votre avis a été envoyé pour modération.'
              : 'Thank you! Your review has been submitted for approval.'
        );
        setRevName('');
        setRevTitle('');
        setRevComment('');
      } else {
        const d = await res.json();
        setRevFeedback(d.error || 'Error submitting review');
      }
    } finally {
      setRevSubmitting(false);
    }
  }

  const gallery = media.length > 0 ? media : [];
  const activeMedia = gallery[activeMediaIdx] || gallery[0] || null;
  const specsList =
    product.specificationsI18n?.[locale] ||
    product.specificationsI18n?.ar ||
    product.specificationsI18n?.fr ||
    [];

  const waRaw = (
    ctx?.settings?.whatsappNumber ||
    ctx?.settings?.socialLinks?.whatsapp ||
    ''
  ).replace(/[^\d]/g, '');
  const waInquiryUrl = waRaw
    ? `https://wa.me/${waRaw}?text=${encodeURIComponent(
        locale === 'ar'
          ? `مرحباً، لدي استفسار حول: ${pick(product.titleI18n)}`
          : `Bonjour, j'ai une question concernant : ${pick(product.titleI18n)}`
      )}`
    : null;

  const fbtTotal = useMemo(() => {
    let sum = effectivePrice.effectivePrice;
    for (const p of frequentlyBoughtTogether) {
      if (fbtSelectedIds.includes(p.id)) {
        sum += computeEffectivePrice({
          regularPrice: p.regularPrice,
          salePrice: p.salePrice,
          discountType: p.discountType,
          discountValue: p.discountValue,
          promoStartsAt: p.promoStartsAt,
          promoEndsAt: p.promoEndsAt,
        }).effectivePrice;
      }
    }
    return sum;
  }, [effectivePrice.effectivePrice, fbtSelectedIds, frequentlyBoughtTogether]);

  return (
    <div className="mx-auto max-w-7xl px-4 py-6 sm:px-6 lg:px-8 pb-24 sm:pb-12">
      {/* Breadcrumb */}
      <nav className="mb-5 flex flex-wrap items-center gap-2 text-xs text-stone-500">
        <Link href="/" className="hover:text-store-primary">
          {tr('nav.home')}
        </Link>
        <span>/</span>
        <Link href="/shop" className="hover:text-store-primary">
          {tr('nav.shop')}
        </Link>
        {category && (
          <>
            <span>/</span>
            <Link
              href={`/shop?category=${encodeURIComponent(category.slug)}`}
              className="hover:text-store-primary"
            >
              {pick(category.nameI18n)}
            </Link>
          </>
        )}
        <span>/</span>
        <span className="font-semibold text-stone-800">{pick(product.titleI18n)}</span>
      </nav>

      <div className="grid grid-cols-1 gap-8 lg:grid-cols-12">
        {/* Left: Gallery & Video */}
        <div className="space-y-3 lg:col-span-6">
          <div className="relative aspect-square overflow-hidden rounded-3xl border border-stone-200 bg-white shadow-sm">
            {activeMedia ? (
              activeMedia.mediaType === 'VIDEO' ? (
                <video
                  src={activeMedia.url}
                  controls
                  playsInline
                  className="h-full w-full object-cover"
                />
              ) : (
                <img
                  src={activeMedia.url}
                  alt={pick(activeMedia.altI18n, pick(product.titleI18n))}
                  className="h-full w-full object-cover"
                />
              )
            ) : (
              <div className="flex h-full items-center justify-center text-stone-400">
                {pick(product.titleI18n)}
              </div>
            )}

            <div className="absolute top-3 start-3 flex flex-wrap gap-2">
              {effectivePrice.hasActiveDiscount && effectivePrice.discountPercent > 0 && (
                <span className="rounded-full bg-amber-600 px-3 py-1 text-xs font-extrabold text-white shadow-xs">
                  -{effectivePrice.discountPercent}%
                </span>
              )}
              {product.badgeI18n && pick(product.badgeI18n) && (
                <span className="rounded-full bg-store-primary px-3 py-1 text-xs font-bold text-white shadow-xs">
                  {pick(product.badgeI18n)}
                </span>
              )}
            </div>
          </div>

          {gallery.length > 1 && (
            <div className="flex gap-2.5 overflow-x-auto pb-1">
              {gallery.map((m, idx) => (
                <button
                  key={m.id}
                  type="button"
                  onClick={() => setActiveMediaIdx(idx)}
                  className={`relative h-20 w-20 shrink-0 overflow-hidden rounded-2xl border-2 bg-white transition-all ${
                    idx === activeMediaIdx
                      ? 'border-emerald-800 ring-2 ring-emerald-800/20'
                      : 'border-stone-200 opacity-75 hover:opacity-100'
                  }`}
                >
                  {m.mediaType === 'VIDEO' ? (
                    <div className="flex h-full w-full items-center justify-center bg-stone-900 text-white">
                      <PlayCircle className="h-7 w-7" />
                    </div>
                  ) : (
                    <img src={m.url} alt="" className="h-full w-full object-cover" />
                  )}
                </button>
              ))}
            </div>
          )}
        </div>

        {/* Right: Product Info + Variants + Actions + Quick Order */}
        <div className="space-y-5 lg:col-span-6">
          <div className="space-y-2">
            <div className="flex flex-wrap items-center gap-2">
              {product.productType === 'DIGITAL' && (
                <span className="inline-flex items-center gap-1 rounded-full bg-sky-50 px-3 py-1 text-xs font-bold text-sky-800">
                  <Download className="h-3.5 w-3.5" />
                  {tr('product.digitalBadge')}
                </span>
              )}
              {product.productType === 'SUBSCRIPTION' && (
                <span className="inline-flex items-center gap-1 rounded-full bg-violet-50 px-3 py-1 text-xs font-bold text-violet-800">
                  <Sparkles className="h-3.5 w-3.5" />
                  {tr('product.subscriptionBadge')}
                  {product.subscriptionConfig?.durationLabelI18n
                    ? ` — ${pick(product.subscriptionConfig.durationLabelI18n)}`
                    : ''}
                </span>
              )}
              {product.productType === 'BUNDLE' && (
                <span className="inline-flex items-center gap-1 rounded-full bg-amber-50 px-3 py-1 text-xs font-bold text-amber-800">
                  <Layers className="h-3.5 w-3.5" />
                  {tr('product.bundleIncludes')}
                </span>
              )}
              {Number(product.averageRating) > 0 && (
                <span className="inline-flex items-center gap-1 text-xs font-bold text-amber-600">
                  <Star className="h-4 w-4 fill-amber-500 text-amber-500" />
                  {Number(product.averageRating).toFixed(1)} ({product.reviewsCount})
                </span>
              )}
            </div>

            <h1 className="text-2xl sm:text-3xl font-extrabold text-stone-900">
              {pick(product.titleI18n)}
            </h1>

            {pick(product.shortDescriptionI18n) && (
              <p className="text-sm sm:text-base text-stone-600 leading-relaxed">
                {pick(product.shortDescriptionI18n)}
              </p>
            )}
          </div>

          {/* Dynamic Price + Stock */}
          <div className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-stone-200 bg-white p-4">
            <div className="flex items-baseline gap-3">
              <span className="text-2xl sm:text-3xl font-extrabold text-store-primary tabular-nums">
                {formatPrice(effectivePrice.effectivePrice * quantity)}
              </span>
              {effectivePrice.hasActiveDiscount && (
                <span className="text-base text-stone-400 line-through tabular-nums">
                  {formatPrice(effectivePrice.regularPrice * quantity)}
                </span>
              )}
            </div>

            <div className="flex items-center gap-2">
              {isOutOfStock ? (
                <span className="rounded-full bg-red-50 px-3 py-1 text-xs font-bold text-red-700">
                  {tr('product.outOfStock')}
                </span>
              ) : product.allowBackorders && availableStock <= 0 ? (
                <span className="rounded-full bg-amber-50 px-3 py-1 text-xs font-bold text-amber-800">
                  {tr('product.backorder')}
                </span>
              ) : (
                <span className="inline-flex items-center gap-1 rounded-full bg-emerald-50 px-3 py-1 text-xs font-bold text-emerald-800">
                  <PackageCheck className="h-3.5 w-3.5" />
                  {tr('product.inStock')}
                  {product.trackInventory ? ` (${availableStock})` : ''}
                </span>
              )}
            </div>
          </div>

          {effectivePrice.promoEndsAt && (
            <CountdownTimer
              endsAt={effectivePrice.promoEndsAt.toISOString()}
              label={tr('product.promoEndsIn')}
              locale={locale}
            />
          )}

          {/* Variant Selectors */}
          {product.hasVariants && variants.length > 0 && (
            <div className="space-y-3 rounded-2xl border border-stone-200 bg-white p-4">
              {product.variantOptions.length > 0 ? (
                product.variantOptions.map((opt) => (
                  <div key={opt.id} className="space-y-2">
                    <label className="block text-xs font-bold text-stone-700">
                      {pick(opt.nameI18n)}
                    </label>
                    <div className="flex flex-wrap gap-2">
                      {opt.values.map((val) => {
                        const isSelected = selectedOptions[opt.id] === val.value;
                        return (
                          <button
                            key={val.value}
                            type="button"
                            onClick={() => handleOptionSelect(opt.id, val.value)}
                            className={`inline-flex items-center gap-2 rounded-xl border px-3 py-2 text-xs font-bold transition-all ${
                              isSelected
                                ? 'border-emerald-800 bg-emerald-50 text-emerald-950 ring-1 ring-emerald-800'
                                : 'border-stone-200 bg-white text-stone-700 hover:bg-stone-50'
                            }`}
                          >
                            {val.colorHex && (
                              <span
                                className="h-3.5 w-3.5 rounded-full border border-stone-300"
                                style={{ backgroundColor: val.colorHex }}
                              />
                            )}
                            <span>{pick(val.labelI18n, val.value)}</span>
                          </button>
                        );
                      })}
                    </div>
                  </div>
                ))
              ) : (
                <div className="flex flex-wrap gap-2">
                  {variants.map((v) => (
                    <button
                      key={v.id}
                      type="button"
                      onClick={() => setSelectedVariantId(v.id)}
                      className={`rounded-xl border px-3.5 py-2 text-xs font-bold ${
                        selectedVariant?.id === v.id
                          ? 'border-emerald-800 bg-emerald-50 text-emerald-950'
                          : 'border-stone-200 bg-white text-stone-700'
                      }`}
                    >
                      {pick(v.titleI18n)} — {formatPrice(v.salePrice || v.regularPrice)}
                    </button>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* Bundle contents if productType === BUNDLE */}
          {bundleItems.length > 0 && (
            <div className="rounded-2xl border border-amber-200/80 bg-amber-50/40 p-4">
              <h3 className="mb-2 text-xs font-extrabold uppercase tracking-wide text-amber-900">
                {tr('product.bundleIncludes')}
              </h3>
              <ul className="space-y-1.5 text-sm text-stone-800">
                {bundleItems.map((bi) => (
                  <li key={bi.itemProduct.id} className="flex items-center gap-2">
                    <Check className="h-4 w-4 text-emerald-700" />
                    <span className="font-bold">{bi.quantity}×</span>
                    <Link
                      href={`/products/${bi.itemProduct.slug}`}
                      className="hover:text-store-primary hover:underline"
                    >
                      {pick(bi.itemProduct.titleI18n)}
                    </Link>
                  </li>
                ))}
              </ul>
            </div>
          )}

          {/* Quantity + Add to Cart + Share + WhatsApp */}
          <div className="flex flex-wrap items-center gap-2.5">
            <div className="inline-flex h-12 items-center rounded-xl border border-stone-300 bg-white">
              <button
                type="button"
                onClick={() => setQuantity((q) => Math.max(1, q - 1))}
                className="px-3 text-stone-700 hover:bg-stone-50"
              >
                <Minus className="h-4 w-4" />
              </button>
              <span className="min-w-9 text-center text-sm font-bold tabular-nums">
                {quantity}
              </span>
              <button
                type="button"
                onClick={() => setQuantity((q) => Math.min(200, q + 1))}
                className="px-3 text-stone-700 hover:bg-stone-50"
              >
                <Plus className="h-4 w-4" />
              </button>
            </div>

            {cartEnabled && (
              <button
                type="button"
                disabled={addingCart || isOutOfStock}
                onClick={handleAddToCart}
                className="btn-store-accent flex h-12 flex-1 items-center justify-center gap-2 px-5 text-sm font-extrabold shadow-sm disabled:opacity-50"
              >
                <ShoppingBag className="h-4 w-4" />
                <span>{tr('product.addToCart')}</span>
              </button>
            )}

            {waInquiryUrl && (
              <a
                href={waInquiryUrl}
                target="_blank"
                rel="noreferrer"
                className="inline-flex h-12 items-center gap-2 rounded-xl border border-emerald-700 bg-emerald-50 px-4 text-xs sm:text-sm font-bold text-emerald-900 hover:bg-emerald-100"
              >
                <MessageCircle className="h-4 w-4" />
                <span className="hidden sm:inline">{tr('product.whatsappAsk')}</span>
              </a>
            )}

            <button
              type="button"
              onClick={handleShare}
              className="inline-flex h-12 items-center gap-1.5 rounded-xl border border-stone-200 bg-white px-3.5 text-xs font-bold text-stone-700 hover:bg-stone-50"
              title={tr('product.share')}
            >
              <Share2 className="h-4 w-4" />
              {copiedShare && <Check className="h-3.5 w-3.5 text-emerald-700" />}
            </button>
          </div>

          {/* Embedded Quick Order Form */}
          {quickOrderEnabled && !isOutOfStock && (
            <QuickOrderForm
              product={product}
              selectedVariant={selectedVariant}
              quantity={quantity}
              onQuantityChange={setQuantity}
              showQuantityControl={false}
            />
          )}

          {/* SKU & Barcode metadata */}
          {(selectedVariant?.sku || product.sku || selectedVariant?.barcode || product.barcode) && (
            <div className="flex flex-wrap gap-4 text-xs text-stone-500">
              {(selectedVariant?.sku || product.sku) && (
                <span>
                  {tr('product.sku')}: <strong dir="ltr">{selectedVariant?.sku || product.sku}</strong>
                </span>
              )}
              {(selectedVariant?.barcode || product.barcode) && (
                <span>
                  Barcode: <strong dir="ltr">{selectedVariant?.barcode || product.barcode}</strong>
                </span>
              )}
            </div>
          )}
        </div>
      </div>

      {/* Frequently Bought Together */}
      {frequentlyBoughtTogether.length > 0 && (
        <section className="mt-12 rounded-3xl border border-stone-200 bg-white p-6">
          <div className="mb-4 flex flex-wrap items-center justify-between gap-4">
            <h2 className="text-lg sm:text-xl font-extrabold text-stone-900">
              {tr('product.boughtTogether')}
            </h2>
            <button
              type="button"
              disabled={addingFbt}
              onClick={handleAddFbtBundle}
              className="btn-store-primary px-5 py-2.5 text-xs sm:text-sm font-bold"
            >
              {tr('product.addSelectedBundle')} — {formatPrice(fbtTotal)}
            </button>
          </div>
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {frequentlyBoughtTogether.map((p) => {
              const checked = fbtSelectedIds.includes(p.id);
              const price = computeEffectivePrice({
                regularPrice: p.regularPrice,
                salePrice: p.salePrice,
                discountType: p.discountType,
                discountValue: p.discountValue,
                promoStartsAt: p.promoStartsAt,
                promoEndsAt: p.promoEndsAt,
              });
              const img = p.media?.find((m) => m.mediaType === 'IMAGE')?.url;
              return (
                <label
                  key={p.id}
                  className={`flex cursor-pointer items-center gap-3 rounded-2xl border p-3 ${
                    checked ? 'border-emerald-700 bg-emerald-50/40' : 'border-stone-200'
                  }`}
                >
                  <input
                    type="checkbox"
                    checked={checked}
                    onChange={(e) => {
                      setFbtSelectedIds((prev) =>
                        e.target.checked
                          ? [...prev, p.id]
                          : prev.filter((id) => id !== p.id)
                      );
                    }}
                    className="h-4 w-4 accent-emerald-800"
                  />
                  {img && (
                    <img
                      src={img}
                      alt=""
                      className="h-14 w-14 rounded-xl object-cover bg-stone-100"
                    />
                  )}
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-bold text-stone-900">
                      {pick(p.titleI18n)}
                    </p>
                    <p className="text-xs font-extrabold text-store-primary">
                      {formatPrice(price.effectivePrice)}
                    </p>
                  </div>
                </label>
              );
            })}
          </div>
        </section>
      )}

      {/* Description, Specifications & Reviews Tabs */}
      <section className="mt-12 rounded-3xl border border-stone-200 bg-white overflow-hidden">
        <div className="flex border-b border-stone-200 bg-stone-50/70">
          {(
            [
              ['desc', tr('product.description')],
              ['specs', tr('product.specs')],
              ['reviews', `${tr('product.reviews')} (${reviews.length})`],
            ] as const
          ).map(([key, label]) => (
            <button
              key={key}
              type="button"
              onClick={() => setActiveTab(key)}
              className={`px-5 py-3.5 text-xs sm:text-sm font-bold transition-colors border-b-2 ${
                activeTab === key
                  ? 'border-emerald-800 text-store-primary bg-white'
                  : 'border-transparent text-stone-600 hover:text-stone-900'
              }`}
            >
              {label}
            </button>
          ))}
        </div>

        <div className="p-6">
          {activeTab === 'desc' && (
            <div
              className="prose prose-stone max-w-none text-sm sm:text-base leading-relaxed"
              dangerouslySetInnerHTML={{
                __html: pick(product.descriptionSanitizedI18n) || pick(product.shortDescriptionI18n),
              }}
            />
          )}

          {activeTab === 'specs' && (
            <div className="divide-y divide-stone-100">
              {specsList.length === 0 ? (
                <p className="text-sm text-stone-500">—</p>
              ) : (
                specsList.map((s, idx) => (
                  <div key={idx} className="grid grid-cols-3 py-2.5 text-sm">
                    <span className="font-bold text-stone-700">{s.key}</span>
                    <span className="col-span-2 text-stone-600">{s.value}</span>
                  </div>
                ))
              )}
            </div>
          )}

          {activeTab === 'reviews' && (
            <div className="grid grid-cols-1 gap-8 lg:grid-cols-12">
              <div className="space-y-4 lg:col-span-7">
                {reviews.length === 0 ? (
                  <p className="text-sm text-stone-500">
                    {locale === 'ar' ? 'لا توجد تقييمات بعد.' : 'No reviews yet.'}
                  </p>
                ) : (
                  reviews.map((rev) => (
                    <div
                      key={rev.id}
                      className="rounded-2xl border border-stone-100 bg-stone-50/50 p-4"
                    >
                      <div className="flex items-center justify-between">
                        <span className="font-bold text-stone-900">{rev.customerName}</span>
                        <div className="flex items-center gap-0.5 text-amber-500">
                          {Array.from({ length: 5 }).map((_, idx) => (
                            <Star
                              key={idx}
                              className={`h-3.5 w-3.5 ${
                                idx < rev.rating
                                  ? 'fill-amber-500 text-amber-500'
                                  : 'text-stone-200'
                              }`}
                            />
                          ))}
                        </div>
                      </div>
                      {rev.title && (
                        <p className="mt-1 text-sm font-semibold text-stone-800">{rev.title}</p>
                      )}
                      {rev.comment && (
                        <p className="mt-1 text-sm text-stone-600">{rev.comment}</p>
                      )}
                    </div>
                  ))
                )}
              </div>

              <form
                onSubmit={handleReviewSubmit}
                className="space-y-3 rounded-2xl border border-stone-200 bg-stone-50/60 p-5 lg:col-span-5"
              >
                <h3 className="text-sm font-extrabold text-stone-900">
                  {tr('product.writeReview')}
                </h3>
                <input
                  type="text"
                  required
                  minLength={2}
                  value={revName}
                  onChange={(e) => setRevName(e.target.value)}
                  placeholder={tr('checkout.fullName')}
                  className="w-full rounded-xl border border-stone-300 bg-white px-3 py-2 text-sm"
                />
                <div className="flex items-center gap-2">
                  {[1, 2, 3, 4, 5].map((n) => (
                    <button
                      key={n}
                      type="button"
                      onClick={() => setRevRating(n)}
                      className="p-1"
                    >
                      <Star
                        className={`h-5 w-5 ${
                          n <= revRating
                            ? 'fill-amber-500 text-amber-500'
                            : 'text-stone-300'
                        }`}
                      />
                    </button>
                  ))}
                </div>
                <input
                  type="text"
                  value={revTitle}
                  onChange={(e) => setRevTitle(e.target.value)}
                  placeholder={locale === 'ar' ? 'عنوان التقييم (اختياري)' : 'Title (optional)'}
                  className="w-full rounded-xl border border-stone-300 bg-white px-3 py-2 text-sm"
                />
                <textarea
                  required
                  minLength={4}
                  rows={3}
                  value={revComment}
                  onChange={(e) => setRevComment(e.target.value)}
                  placeholder={locale === 'ar' ? 'اكتب تجربتك مع المنتج...' : 'Share your experience...'}
                  className="w-full rounded-xl border border-stone-300 bg-white px-3 py-2 text-sm"
                />
                {revFeedback && (
                  <p className="text-xs font-semibold text-emerald-800">{revFeedback}</p>
                )}
                <button
                  type="submit"
                  disabled={revSubmitting}
                  className="btn-store-primary w-full py-2.5 text-sm font-bold disabled:opacity-50"
                >
                  {tr('product.writeReview')}
                </button>
              </form>
            </div>
          )}
        </div>
      </section>

      {/* Related Products */}
      {relatedProducts.length > 0 && (
        <section className="mt-12">
          <h2 className="mb-5 text-xl font-extrabold text-stone-900">
            {tr('product.related')}
          </h2>
          <div className="grid grid-cols-2 gap-3 sm:gap-5 md:grid-cols-4">
            {relatedProducts.map((rp) => (
              <ProductCard key={rp.id} product={rp} />
            ))}
          </div>
        </section>
      )}

      {/* Sticky mobile bottom CTA */}
      {!isOutOfStock && (
        <div className="fixed inset-x-0 bottom-0 z-30 flex items-center gap-2 border-t border-stone-200 bg-white/95 p-3 backdrop-blur-md sm:hidden no-print">
          <div className="min-w-0 flex-1">
            <p className="truncate text-xs font-bold text-stone-700">
              {pick(product.titleI18n)}
            </p>
            <p className="text-sm font-extrabold text-store-primary tabular-nums">
              {formatPrice(effectivePrice.effectivePrice * quantity)}
            </p>
          </div>
          {quickOrderEnabled ? (
            <a
              href="#quick-order-form"
              className="btn-store-primary px-5 py-2.5 text-xs font-extrabold shadow-sm"
            >
              {tr('product.buyNowQuick')}
            </a>
          ) : (
            cartEnabled && (
              <button
                type="button"
                onClick={handleAddToCart}
                className="btn-store-primary px-5 py-2.5 text-xs font-extrabold shadow-sm"
              >
                {tr('product.addToCart')}
              </button>
            )
          )}
        </div>
      )}
    </div>
  );
}
