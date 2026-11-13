'use client';

import React, { useEffect, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { Filter, Loader2, Search, SlidersHorizontal } from 'lucide-react';
import { useStore } from '@/components/providers/StoreContextProvider';
import { ProductCard, type ProductCardData } from './ProductCard';
import type { I18nMap } from '@/db/schema/types';

export interface ShopCategoryOption {
  id: string;
  slug: string;
  nameI18n: I18nMap;
}

export function ShopListingClient({
  categories,
}: {
  categories: ShopCategoryOption[];
}) {
  const router = useRouter();
  const sp = useSearchParams();
  const { tr, pick, locale } = useStore();

  const [q, setQ] = useState(sp.get('q') || '');
  const [category, setCategory] = useState(sp.get('category') || '');
  const [productType, setProductType] = useState(sp.get('type') || '');
  const [flag, setFlag] = useState(sp.get('flag') || '');
  const [sort, setSort] = useState(sp.get('sort') || 'newest');
  const [page, setPage] = useState(Number(sp.get('page') || 1));

  const [items, setItems] = useState<ProductCardData[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const limit = 16;

  useEffect(() => {
    setQ(sp.get('q') || '');
    setCategory(sp.get('category') || '');
    setProductType(sp.get('type') || '');
    setFlag(sp.get('flag') || '');
    setSort(sp.get('sort') || 'newest');
    setPage(Math.max(1, Number(sp.get('page') || 1)));
  }, [sp]);

  useEffect(() => {
    let cancelled = false;
    async function load() {
      setLoading(true);
      try {
        const params = new URLSearchParams();
        if (q.trim()) params.set('q', q.trim());
        if (category) params.set('category', category);
        if (productType) params.set('type', productType);
        if (flag) params.set('flag', flag);
        if (sort) params.set('sort', sort);
        params.set('page', String(page));
        params.set('limit', String(limit));

        const res = await fetch(`/api/storefront/products?${params.toString()}`);
        if (res.ok && !cancelled) {
          const data = await res.json();
          setItems(data.items || []);
          setTotal(data.total || 0);
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    }
    load();
    return () => {
      cancelled = true;
    };
  }, [q, category, productType, flag, sort, page]);

  function updateQuery(overrides: Record<string, string | number>) {
    const params = new URLSearchParams();
    const next = {
      q,
      category,
      type: productType,
      flag,
      sort,
      page: 1,
      ...overrides,
    };
    Object.entries(next).forEach(([k, v]) => {
      if (v && !(k === 'page' && Number(v) === 1)) {
        params.set(k, String(v));
      }
    });
    router.push(`/shop${params.toString() ? `?${params.toString()}` : ''}`);
  }

  const totalPages = Math.max(1, Math.ceil(total / limit));

  return (
    <div className="mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8">
      <div className="mb-6 flex flex-col gap-4 border-b border-stone-200 pb-6 md:flex-row md:items-center md:justify-between">
        <div>
          <h1 className="text-2xl sm:text-3xl font-extrabold text-stone-900">
            {tr('nav.shop')}
          </h1>
          <p className="mt-1 text-xs sm:text-sm text-stone-500">
            {total}{' '}
            {locale === 'ar' ? 'منتج متاح' : locale === 'fr' ? 'produits' : 'products'}
          </p>
        </div>

        <form
          onSubmit={(e) => {
            e.preventDefault();
            updateQuery({ q });
          }}
          className="flex flex-wrap items-center gap-2"
        >
          <div className="relative min-w-[220px] flex-1">
            <Search className="pointer-events-none absolute top-1/2 start-3 h-4 w-4 -translate-y-1/2 text-stone-400" />
            <input
              type="search"
              value={q}
              onChange={(e) => setQ(e.target.value)}
              placeholder={tr('nav.searchPlaceholder')}
              className="w-full rounded-xl border border-stone-200 bg-white py-2 ps-9 pe-3 text-sm focus:border-emerald-700 focus:outline-none"
            />
          </div>

          <select
            value={productType}
            onChange={(e) => updateQuery({ type: e.target.value })}
            className="rounded-xl border border-stone-200 bg-white px-3 py-2 text-xs sm:text-sm font-medium text-stone-700"
          >
            <option value="">
              {locale === 'ar' ? 'كل الأنواع' : locale === 'fr' ? 'Tous types' : 'All types'}
            </option>
            <option value="PHYSICAL">
              {locale === 'ar' ? 'منتجات فيزيائية' : locale === 'fr' ? 'Physique' : 'Physical'}
            </option>
            <option value="BUNDLE">
              {locale === 'ar' ? 'باقات وعروض' : locale === 'fr' ? 'Coffrets / Packs' : 'Bundles'}
            </option>
            <option value="DIGITAL">
              {locale === 'ar' ? 'منتجات رقمية PDF' : locale === 'fr' ? 'Numérique' : 'Digital'}
            </option>
            <option value="SUBSCRIPTION">
              {locale === 'ar' ? 'اشتراكات وخدمات' : locale === 'fr' ? 'Abonnements' : 'Subscriptions'}
            </option>
          </select>

          <select
            value={sort}
            onChange={(e) => updateQuery({ sort: e.target.value })}
            className="rounded-xl border border-stone-200 bg-white px-3 py-2 text-xs sm:text-sm font-medium text-stone-700"
          >
            <option value="newest">
              {locale === 'ar' ? 'الأحدث' : locale === 'fr' ? 'Nouveautés' : 'Newest'}
            </option>
            <option value="bestselling">
              {locale === 'ar' ? 'الأكثر مبيعاً' : locale === 'fr' ? 'Meilleures ventes' : 'Best Selling'}
            </option>
            <option value="price_asc">
              {locale === 'ar' ? 'السعر: الأقل أولاً' : locale === 'fr' ? 'Prix croissant' : 'Price: Low to High'}
            </option>
            <option value="price_desc">
              {locale === 'ar' ? 'السعر: الأعلى أولاً' : locale === 'fr' ? 'Prix décroissant' : 'Price: High to Low'}
            </option>
          </select>
        </form>
      </div>

      {/* Category pills */}
      <div className="mb-6 flex items-center gap-2 overflow-x-auto pb-2">
        <SlidersHorizontal className="h-4 w-4 shrink-0 text-stone-400" />
        <button
          type="button"
          onClick={() => updateQuery({ category: '' })}
          className={`shrink-0 rounded-full border px-4 py-1.5 text-xs font-bold transition-colors ${
            !category
              ? 'border-emerald-800 bg-store-primary text-white'
              : 'border-stone-200 bg-white text-stone-700 hover:bg-stone-50'
          }`}
        >
          {tr('nav.allCategories')}
        </button>
        {categories.map((cat) => (
          <button
            key={cat.id}
            type="button"
            onClick={() => updateQuery({ category: cat.slug })}
            className={`shrink-0 rounded-full border px-4 py-1.5 text-xs font-bold transition-colors ${
              category === cat.slug
                ? 'border-emerald-800 bg-store-primary text-white'
                : 'border-stone-200 bg-white text-stone-700 hover:bg-stone-50'
            }`}
          >
            {pick(cat.nameI18n)}
          </button>
        ))}
      </div>

      {loading ? (
        <div className="flex min-h-[260px] items-center justify-center">
          <Loader2 className="h-7 w-7 animate-spin text-store-primary" />
        </div>
      ) : items.length === 0 ? (
        <div className="rounded-3xl border border-stone-200 bg-white py-16 text-center">
          <Filter className="mx-auto mb-3 h-8 w-8 text-stone-300" />
          <p className="text-sm font-semibold text-stone-600">
            {locale === 'ar'
              ? 'لم يتم العثور على منتجات مطابقة لبحثك'
              : locale === 'fr'
                ? 'Aucun produit trouvé'
                : 'No matching products found'}
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-2 gap-3 sm:gap-5 md:grid-cols-3 lg:grid-cols-4">
          {items.map((product) => (
            <ProductCard key={product.id} product={product} />
          ))}
        </div>
      )}

      {totalPages > 1 && (
        <div className="mt-8 flex justify-center gap-2">
          {Array.from({ length: totalPages }).map((_, idx) => {
            const p = idx + 1;
            return (
              <button
                key={p}
                type="button"
                onClick={() => updateQuery({ page: p })}
                className={`h-9 min-w-9 rounded-xl border px-3 text-xs font-bold ${
                  p === page
                    ? 'border-emerald-800 bg-store-primary text-white'
                    : 'border-stone-200 bg-white text-stone-700 hover:bg-stone-50'
                }`}
              >
                {p}
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}

