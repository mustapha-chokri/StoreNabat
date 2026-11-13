'use client';

import React, { useEffect, useState } from 'react';
import Link from 'next/link';
import { ArrowLeft, ArrowRight, ChevronLeft, ChevronRight, Sparkles } from 'lucide-react';
import { useStore } from '@/components/providers/StoreContextProvider';
import type { I18nMap } from '@/db/schema/types';

export interface HeroSlideItem {
  id: string;
  badgeI18n: I18nMap;
  titleI18n: I18nMap;
  subtitleI18n: I18nMap;
  ctaTextI18n: I18nMap;
  ctaUrl: string;
  desktopImageUrl: string;
  mobileImageUrl: string | null;
}

export function HeroSlider({ slides }: { slides: HeroSlideItem[] }) {
  const { pick, direction } = useStore();
  const [index, setIndex] = useState(0);

  useEffect(() => {
    if (slides.length <= 1) return;
    const timer = setInterval(() => {
      setIndex((i) => (i + 1) % slides.length);
    }, 6000);
    return () => clearInterval(timer);
  }, [slides.length]);

  if (slides.length === 0) return null;

  const slide = slides[index % slides.length];
  const badge = pick(slide.badgeI18n);
  const title = pick(slide.titleI18n);
  const subtitle = pick(slide.subtitleI18n);
  const ctaText = pick(slide.ctaTextI18n, 'Shop Now');
  const CtaArrow = direction === 'rtl' ? ArrowLeft : ArrowRight;

  return (
    <section className="relative mx-auto max-w-7xl px-4 pt-4 sm:px-6 lg:px-8">
      <div className="relative overflow-hidden rounded-3xl border border-stone-200/80 bg-emerald-950 shadow-xl">
        <div className="relative min-h-[340px] sm:min-h-[420px] lg:min-h-[480px]">
          <picture>
            {slide.mobileImageUrl && (
              <source media="(max-width: 640px)" srcSet={slide.mobileImageUrl} />
            )}
            <img
              src={slide.desktopImageUrl}
              alt={title}
              className="absolute inset-0 h-full w-full object-cover opacity-90"
            />
          </picture>
          <div className="absolute inset-0 bg-gradient-to-t from-black/75 via-black/35 to-black/10 sm:bg-gradient-to-r sm:from-black/75 sm:via-black/40 sm:to-transparent rtl:sm:bg-gradient-to-l" />

          <div className="relative z-10 flex h-full min-h-[340px] sm:min-h-[420px] lg:min-h-[480px] max-w-2xl flex-col justify-center p-6 sm:p-10 lg:p-14 text-white">
            {badge && (
              <span className="mb-3 inline-flex w-fit items-center gap-1.5 rounded-full border border-amber-400/50 bg-amber-500/20 px-3 py-1 text-xs font-bold text-amber-200 backdrop-blur-xs">
                <Sparkles className="h-3.5 w-3.5" />
                {badge}
              </span>
            )}
            <h1 className="text-2xl sm:text-4xl lg:text-5xl font-extrabold leading-tight tracking-tight">
              {title}
            </h1>
            {subtitle && (
              <p className="mt-3 max-w-xl text-sm sm:text-base text-stone-200 leading-relaxed">
                {subtitle}
              </p>
            )}
            <div className="mt-6 flex flex-wrap items-center gap-3">
              <Link
                href={slide.ctaUrl || '/shop'}
                className="inline-flex items-center gap-2 rounded-xl bg-amber-500 px-6 py-3 text-sm sm:text-base font-extrabold text-stone-950 shadow-lg transition-transform hover:scale-[1.02] hover:bg-amber-400"
              >
                <span>{ctaText}</span>
                <CtaArrow className="h-4 w-4" />
              </Link>
            </div>
          </div>
        </div>

        {slides.length > 1 && (
          <>
            <button
              type="button"
              onClick={() => setIndex((i) => (i - 1 + slides.length) % slides.length)}
              className="absolute start-3 top-1/2 z-20 -translate-y-1/2 rounded-full bg-white/85 p-2 text-stone-900 shadow-md hover:bg-white"
              aria-label="Previous slide"
            >
              {direction === 'rtl' ? (
                <ChevronRight className="h-4 w-4" />
              ) : (
                <ChevronLeft className="h-4 w-4" />
              )}
            </button>
            <button
              type="button"
              onClick={() => setIndex((i) => (i + 1) % slides.length)}
              className="absolute end-3 top-1/2 z-20 -translate-y-1/2 rounded-full bg-white/85 p-2 text-stone-900 shadow-md hover:bg-white"
              aria-label="Next slide"
            >
              {direction === 'rtl' ? (
                <ChevronLeft className="h-4 w-4" />
              ) : (
                <ChevronRight className="h-4 w-4" />
              )}
            </button>

            <div className="absolute bottom-4 inset-x-0 z-20 flex justify-center gap-2">
              {slides.map((s, idx) => (
                <button
                  key={s.id}
                  type="button"
                  onClick={() => setIndex(idx)}
                  className={`h-2 rounded-full transition-all ${
                    idx === index % slides.length
                      ? 'w-7 bg-amber-400'
                      : 'w-2 bg-white/50 hover:bg-white/80'
                  }`}
                  aria-label={`Slide ${idx + 1}`}
                />
              ))}
            </div>
          </>
        )}
      </div>
    </section>
  );
}

