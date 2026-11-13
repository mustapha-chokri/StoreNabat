'use client';

import React, { useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import {
  DndContext,
  closestCenter,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
  type DragEndEvent,
} from '@dnd-kit/core';
import {
  arrayMove,
  SortableContext,
  sortableKeyboardCoordinates,
  useSortable,
  verticalListSortingStrategy,
} from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import {
  Copy,
  ExternalLink,
  GripVertical,
  Loader2,
  Monitor,
  Plus,
  Smartphone,
  Trash2,
  X,
} from 'lucide-react';
import { AdminShell } from '@/components/admin/AdminShell';
import { useStore } from '@/components/providers/StoreContextProvider';
import { LandingPageRenderer } from '@/components/storefront/LandingPageRenderer';
import type { I18nMap, LandingPageSection, LandingSectionType } from '@/db/schema/types';

interface AdminLandingPage {
  id: string;
  productId: string | null;
  slug: string;
  titleI18n: I18nMap;
  isPublished: boolean;
  showHeader: boolean;
  showFooter: boolean;
  sections: LandingPageSection[];
  seoI18n: Record<string, { metaTitle?: string; metaDescription?: string; ogImage?: string }>;
  customPixels: {
    metaPixelId?: string;
    tiktokPixelId?: string;
    ga4MeasurementId?: string;
    gtmContainerId?: string;
  };
  viewsCount: number;
  ordersCount: number;
}

interface SimpleProduct {
  id: string;
  slug: string;
  productType: string;
  requiresShipping: boolean;
  titleI18n: I18nMap;
  regularPrice: string;
  salePrice: string | null;
  discountType: string | null;
  discountValue: string | null;
  promoStartsAt: string | null;
  promoEndsAt: string | null;
  shippingConfig: { freeShipping?: boolean; extraShippingFee?: number };
  media: Array<{ url: string; mediaType: string }>;
  variants: Array<{ id: string; titleI18n: I18nMap; regularPrice: string; salePrice: string | null }>;
}

const SECTION_TYPES: LandingSectionType[] = [
  'HERO',
  'PRODUCT_PRESENTATION',
  'BENEFITS',
  'GALLERY_VIDEO',
  'TESTIMONIALS',
  'FAQ',
  'PROMO_OFFER',
  'COUNTDOWN',
  'PRICING_BUNDLES',
  'QUICK_ORDER_FORM',
];

function SortableSectionCard({
  sec,
  selected,
  onSelect,
  onToggle,
  onDelete,
  pick,
}: {
  sec: LandingPageSection;
  selected: boolean;
  onSelect: () => void;
  onToggle: () => void;
  onDelete: () => void;
  pick: (m?: I18nMap, fallback?: string) => string;
}) {
  const { attributes, listeners, setNodeRef, transform, transition } = useSortable({
    id: sec.id,
  });

  return (
    <div
      ref={setNodeRef}
      style={{ transform: CSS.Transform.toString(transform), transition }}
      className={`flex items-center justify-between gap-2 rounded-xl border p-2.5 text-xs ${
        selected
          ? 'border-emerald-800 bg-emerald-50/70'
          : 'border-stone-200 bg-white'
      }`}
    >
      <div className="flex items-center gap-2 min-w-0 flex-1">
        <button
          type="button"
          {...attributes}
          {...listeners}
          className="cursor-grab text-stone-400 hover:text-stone-700"
        >
          <GripVertical className="h-4 w-4" />
        </button>
        <button
          type="button"
          onClick={onSelect}
          className="min-w-0 flex-1 text-start"
        >
          <p className="font-extrabold text-stone-900 truncate">{sec.type}</p>
          <p className="truncate text-[11px] text-stone-500">
            {pick(sec.titleI18n, sec.id)}
          </p>
        </button>
      </div>
      <div className="flex items-center gap-1.5">
        <input
          type="checkbox"
          checked={sec.enabled}
          onChange={onToggle}
          title="Enable/Disable"
        />
        <button
          type="button"
          onClick={onDelete}
          className="p-1 text-stone-400 hover:text-red-600"
        >
          <Trash2 className="h-3.5 w-3.5" />
        </button>
      </div>
    </div>
  );
}

export default function AdminLandingPagesPage() {
  const { locale, pick } = useStore();
  const ar = locale === 'ar';

  const [pages, setPages] = useState<AdminLandingPage[]>([]);
  const [products, setProducts] = useState<SimpleProduct[]>([]);
  const [loading, setLoading] = useState(true);
  const [editing, setEditing] = useState<AdminLandingPage | null>(null);
  const [selectedSecId, setSelectedSecId] = useState<string | null>(null);
  const [previewMode, setPreviewMode] = useState<'desktop' | 'mobile'>('mobile');
  const [saving, setSaving] = useState(false);

  const sensors = useSensors(
    useSensor(PointerSensor),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates })
  );

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const [lpRes, pRes] = await Promise.all([
        fetch('/api/admin/landing-pages'),
        fetch('/api/admin/products'),
      ]);
      if (lpRes.ok) {
        const d = await lpRes.json();
        setPages(d.landingPages || []);
      }
      if (pRes.ok) {
        const pd = await pRes.json();
        setProducts(pd.products || []);
      }
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  function startNew() {
    const firstProdId = products[0]?.id || null;
    setEditing({
      id: '',
      productId: firstProdId,
      slug: `offer-${Date.now().toString().slice(-4)}`,
      titleI18n: { ar: 'عرض خاص جديد', fr: 'Nouvelle Offre', en: 'New Special Offer' },
      isPublished: true,
      showHeader: false,
      showFooter: true,
      sections: [
        {
          id: `sec-hero-${Date.now()}`,
          type: 'HERO',
          enabled: true,
          sortOrder: 0,
          titleI18n: { ar: 'عنوان العرض الرئيسي', fr: 'Titre de l’offre', en: 'Hero Offer Title' },
          subtitleI18n: { ar: 'توصيل سريع والدفع عند الاستلام', fr: 'Livraison rapide COD', en: 'Fast COD shipping' },
          content: {},
        },
        {
          id: `sec-order-${Date.now() + 1}`,
          type: 'QUICK_ORDER_FORM',
          enabled: true,
          sortOrder: 1,
          titleI18n: { ar: 'اطلب الآن', fr: 'Commander', en: 'Order Now' },
          content: {},
        },
      ],
      seoI18n: {},
      customPixels: {},
      viewsCount: 0,
      ordersCount: 0,
    });
    setSelectedSecId(null);
  }

  function handleDragEnd(ev: DragEndEvent) {
    if (!editing || !ev.over || ev.active.id === ev.over.id) return;
    const activeId = ev.active.id;
    const overId = ev.over.id;
    const oldIdx = editing.sections.findIndex((s) => s.id === activeId);
    const newIdx = editing.sections.findIndex((s) => s.id === overId);
    if (oldIdx < 0 || newIdx < 0) return;
    const reordered = arrayMove(editing.sections, oldIdx, newIdx).map((s, i) => ({
      ...s,
      sortOrder: i,
    }));
    setEditing({ ...editing, sections: reordered });
  }

  function addSection(type: LandingSectionType) {
    if (!editing) return;
    const id = `sec-${type.toLowerCase()}-${Date.now()}`;
    const newSec: LandingPageSection = {
      id,
      type,
      enabled: true,
      sortOrder: editing.sections.length,
      titleI18n: { ar: type, fr: type, en: type },
      subtitleI18n: { ar: '', fr: '', en: '' },
      content:
        type === 'FAQ'
          ? { items: [{ qI18n: { ar: 'سؤال؟' }, aI18n: { ar: 'جواب' } }] }
          : type === 'BENEFITS'
            ? { items: [{ titleI18n: { ar: 'ميزة 1' }, descI18n: { ar: 'وصف' } }] }
            : type === 'COUNTDOWN'
              ? { endsAt: new Date(Date.now() + 86400000 * 3).toISOString() }
              : {},
    };
    setEditing({ ...editing, sections: [...editing.sections, newSec] });
    setSelectedSecId(id);
  }

  async function savePage() {
    if (!editing) return;
    setSaving(true);
    try {
      const payload = {
        ...(editing.id ? { id: editing.id } : {}),
        productId: editing.productId || null,
        slug: editing.slug,
        titleI18n: editing.titleI18n,
        isPublished: editing.isPublished,
        showHeader: editing.showHeader,
        showFooter: editing.showFooter,
        sections: editing.sections,
        seoI18n: editing.seoI18n,
        customPixels: editing.customPixels,
      };
      const res = await fetch('/api/admin/landing-pages', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });
      if (res.ok) {
        setEditing(null);
        await load();
      }
    } finally {
      setSaving(false);
    }
  }

  async function duplicatePage(id: string) {
    const res = await fetch('/api/admin/landing-pages', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action: 'DUPLICATE', sourceId: id }),
    });
    if (res.ok) await load();
  }

  async function deletePage(id: string) {
    if (!confirm(ar ? 'حذف صفحة الهبوط؟' : 'Delete landing page?')) return;
    const res = await fetch(`/api/admin/landing-pages?id=${encodeURIComponent(id)}`, {
      method: 'DELETE',
    });
    if (res.ok) await load();
  }

  const activeSection = editing?.sections.find((s) => s.id === selectedSecId) || null;
  const linkedProduct = products.find((p) => p.id === editing?.productId) || null;

  return (
    <AdminShell>
      {!editing ? (
        <div className="space-y-4">
          <div className="flex items-center justify-between rounded-2xl border border-stone-200 bg-white p-4">
            <h1 className="text-base font-extrabold">
              {ar ? 'منشئ صفحات الهبوط (Landing Pages)' : 'Landing Page Builder'}
            </h1>
            <button
              type="button"
              onClick={startNew}
              className="btn-store-primary inline-flex items-center gap-2 px-4 py-2 text-xs font-extrabold"
            >
              <Plus className="h-4 w-4" />
              <span>{ar ? 'صفحة هبوط جديدة' : 'New Landing Page'}</span>
            </button>
          </div>

          {loading ? (
            <div className="flex justify-center py-16">
              <Loader2 className="h-6 w-6 animate-spin text-store-primary" />
            </div>
          ) : (
            <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-3">
              {pages.map((lp) => (
                <div
                  key={lp.id}
                  className="rounded-2xl border border-stone-200 bg-white p-5 space-y-3"
                >
                  <div className="flex items-start justify-between gap-2">
                    <div>
                      <h2 className="font-bold text-stone-900">{pick(lp.titleI18n)}</h2>
                      <p dir="ltr" className="text-xs text-stone-400">
                        /lp/{lp.slug}
                      </p>
                    </div>
                    <span
                      className={`rounded-full px-2.5 py-0.5 text-[11px] font-bold ${
                        lp.isPublished
                          ? 'bg-emerald-50 text-emerald-900'
                          : 'bg-stone-100 text-stone-500'
                      }`}
                    >
                      {lp.isPublished ? (ar ? 'منشورة' : 'Live') : ar ? 'مسودة' : 'Draft'}
                    </span>
                  </div>

                  <div className="flex gap-4 text-xs text-stone-500">
                    <span>{lp.viewsCount} views</span>
                    <span>{lp.ordersCount} orders</span>
                  </div>

                  <div className="flex flex-wrap gap-2 pt-2 border-t border-stone-100">
                    <button
                      type="button"
                      onClick={() => {
                        setEditing(lp);
                        setSelectedSecId(lp.sections[0]?.id || null);
                      }}
                      className="btn-store-primary flex-1 py-2 text-xs font-bold"
                    >
                      {ar ? 'فتح المحرر' : 'Open Builder'}
                    </button>
                    <Link
                      href={`/lp/${lp.slug}`}
                      target="_blank"
                      className="rounded-xl border border-stone-200 p-2 text-stone-700 hover:bg-stone-50"
                    >
                      <ExternalLink className="h-4 w-4" />
                    </Link>
                    <button
                      type="button"
                      onClick={() => duplicatePage(lp.id)}
                      className="rounded-xl border border-stone-200 p-2 text-stone-700 hover:bg-stone-50"
                    >
                      <Copy className="h-4 w-4" />
                    </button>
                    <button
                      type="button"
                      onClick={() => deletePage(lp.id)}
                      className="rounded-xl border border-stone-200 p-2 text-red-600 hover:bg-red-50"
                    >
                      <Trash2 className="h-4 w-4" />
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      ) : (
        <div className="space-y-4">
          {/* Builder Header */}
          <div className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-stone-200 bg-white p-4">
            <div className="flex flex-wrap items-center gap-3">
              <button
                type="button"
                onClick={() => setEditing(null)}
                className="rounded-xl border border-stone-200 p-2 text-stone-600 hover:bg-stone-50"
              >
                <X className="h-4 w-4" />
              </button>
              <input
                value={editing.titleI18n.ar || ''}
                onChange={(e) =>
                  setEditing({
                    ...editing,
                    titleI18n: { ...editing.titleI18n, ar: e.target.value },
                  })
                }
                placeholder="Title AR"
                className="rounded-xl border border-stone-300 px-3 py-1.5 text-xs font-bold"
              />
              <input
                dir="ltr"
                value={editing.slug}
                onChange={(e) => setEditing({ ...editing, slug: e.target.value })}
                placeholder="slug"
                className="rounded-xl border border-stone-300 px-3 py-1.5 text-xs text-start"
              />
              <select
                value={editing.productId || ''}
                onChange={(e) => setEditing({ ...editing, productId: e.target.value || null })}
                className="rounded-xl border border-stone-300 px-3 py-1.5 text-xs"
              >
                <option value="">{ar ? 'بدون منتج مرتبط' : 'No Product'}</option>
                {products.map((p) => (
                  <option key={p.id} value={p.id}>
                    {pick(p.titleI18n)}
                  </option>
                ))}
              </select>
              <label className="inline-flex items-center gap-1 text-xs font-bold">
                <input
                  type="checkbox"
                  checked={editing.isPublished}
                  onChange={(e) => setEditing({ ...editing, isPublished: e.target.checked })}
                />
                {ar ? 'منشورة' : 'Published'}
              </label>
            </div>

            <div className="flex items-center gap-2">
              <div className="flex rounded-xl border border-stone-200 p-0.5">
                <button
                  type="button"
                  onClick={() => setPreviewMode('mobile')}
                  className={`rounded-lg p-1.5 ${
                    previewMode === 'mobile' ? 'bg-stone-900 text-white' : 'text-stone-500'
                  }`}
                >
                  <Smartphone className="h-4 w-4" />
                </button>
                <button
                  type="button"
                  onClick={() => setPreviewMode('desktop')}
                  className={`rounded-lg p-1.5 ${
                    previewMode === 'desktop' ? 'bg-stone-900 text-white' : 'text-stone-500'
                  }`}
                >
                  <Monitor className="h-4 w-4" />
                </button>
              </div>
              <button
                type="button"
                disabled={saving}
                onClick={savePage}
                className="btn-store-primary px-5 py-2 text-xs font-extrabold"
              >
                {saving ? '...' : ar ? 'حفظ الصفحة' : 'Save Page'}
              </button>
            </div>
          </div>

          <div className="grid grid-cols-1 gap-5 lg:grid-cols-12">
            {/* Left Sidebar: Drag-and-drop Section Tree + Pixels */}
            <div className="space-y-4 rounded-2xl border border-stone-200 bg-white p-4 lg:col-span-4 h-fit">
              <div className="flex items-center justify-between">
                <h3 className="text-xs font-extrabold uppercase text-stone-500">
                  {ar ? 'أقسام الصفحة (سحب وإفلات)' : 'Sections (Drag & Drop)'}
                </h3>
                <select
                  value=""
                  onChange={(e) => {
                    if (e.target.value) addSection(e.target.value as LandingSectionType);
                  }}
                  className="rounded-lg border border-stone-300 px-2 py-1 text-[11px] font-bold"
                >
                  <option value="">+ {ar ? 'إضافة قسم' : 'Add Section'}</option>
                  {SECTION_TYPES.map((t) => (
                    <option key={t} value={t}>
                      {t}
                    </option>
                  ))}
                </select>
              </div>

              <DndContext
                sensors={sensors}
                collisionDetection={closestCenter}
                onDragEnd={handleDragEnd}
              >
                <SortableContext
                  items={editing.sections.map((s) => s.id)}
                  strategy={verticalListSortingStrategy}
                >
                  <div className="space-y-2">
                    {editing.sections.map((sec) => (
                      <SortableSectionCard
                        key={sec.id}
                        sec={sec}
                        selected={sec.id === selectedSecId}
                        onSelect={() => setSelectedSecId(sec.id)}
                        onToggle={() =>
                          setEditing({
                            ...editing,
                            sections: editing.sections.map((s) =>
                              s.id === sec.id ? { ...s, enabled: !s.enabled } : s
                            ),
                          })
                        }
                        onDelete={() =>
                          setEditing({
                            ...editing,
                            sections: editing.sections.filter((s) => s.id !== sec.id),
                          })
                        }
                        pick={pick}
                      />
                    ))}
                  </div>
                </SortableContext>
              </DndContext>

              {activeSection && (
                <div className="border-t border-stone-200 pt-3 space-y-2 text-xs">
                  <p className="font-extrabold text-emerald-900">
                    {ar ? 'تعديل القسم:' : 'Edit Section:'} {activeSection.type}
                  </p>
                  <input
                    value={activeSection.titleI18n?.ar || ''}
                    onChange={(e) =>
                      setEditing({
                        ...editing,
                        sections: editing.sections.map((s) =>
                          s.id === activeSection.id
                            ? { ...s, titleI18n: { ...(s.titleI18n || {}), ar: e.target.value } }
                            : s
                        ),
                      })
                    }
                    placeholder="Title AR"
                    className="w-full rounded-xl border border-stone-300 px-3 py-1.5"
                  />
                  <input
                    value={activeSection.titleI18n?.fr || ''}
                    onChange={(e) =>
                      setEditing({
                        ...editing,
                        sections: editing.sections.map((s) =>
                          s.id === activeSection.id
                            ? { ...s, titleI18n: { ...(s.titleI18n || {}), fr: e.target.value } }
                            : s
                        ),
                      })
                    }
                    placeholder="Title FR"
                    className="w-full rounded-xl border border-stone-300 px-3 py-1.5"
                  />
                  <textarea
                    rows={2}
                    value={activeSection.subtitleI18n?.ar || ''}
                    onChange={(e) =>
                      setEditing({
                        ...editing,
                        sections: editing.sections.map((s) =>
                          s.id === activeSection.id
                            ? {
                                ...s,
                                subtitleI18n: { ...(s.subtitleI18n || {}), ar: e.target.value },
                              }
                            : s
                        ),
                      })
                    }
                    placeholder="Subtitle AR"
                    className="w-full rounded-xl border border-stone-300 px-3 py-1.5"
                  />
                </div>
              )}

              {/* Per-page custom pixels */}
              <div className="border-t border-stone-200 pt-3 space-y-2 text-xs">
                <p className="font-extrabold text-stone-700">
                  {ar ? 'بيكسلات مخصصة لهذه الصفحة' : 'Custom Page Pixels'}
                </p>
                <input
                  dir="ltr"
                  value={editing.customPixels?.metaPixelId || ''}
                  onChange={(e) =>
                    setEditing({
                      ...editing,
                      customPixels: { ...editing.customPixels, metaPixelId: e.target.value },
                    })
                  }
                  placeholder="Meta Pixel ID"
                  className="w-full rounded-xl border border-stone-300 px-3 py-1.5 text-start"
                />
                <input
                  dir="ltr"
                  value={editing.customPixels?.tiktokPixelId || ''}
                  onChange={(e) =>
                    setEditing({
                      ...editing,
                      customPixels: { ...editing.customPixels, tiktokPixelId: e.target.value },
                    })
                  }
                  placeholder="TikTok Pixel ID"
                  className="w-full rounded-xl border border-stone-300 px-3 py-1.5 text-start"
                />
              </div>
            </div>

            {/* Right Live Preview Pane */}
            <div className="rounded-2xl border border-stone-200 bg-stone-200/70 p-4 lg:col-span-8 flex justify-center overflow-x-auto">
              <div
                className={`overflow-hidden rounded-3xl border border-stone-300 bg-[#FAF9F6] shadow-xl transition-all ${
                  previewMode === 'mobile' ? 'w-[390px]' : 'w-full'
                }`}
              >
                <LandingPageRenderer
                  landingPageId={editing.id || 'preview'}
                  sections={editing.sections}
                  product={
                    linkedProduct
                      ? {
                          id: linkedProduct.id,
                          productType: linkedProduct.productType,
                          requiresShipping: linkedProduct.requiresShipping,
                          titleI18n: linkedProduct.titleI18n,
                          regularPrice: linkedProduct.regularPrice,
                          salePrice: linkedProduct.salePrice,
                          discountType: linkedProduct.discountType,
                          discountValue: linkedProduct.discountValue,
                          promoStartsAt: linkedProduct.promoStartsAt,
                          promoEndsAt: linkedProduct.promoEndsAt,
                          shippingConfig: linkedProduct.shippingConfig,
                          imageUrl: linkedProduct.media?.[0]?.url || null,
                        }
                      : null
                  }
                  variants={linkedProduct?.variants || []}
                />
              </div>
            </div>
          </div>
        </div>
      )}
    </AdminShell>
  );
}
