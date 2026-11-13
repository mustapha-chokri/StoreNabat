'use client';

import React from 'react';
import Link from 'next/link';
import {
  ArrowLeft,
  ArrowRight,
  Banknote,
  MessageCircle,
  ShieldCheck,
  Star,
  Truck,
} from 'lucide-react';
import { useStore } from '@/components/providers/StoreContextProvider';
import { HeroSlider, type HeroSlideItem } from './HeroSlider';
import { ProductCard, type ProductCardData } from './ProductCard';
import type { I18nMap } from '@/db/schema/types';

export interface HomepageSectionData {
  id: string;
  sectionType: string;
  titleI18n: I18nMap;
  subtitleI18n: I18nMap;
  config: Record<string, unknown>;
}

export interface CategoryCardData {
  id: string;
  slug: string;
  nameI18n: I18nMap;
  descriptionI18n: I18nMap;
  imageUrl: string | null;
}

export interface PublicReviewCardData {
  id: string;
  customerName: string;
  rating: number;
  title: string | null;
  comment: string | null;
  isVerifiedPurchase: boolean;
  productTitleI18n: I18nMap;
  productSlug: string;
}

export function HomepageSections({
  sections,
  slides,
  categories,
  featuredProducts,
  promoProducts,
  bestSellers,
  newArrivals,
  reviews,
}: {
  sections: HomepageSectionData[];
  slides: HeroSlideItem[];
  categories: CategoryCardData[];
  featuredProducts: ProductCardData[];
  promoProducts: ProductCardData[];
  bestSellers: ProductCardData[];
  newArrivals: ProductCardData[];
  reviews: PublicReviewCardData[];
}) {
  const { tr, pick, direction, locale } = useStore();
  const ArrowIcon = direction === 'rtl' ? ArrowLeft : ArrowRight;

  return (
    <div className="space-y-12 pb-10">
      {sections.map((section) => {
        const title = pick(section.titleI18n);
        const subtitle = pick(section.subtitleI18n);
        const limit = Number(section.config?.limit || 8);

        switch (section.sectionType) {
          case 'HERO_SLIDER':
            return <HeroSlider key={section.id} slides={slides} />;

          case 'TRUST_BADGES':
            return (
              <section key={section.id} className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
                <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
                  {[
                    { icon: Banknote, t: tr('trust.cod'), d: tr('trust.codDesc') },
                    { icon: Truck, t: tr('trust.shipping'), d: tr('trust.shippingDesc') },
                    { icon: ShieldCheck, t: tr('trust.quality'), d: tr('trust.qualityDesc') },
                    { icon: MessageCircle, t: tr('trust.support'), d: tr('trust.supportDesc') },
                  ].map((item, idx) => (
                    <div
                      key={idx}
                      className="flex items-start gap-3 rounded-2xl border border-stone-200/80 bg-white p-4 shadow-2xs"
                    >
                      <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-emerald-50 text-store-primary">
                        <item.icon className="h-5 w-5" />
                      </div>
                      <div>
                        <h3 className="text-sm font-bold text-stone-900">{item.t}</h3>
                        <p className="mt-0.5 text-xs text-stone-500">{item.d}</p>
                      </div>
                    </div>
                  ))}
                </div>
              </section>
            );

          case 'FEATURED_CATEGORIES':
            if (categories.length === 0) return null;
            return (
              <section key={section.id} className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
                <div className="mb-6 flex items-end justify-between gap-4">
                  <div>
                    <h2 className="text-xl sm:text-2xl font-extrabold text-stone-900">
                      {title}
                    </h2>
                    {subtitle && (
                      <p className="mt-1 text-xs sm:text-sm text-stone-500">{subtitle}</p>
                    )}
                  </div>
                  <Link
                    href="/shop"
                    className="inline-flex items-center gap-1 text-xs sm:text-sm font-bold text-store-primary hover:underline"
                  >
                    <span>{tr('nav.allCategories')}</span>
                    <ArrowIcon className="h-4 w-4" />
                  </Link>
                </div>

                <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-5">
                  {categories.slice(0, limit).map((cat) => (
                    <Link
                      key={cat.id}
                      href={`/shop?category=${encodeURIComponent(cat.slug)}`}
                      className="group overflow-hidden rounded-2xl border border-stone-200/80 bg-white p-3 text-center transition-all hover:border-emerald-700 hover:shadow-md"
                    >
                      <div className="mx-auto mb-3 aspect-square w-full max-w-[130px] overflow-hidden rounded-xl bg-stone-100">
                        {cat.imageUrl ? (
                          <img
                            src={cat.imageUrl}
                            alt={pick(cat.nameI18n)}
                            className="h-full w-full object-cover transition-transform duration-300 group-hover:scale-105"
                          />
                        ) : (
                          <div className="flex h-full items-center justify-center text-xs font-bold text-emerald-800">
                            {pick(cat.nameI18n)}
                          </div>
                        )}
                      </div>
                      <h3 className="text-xs sm:text-sm font-bold text-stone-900 group-hover:text-store-primary">
                        {pick(cat.nameI18n)}
                      </h3>
                    </Link>
                  ))}
                </div>
              </section>
            );

          case 'FEATURED_PRODUCTS':
          case 'PROMO_OFFERS':
          case 'BEST_SELLERS':
          case 'NEW_ARRIVALS': {
            const list =
              section.sectionType === 'PROMO_OFFERS'
                ? promoProducts
                : section.sectionType === 'BEST_SELLERS'
                  ? bestSellers
                  : section.sectionType === 'NEW_ARRIVALS'
                    ? newArrivals
                    : featuredProducts;
            if (list.length === 0) return null;

            const shopHref =
              section.sectionType === 'BEST_SELLERS'
                ? '/shop?flag=bestSeller&sort=bestselling'
                : section.sectionType === 'NEW_ARRIVALS'
                  ? '/shop?flag=newArrival'
                  : section.sectionType === 'FEATURED_PRODUCTS'
                    ? '/shop?flag=featured'
                    : '/shop';

            return (
              <section key={section.id} className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
                <div className="mb-6 flex items-end justify-between gap-4">
                  <div>
                    <h2 className="text-xl sm:text-2xl font-extrabold text-stone-900">
                      {title}
                    </h2>
                    {subtitle && (
                      <p className="mt-1 text-xs sm:text-sm text-stone-500">{subtitle}</p>
                    )}
                  </div>
                  <Link
                    href={shopHref}
                    className="inline-flex items-center gap-1 text-xs sm:text-sm font-bold text-store-primary hover:underline"
                  >
                    <span>{tr('nav.shop')}</span>
                    <ArrowIcon className="h-4 w-4" />
                  </Link>
                </div>

                <div className="grid grid-cols-2 gap-3 sm:gap-5 md:grid-cols-3 lg:grid-cols-4">
                  {list.slice(0, limit).map((product) => (
                    <ProductCard key={product.id} product={product} />
                  ))}
                </div>
              </section>
            );
          }

          case 'CUSTOMER_REVIEWS':
            if (reviews.length === 0) return null;
            return (
              <section key={section.id} className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
                <div className="mb-6">
                  <h2 className="text-xl sm:text-2xl font-extrabold text-stone-900">
                    {title}
                  </h2>
                  {subtitle && (
                    <p className="mt-1 text-xs sm:text-sm text-stone-500">{subtitle}</p>
                  )}
                </div>

                <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
                  {reviews.slice(0, 6).map((rev) => (
                    <div
                      key={rev.id}
                      className="flex flex-col rounded-2xl border border-stone-200/80 bg-white p-5 shadow-2xs"
                    >
                      <div className="mb-2 flex items-center gap-1 text-amber-500">
                        {Array.from({ length: 5 }).map((_, i) => (
                          <Star
                            key={i}
                            className={`h-4 w-4 ${
                              i < rev.rating ? 'fill-amber-500 text-amber-500' : 'text-stone-200'
                            }`}
                          />
                        ))}
                      </div>
                      {rev.title && (
                        <h3 className="text-sm font-bold text-stone-900">{rev.title}</h3>
                      )}
                      {rev.comment && (
                        <p className="mt-1 text-xs sm:text-sm leading-relaxed text-stone-600">
                          {rev.comment}
                        </p>
                      )}
                      <div className="mt-auto pt-4 flex items-center justify-between border-t border-stone-100 text-xs">
                        <span className="font-bold text-stone-800">{rev.customerName}</span>
                        <Link
                          href={`/products/${rev.productSlug}`}
                          className="truncate max-w-[160px] text-store-primary hover:underline"
                        >
                          {pick(rev.productTitleI18n)}
                        </Link>
                      </div>
                    </div>
                  ))}
                </div>
              </section>
            );

          case 'CUSTOM_CONTENT': {
            const bodyMap = (section.config?.bodyI18n || {}) as I18nMap;
            const ctaUrl = typeof section.config?.ctaUrl === 'string' ? section.config.ctaUrl : null;
            const ctaTextMap = (section.config?.ctaTextI18n || {}) as I18nMap;
            return (
              <section key={section.id} className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
                <div className="rounded-3xl border border-emerald-900/15 bg-emerald-950 p-6 sm:p-10 text-white shadow-lg">
                  <h2 className="text-xl sm:text-2xl font-extrabold">{title}</h2>
                  {pick(bodyMap) && (
                    <p className="mt-2 max-w-3xl text-sm sm:text-base text-emerald-100">
                      {pick(bodyMap)}
                    </p>
                  )}
                  {ctaUrl && (
                    <Link
                      href={ctaUrl}
                      className="mt-5 inline-flex items-center gap-2 rounded-xl bg-amber-500 px-5 py-2.5 text-sm font-bold text-stone-950 hover:bg-amber-400"
                    >
                      <span>{pick(ctaTextMap, locale === 'ar' ? 'اكتشف المزيد' : 'Discover')}</span>
                      <ArrowIcon className="h-4 w-4" />
                    </Link>
                  )}
                </div>
              </section>
            );
          }

          default:
            return null;
        }
      })}
    </div>
  );
}

