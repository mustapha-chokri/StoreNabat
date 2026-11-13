'use client';

import React, { useState } from 'react';
import {
  CheckCircle2,
  ChevronDown,
  ShieldCheck,
  Sparkles,
  Star,
} from 'lucide-react';
import { useStore } from '@/components/providers/StoreContextProvider';
import {
  QuickOrderForm,
  type QuickOrderProductInfo,
  type QuickOrderVariantInfo,
} from './QuickOrderForm';
import { CountdownTimer } from './CountdownTimer';
import type { I18nMap, LandingPageSection } from '@/db/schema/types';

export function LandingPageRenderer({
  landingPageId,
  sections,
  product,
  variants,
}: {
  landingPageId: string;
  sections: LandingPageSection[];
  product: (QuickOrderProductInfo & { imageUrl?: string | null }) | null;
  variants: QuickOrderVariantInfo[];
}) {
  const { pick, locale, formatPrice } = useStore();
  const [selectedVariantId, setSelectedVariantId] = useState<string | null>(
    variants[0]?.id || null
  );
  const [openFaqIdx, setOpenFaqIdx] = useState<number | null>(0);
  const [quantity, setQuantity] = useState(1);

  const enabledSections = [...sections]
    .filter((s) => s.enabled)
    .sort((a, b) => a.sortOrder - b.sortOrder);

  const selectedVariant = variants.find((v) => v.id === selectedVariantId) || null;

  return (
    <div className="space-y-12 pb-16">
      {enabledSections.map((sec) => {
        const title = pick(sec.titleI18n);
        const subtitle = pick(sec.subtitleI18n);
        const content = (sec.content || {}) as Record<string, unknown>;

        switch (sec.type) {
          case 'HERO': {
            const img = String(content.imageUrl || product?.imageUrl || '');
            const badge = pick((content.badgeI18n || {}) as I18nMap);
            return (
              <section
                key={sec.id}
                className="bg-gradient-to-br from-emerald-950 via-emerald-900 to-stone-900 text-white"
              >
                <div className="mx-auto grid max-w-6xl grid-cols-1 items-center gap-8 px-4 py-12 sm:px-6 lg:grid-cols-12 lg:py-16">
                  <div className="space-y-5 lg:col-span-7">
                    {badge && (
                      <span className="inline-flex items-center gap-1.5 rounded-full bg-amber-500/20 px-3.5 py-1 text-xs font-extrabold text-amber-300 border border-amber-400/40">
                        <Sparkles className="h-3.5 w-3.5" />
                        {badge}
                      </span>
                    )}
                    <h1 className="text-3xl sm:text-4xl lg:text-5xl font-extrabold leading-tight">
                      {title}
                    </h1>
                    {subtitle && (
                      <p className="text-sm sm:text-lg text-emerald-100/90 leading-relaxed">
                        {subtitle}
                      </p>
                    )}
                    <div className="pt-2">
                      <a
                        href="#lp-quick-order"
                        className="inline-flex items-center gap-2 rounded-2xl bg-amber-500 px-7 py-3.5 text-sm sm:text-base font-extrabold text-stone-950 shadow-xl hover:bg-amber-400"
                      >
                        {locale === 'ar'
                          ? 'اطلب الآن — الدفع عند الاستلام'
                          : locale === 'fr'
                            ? 'Commander maintenant (COD)'
                            : 'Order Now — Cash on Delivery'}
                      </a>
                    </div>
                  </div>
                  {img && (
                    <div className="lg:col-span-5">
                      <img
                        src={img}
                        alt={title}
                        className="w-full rounded-3xl border border-white/15 object-cover shadow-2xl"
                      />
                    </div>
                  )}
                </div>
              </section>
            );
          }

          case 'IMAGE_BANNER': {
            const rawImgs = Array.isArray(content.imageUrls)
              ? (content.imageUrls as string[])
              : content.imageUrl
              ? [String(content.imageUrl)]
              : [];
            const stickyCta = Boolean(content.stickyCta ?? true);
            const ctaText = pick(
              content.ctaTextI18n as I18nMap,
              locale === 'ar'
                ? 'اضغط هنا للطلب الآن — الدفع عند الاستلام'
                : locale === 'fr'
                ? 'Commander maintenant — Paiement à la livraison'
                : 'Order Now — Cash on Delivery'
            );

            return (
              <section key={sec.id} className="mx-auto w-full max-w-5xl px-0 sm:px-4">
                {rawImgs.length === 0 ? (
                  <div className="flex min-h-[220px] items-center justify-center rounded-2xl border-2 border-dashed border-stone-300 bg-stone-50 p-6 text-center text-sm text-stone-500">
                    {locale === 'ar'
                      ? 'قم برفع صورة العرض أو بنر صفحة الهبوط في لوحة التحكم'
                      : 'Upload landing page banner/infographic image in Admin'}
                  </div>
                ) : (
                  <div className="space-y-0 overflow-hidden sm:rounded-3xl shadow-sm">
                    {rawImgs.map((imgUrl, idx) => (
                      <div key={idx} className="w-full">
                        <img
                          src={imgUrl}
                          alt={title || `Banner ${idx + 1}`}
                          className="h-auto w-full object-cover block"
                          loading="lazy"
                        />
                      </div>
                    ))}
                  </div>
                )}

                {stickyCta && (
                  <div className="sticky bottom-4 z-30 mx-auto mt-4 max-w-md px-4 text-center">
                    <a
                      href="#lp-quick-order"
                      className="flex w-full items-center justify-center gap-2 rounded-2xl bg-gradient-to-r from-amber-500 to-amber-600 px-6 py-3.5 text-sm sm:text-base font-black text-stone-950 shadow-2xl transition-transform hover:scale-[1.02] active:scale-[0.98] border border-amber-300"
                    >
                      <Sparkles className="h-5 w-5 fill-stone-950" />
                      <span>{ctaText}</span>
                    </a>
                  </div>
                )}
              </section>
            );
          }

          case 'PRODUCT_PRESENTATION':
          case 'PROMO_OFFER':
            return (
              <section key={sec.id} className="mx-auto max-w-5xl px-4 sm:px-6">
                <div className="rounded-3xl border border-emerald-900/15 bg-white p-6 sm:p-10 shadow-sm text-center space-y-3">
                  <h2 className="text-2xl sm:text-3xl font-extrabold text-stone-900">
                    {title}
                  </h2>
                  {subtitle && <p className="text-sm sm:text-base text-stone-600">{subtitle}</p>}
                  {typeof content.bodyI18n === 'object' && content.bodyI18n !== null && (
                    <p className="mx-auto max-w-3xl text-sm text-stone-600">
                      {pick(content.bodyI18n as I18nMap)}
                    </p>
                  )}
                </div>
              </section>
            );

          case 'BENEFITS': {
            const items = Array.isArray(content.items)
              ? (content.items as Array<{ titleI18n?: I18nMap; descI18n?: I18nMap }>)
              : [];
            return (
              <section key={sec.id} className="mx-auto max-w-6xl px-4 sm:px-6">
                {title && (
                  <h2 className="mb-6 text-center text-2xl sm:text-3xl font-extrabold text-stone-900">
                    {title}
                  </h2>
                )}
                <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
                  {items.map((item, idx) => (
                    <div
                      key={idx}
                      className="rounded-2xl border border-stone-200 bg-white p-6 shadow-2xs"
                    >
                      <CheckCircle2 className="mb-3 h-7 w-7 text-store-primary" />
                      <h3 className="text-base font-bold text-stone-900">
                        {pick(item.titleI18n)}
                      </h3>
                      <p className="mt-1.5 text-sm text-stone-600 leading-relaxed">
                        {pick(item.descI18n)}
                      </p>
                    </div>
                  ))}
                </div>
              </section>
            );
          }

          case 'GALLERY_VIDEO': {
            const mediaList = Array.isArray(content.mediaUrls)
              ? (content.mediaUrls as string[])
              : [];
            const videoUrl = typeof content.videoUrl === 'string' ? content.videoUrl : null;
            return (
              <section key={sec.id} className="mx-auto max-w-5xl px-4 sm:px-6 space-y-5">
                {title && (
                  <h2 className="text-center text-2xl font-extrabold text-stone-900">{title}</h2>
                )}
                {videoUrl && (
                  <video
                    src={videoUrl}
                    controls
                    className="w-full rounded-3xl border border-stone-200 shadow-sm"
                  />
                )}
                {mediaList.length > 0 && (
                  <div className="grid grid-cols-2 gap-4 sm:grid-cols-3">
                    {mediaList.map((url, idx) => (
                      <img
                        key={idx}
                        src={url}
                        alt=""
                        className="aspect-square w-full rounded-2xl object-cover border border-stone-200"
                      />
                    ))}
                  </div>
                )}
              </section>
            );
          }

          case 'COUNTDOWN':
            return (
              <section key={sec.id} className="mx-auto max-w-3xl px-4 sm:px-6 text-center">
                <div className="inline-flex flex-col items-center gap-3 rounded-3xl border border-amber-200 bg-amber-50/70 px-6 py-5 w-full">
                  {title && (
                    <h2 className="text-lg sm:text-xl font-extrabold text-amber-950">{title}</h2>
                  )}
                  {typeof content.endsAt === 'string' && (
                    <CountdownTimer endsAt={content.endsAt} locale={locale} />
                  )}
                </div>
              </section>
            );

          case 'PRICING_BUNDLES': {
            const tiers = Array.isArray(content.tiers)
              ? (content.tiers as Array<{ qty: number; labelI18n?: I18nMap; price?: number }>)
              : [];
            return (
              <section key={sec.id} className="mx-auto max-w-4xl px-4 sm:px-6">
                {title && (
                  <h2 className="mb-5 text-center text-2xl font-extrabold text-stone-900">
                    {title}
                  </h2>
                )}
                <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
                  {tiers.map((tier, idx) => (
                    <button
                      key={idx}
                      type="button"
                      onClick={() => {
                        setQuantity(tier.qty || 1);
                        document
                          .getElementById('lp-quick-order')
                          ?.scrollIntoView({ behavior: 'smooth' });
                      }}
                      className={`rounded-2xl border-2 p-5 text-center transition-all ${
                        quantity === tier.qty
                          ? 'border-emerald-800 bg-emerald-50'
                          : 'border-stone-200 bg-white hover:border-emerald-600'
                      }`}
                    >
                      <div className="text-lg font-extrabold text-stone-900">
                        {pick(tier.labelI18n, `${tier.qty}×`)}
                      </div>
                      {tier.price !== undefined && (
                        <div className="mt-1 text-xl font-black text-store-primary">
                          {formatPrice(tier.price)}
                        </div>
                      )}
                    </button>
                  ))}
                </div>
              </section>
            );
          }

          case 'TESTIMONIALS': {
            const items = Array.isArray(content.items)
              ? (content.items as Array<{ name?: string; text?: string; rating?: number }>)
              : [];
            return (
              <section key={sec.id} className="mx-auto max-w-6xl px-4 sm:px-6">
                {title && (
                  <h2 className="mb-6 text-center text-2xl font-extrabold text-stone-900">
                    {title}
                  </h2>
                )}
                <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
                  {items.map((item, idx) => (
                    <div
                      key={idx}
                      className="rounded-2xl border border-stone-200 bg-white p-5 space-y-2"
                    >
                      <div className="flex gap-0.5 text-amber-500">
                        {Array.from({ length: item.rating || 5 }).map((_, i) => (
                          <Star key={i} className="h-4 w-4 fill-amber-500" />
                        ))}
                      </div>
                      <p className="text-sm text-stone-600">{item.text}</p>
                      <p className="text-xs font-bold text-stone-900">{item.name}</p>
                    </div>
                  ))}
                </div>
              </section>
            );
          }

          case 'FAQ': {
            const items = Array.isArray(content.items)
              ? (content.items as Array<{ qI18n?: I18nMap; aI18n?: I18nMap }>)
              : [];
            return (
              <section key={sec.id} className="mx-auto max-w-3xl px-4 sm:px-6">
                {title && (
                  <h2 className="mb-5 text-center text-2xl font-extrabold text-stone-900">
                    {title}
                  </h2>
                )}
                <div className="space-y-2.5">
                  {items.map((faq, idx) => {
                    const isOpen = openFaqIdx === idx;
                    return (
                      <div
                        key={idx}
                        className="overflow-hidden rounded-2xl border border-stone-200 bg-white"
                      >
                        <button
                          type="button"
                          onClick={() => setOpenFaqIdx(isOpen ? null : idx)}
                          className="flex w-full items-center justify-between px-5 py-4 text-start text-sm font-bold text-stone-900"
                        >
                          <span>{pick(faq.qI18n)}</span>
                          <ChevronDown
                            className={`h-4 w-4 transition-transform ${
                              isOpen ? 'rotate-180' : ''
                            }`}
                          />
                        </button>
                        {isOpen && (
                          <div className="border-t border-stone-100 px-5 py-3.5 text-sm text-stone-600">
                            {pick(faq.aI18n)}
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              </section>
            );
          }

          case 'QUICK_ORDER_FORM':
            if (!product) return null;
            return (
              <section
                key={sec.id}
                id="lp-quick-order"
                className="mx-auto max-w-2xl px-4 sm:px-6 space-y-4"
              >
                {title && (
                  <div className="text-center space-y-1">
                    <h2 className="text-2xl font-extrabold text-stone-900">{title}</h2>
                    {variants.length > 0 && (
                      <div className="flex flex-wrap justify-center gap-2 pt-2">
                        {variants.map((v) => (
                          <button
                            key={v.id}
                            type="button"
                            onClick={() => setSelectedVariantId(v.id)}
                            className={`rounded-xl border px-3 py-1.5 text-xs font-bold ${
                              selectedVariant?.id === v.id
                                ? 'border-emerald-800 bg-emerald-50 text-emerald-950'
                                : 'border-stone-200 bg-white'
                            }`}
                          >
                            {pick(v.titleI18n)} — {formatPrice(v.salePrice || v.regularPrice)}
                          </button>
                        ))}
                      </div>
                    )}
                  </div>
                )}
                <QuickOrderForm
                  product={product}
                  selectedVariant={selectedVariant}
                  quantity={quantity}
                  onQuantityChange={setQuantity}
                  checkoutType="LANDING_PAGE"
                  landingPageId={landingPageId}
                  anchorId="lp-order-box"
                />
                <div className="flex items-center justify-center gap-2 text-xs text-stone-500">
                  <ShieldCheck className="h-4 w-4 text-emerald-700" />
                  <span>{pick(product.titleI18n)}</span>
                </div>
              </section>
            );

          default:
            return null;
        }
      })}
    </div>
  );
}

