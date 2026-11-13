'use client';

import React, { useCallback, useEffect, useState } from 'react';
import {
  Copy,
  Edit3,
  FileUp,
  ImagePlus,
  Loader2,
  Plus,
  Trash2,
  X,
} from 'lucide-react';
import { AdminShell } from '@/components/admin/AdminShell';
import { useStore } from '@/components/providers/StoreContextProvider';
import type { I18nMap, ProductType } from '@/db/schema/types';

interface AdminProductRow {
  id: string;
  categoryId: string | null;
  productType: ProductType;
  slug: string;
  titleI18n: I18nMap;
  shortDescriptionI18n: I18nMap;
  descriptionI18n: I18nMap;
  regularPrice: string;
  salePrice: string | null;
  discountType: 'PERCENT' | 'FIXED' | null;
  discountValue: string | null;
  promoStartsAt: string | null;
  promoEndsAt: string | null;
  sku: string | null;
  barcode: string | null;
  trackInventory: boolean;
  stockQuantity: number;
  lowStockThreshold: number;
  allowBackorders: boolean;
  hasVariants: boolean;
  requiresShipping: boolean;
  isPublished: boolean;
  isFeatured: boolean;
  isBestSeller: boolean;
  isNewArrival: boolean;
  media: Array<{ mediaType: 'IMAGE' | 'VIDEO'; url: string; sortOrder: number }>;
  variants: Array<{
    id?: string;
    titleI18n: I18nMap;
    optionValues: Record<string, string>;
    sku: string | null;
    regularPrice: string;
    salePrice: string | null;
    stockQuantity: number;
    imageUrl: string | null;
    isDefault: boolean;
  }>;
  digitalFiles: Array<{
    fileName: string;
    storageKey: string;
    mimeType: string;
    fileSizeBytes: number;
    maxDownloads: number | null;
    expiryDays: number | null;
  }>;
  bundleItems: Array<{ itemProductId: string; quantity: number }>;
}

interface FormState {
  id?: string;
  categoryId: string;
  productType: ProductType;
  slug: string;
  titleAr: string;
  titleFr: string;
  titleEn: string;
  shortAr: string;
  shortFr: string;
  shortEn: string;
  descAr: string;
  descFr: string;
  descEn: string;
  regularPrice: string;
  salePrice: string;
  promoStartsAt: string;
  promoEndsAt: string;
  sku: string;
  barcode: string;
  trackInventory: boolean;
  stockQuantity: number;
  lowStockThreshold: number;
  allowBackorders: boolean;
  requiresShipping: boolean;
  isPublished: boolean;
  isFeatured: boolean;
  isBestSeller: boolean;
  isNewArrival: boolean;
  media: Array<{ mediaType: 'IMAGE' | 'VIDEO'; url: string; sortOrder: number }>;
  variants: AdminProductRow['variants'];
  digitalFiles: AdminProductRow['digitalFiles'];
  bundleItems: AdminProductRow['bundleItems'];
}

const EMPTY_FORM: FormState = {
  categoryId: '',
  productType: 'PHYSICAL',
  slug: '',
  titleAr: '',
  titleFr: '',
  titleEn: '',
  shortAr: '',
  shortFr: '',
  shortEn: '',
  descAr: '',
  descFr: '',
  descEn: '',
  regularPrice: '100',
  salePrice: '',
  promoStartsAt: '',
  promoEndsAt: '',
  sku: '',
  barcode: '',
  trackInventory: true,
  stockQuantity: 25,
  lowStockThreshold: 5,
  allowBackorders: false,
  requiresShipping: true,
  isPublished: true,
  isFeatured: false,
  isBestSeller: false,
  isNewArrival: true,
  media: [],
  variants: [],
  digitalFiles: [],
  bundleItems: [],
};

export default function AdminProductsPage() {
  const { locale, pick, formatPrice } = useStore();
  const ar = locale === 'ar';

  const [products, setProducts] = useState<AdminProductRow[]>([]);
  const [categories, setCategories] = useState<Array<{ id: string; nameI18n: I18nMap }>>([]);
  const [q, setQ] = useState('');
  const [loading, setLoading] = useState(true);
  const [modalOpen, setModalOpen] = useState(false);
  const [form, setForm] = useState<FormState>(EMPTY_FORM);
  const [saving, setSaving] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [errMsg, setErrMsg] = useState<string | null>(null);

  const loadData = useCallback(async () => {
    setLoading(true);
    try {
      const [pRes, cRes] = await Promise.all([
        fetch(`/api/admin/products?q=${encodeURIComponent(q.trim())}`),
        fetch('/api/admin/categories'),
      ]);
      if (pRes.ok) {
        const pd = await pRes.json();
        setProducts(pd.products || []);
      }
      if (cRes.ok) {
        const cd = await cRes.json();
        setCategories(cd.categories || []);
      }
    } finally {
      setLoading(false);
    }
  }, [q]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  function openCreate() {
    setForm(EMPTY_FORM);
    setErrMsg(null);
    setModalOpen(true);
  }

  function openEdit(p: AdminProductRow) {
    setForm({
      id: p.id,
      categoryId: p.categoryId || '',
      productType: p.productType,
      slug: p.slug,
      titleAr: p.titleI18n?.ar || '',
      titleFr: p.titleI18n?.fr || '',
      titleEn: p.titleI18n?.en || '',
      shortAr: p.shortDescriptionI18n?.ar || '',
      shortFr: p.shortDescriptionI18n?.fr || '',
      shortEn: p.shortDescriptionI18n?.en || '',
      descAr: p.descriptionI18n?.ar || '',
      descFr: p.descriptionI18n?.fr || '',
      descEn: p.descriptionI18n?.en || '',
      regularPrice: String(p.regularPrice),
      salePrice: p.salePrice ? String(p.salePrice) : '',
      promoStartsAt: p.promoStartsAt ? p.promoStartsAt.slice(0, 16) : '',
      promoEndsAt: p.promoEndsAt ? p.promoEndsAt.slice(0, 16) : '',
      sku: p.sku || '',
      barcode: p.barcode || '',
      trackInventory: p.trackInventory,
      stockQuantity: p.stockQuantity,
      lowStockThreshold: p.lowStockThreshold,
      allowBackorders: p.allowBackorders,
      requiresShipping: p.requiresShipping,
      isPublished: p.isPublished,
      isFeatured: p.isFeatured,
      isBestSeller: p.isBestSeller,
      isNewArrival: p.isNewArrival,
      media: p.media || [],
      variants: p.variants || [],
      digitalFiles: p.digitalFiles || [],
      bundleItems: p.bundleItems || [],
    });
    setErrMsg(null);
    setModalOpen(true);
  }

  async function handleFileUpload(file: File, visibility: 'public' | 'private') {
    setUploading(true);
    try {
      const fd = new FormData();
      fd.append('file', file);
      fd.append('visibility', visibility);
      const res = await fetch('/api/admin/upload', { method: 'POST', body: fd });
      if (!res.ok) return;
      const stored = await res.json();
      if (visibility === 'public') {
        const isVideo = file.type.startsWith('video/');
        const mediaUrl = stored.url || stored.publicUrl || `/api/media/${stored.storageKey || stored.key}`;
        setForm((prev) => ({
          ...prev,
          media: [
            ...prev.media,
            { mediaType: isVideo ? 'VIDEO' : 'IMAGE', url: mediaUrl, sortOrder: prev.media.length },
          ],
        }));
      } else {
        const fileKey = stored.storageKey || stored.key || '';
        setForm((prev) => ({
          ...prev,
          digitalFiles: [
            ...prev.digitalFiles,
            {
              fileName: stored.originalName || file.name,
              storageKey: fileKey,
              mimeType: stored.mimeType || file.type || 'application/octet-stream',
              fileSizeBytes: stored.sizeBytes || file.size,
              maxDownloads: 5,
              expiryDays: 30,
            },
          ],
        }));
      }
    } finally {
      setUploading(false);
    }
  }

  async function handleSaveProduct(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    setErrMsg(null);
    try {
      const computedSlug = (
        form.slug.trim() ||
        form.titleEn ||
        form.titleFr ||
        form.titleAr ||
        `prod-${Date.now()}`
      )
        .toLowerCase()
        .replace(/[\s_]+/g, '-')
        .replace(/[^a-z0-9\u0600-\u06FF-]/g, '')
        .replace(/-+/g, '-')
        .replace(/^-|-$/g, '') || `prod-${Date.now()}`;

      const payload = {
        categoryId: form.categoryId?.trim() || null,
        productType: form.productType,
        slug: computedSlug,
        titleI18n: {
          ar: form.titleAr.trim(),
          fr: (form.titleFr || form.titleAr).trim(),
          en: (form.titleEn || form.titleAr).trim(),
        },
        shortDescriptionI18n: {
          ar: form.shortAr,
          fr: form.shortFr,
          en: form.shortEn,
        },
        descriptionI18n: {
          ar: form.descAr,
          fr: form.descFr,
          en: form.descEn,
        },
        regularPrice: Number(form.regularPrice) || 0,
        salePrice: form.salePrice ? Number(form.salePrice) : null,
        promoStartsAt: form.promoStartsAt ? new Date(form.promoStartsAt).toISOString() : null,
        promoEndsAt: form.promoEndsAt ? new Date(form.promoEndsAt).toISOString() : null,
        sku: form.sku?.trim() || null,
        barcode: form.barcode?.trim() || null,
        trackInventory: form.trackInventory,
        stockQuantity: Number(form.stockQuantity) || 0,
        lowStockThreshold: Number(form.lowStockThreshold) || 5,
        allowBackorders: form.allowBackorders,
        hasVariants: form.variants.length > 0,
        requiresShipping:
          form.productType === 'DIGITAL' || form.productType === 'SERVICE'
            ? false
            : form.requiresShipping,
        isPublished: form.isPublished,
        isFeatured: form.isFeatured,
        isBestSeller: form.isBestSeller,
        isNewArrival: form.isNewArrival,
        media: form.media,
        variants: form.variants.map((v, idx) => ({
          ...v,
          isDefault: idx === 0,
          isActive: true,
        })),
        digitalFiles: form.digitalFiles,
        bundleItems: form.bundleItems,
      };

      const url = form.id ? `/api/admin/products/${form.id}` : '/api/admin/products';
      const method = form.id ? 'PATCH' : 'POST';
      const res = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });
      const d = await res.json();
      if (!res.ok) {
        setErrMsg(d.error || 'Failed to save product');
        return;
      }
      setModalOpen(false);
      await loadData();
    } finally {
      setSaving(false);
    }
  }

  async function handleDuplicate(id: string) {
    const res = await fetch(`/api/admin/products/${id}`, { method: 'POST' });
    if (res.ok) await loadData();
  }

  async function handleDelete(id: string) {
    if (!confirm(ar ? 'حذف هذا المنتج نهائياً؟' : 'Delete this product?')) return;
    const res = await fetch(`/api/admin/products/${id}`, { method: 'DELETE' });
    if (res.ok) await loadData();
  }

  return (
    <AdminShell>
      <div className="space-y-5">
        <div className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-stone-200 bg-white p-4">
          <input
            type="search"
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder={ar ? 'بحث في المنتجات...' : 'Search products...'}
            className="w-64 rounded-xl border border-stone-300 px-3 py-2 text-xs focus:border-emerald-700 focus:outline-none"
          />
          <button
            type="button"
            onClick={openCreate}
            className="btn-store-primary inline-flex items-center gap-2 px-4 py-2 text-xs font-extrabold"
          >
            <Plus className="h-4 w-4" />
            <span>{ar ? 'إضافة منتج جديد' : 'New Product'}</span>
          </button>
        </div>

        <div className="overflow-hidden rounded-2xl border border-stone-200 bg-white">
          {loading ? (
            <div className="flex min-h-[220px] items-center justify-center">
              <Loader2 className="h-6 w-6 animate-spin text-store-primary" />
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-xs sm:text-sm">
                <thead className="border-b border-stone-200 bg-stone-50 text-stone-600">
                  <tr>
                    <th className="p-3 text-start">{ar ? 'المنتج' : 'Product'}</th>
                    <th className="p-3 text-start">{ar ? 'النوع' : 'Type'}</th>
                    <th className="p-3 text-start">{ar ? 'السعر' : 'Price'}</th>
                    <th className="p-3 text-start">{ar ? 'المخزون' : 'Stock'}</th>
                    <th className="p-3 text-start">{ar ? 'الحالة' : 'Status'}</th>
                    <th className="p-3 text-end">{ar ? 'إجراءات' : 'Actions'}</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-stone-100">
                  {products.map((p) => (
                    <tr key={p.id} className="hover:bg-stone-50/70">
                      <td className="p-3 flex items-center gap-3">
                        <div className="h-10 w-10 shrink-0 overflow-hidden rounded-lg bg-stone-100">
                          {p.media?.[0]?.url && (
                            <img src={p.media[0].url} alt="" className="h-full w-full object-cover" />
                          )}
                        </div>
                        <div>
                          <p className="font-bold text-stone-900">{pick(p.titleI18n)}</p>
                          <p dir="ltr" className="text-[11px] text-stone-400">
                            /{p.slug} {p.sku ? `• ${p.sku}` : ''}
                          </p>
                        </div>
                      </td>
                      <td className="p-3">
                        <span className="rounded-md bg-stone-100 px-2 py-0.5 text-[11px] font-bold">
                          {p.productType}
                        </span>
                      </td>
                      <td className="p-3 font-bold tabular-nums">
                        {p.salePrice ? (
                          <div>
                            <span className="text-store-primary">{formatPrice(p.salePrice)}</span>
                            <span className="ms-1 text-xs text-stone-400 line-through">
                              {formatPrice(p.regularPrice)}
                            </span>
                          </div>
                        ) : (
                          formatPrice(p.regularPrice)
                        )}
                      </td>
                      <td className="p-3 tabular-nums">
                        {p.hasVariants
                          ? `${p.variants.reduce((s, v) => s + v.stockQuantity, 0)} (${p.variants.length})`
                          : p.stockQuantity}
                      </td>
                      <td className="p-3">
                        <span
                          className={`rounded-full px-2.5 py-0.5 text-[11px] font-bold ${
                            p.isPublished
                              ? 'bg-emerald-50 text-emerald-900'
                              : 'bg-stone-100 text-stone-500'
                          }`}
                        >
                          {p.isPublished ? (ar ? 'منشور' : 'Published') : ar ? 'مسودة' : 'Draft'}
                        </span>
                      </td>
                      <td className="p-3 text-end">
                        <div className="inline-flex items-center gap-1.5">
                          <button
                            type="button"
                            onClick={() => openEdit(p)}
                            className="rounded-lg border border-stone-200 p-1.5 hover:bg-stone-100"
                            title="Edit"
                          >
                            <Edit3 className="h-3.5 w-3.5" />
                          </button>
                          <button
                            type="button"
                            onClick={() => handleDuplicate(p.id)}
                            className="rounded-lg border border-stone-200 p-1.5 hover:bg-stone-100"
                            title="Duplicate"
                          >
                            <Copy className="h-3.5 w-3.5" />
                          </button>
                          <button
                            type="button"
                            onClick={() => handleDelete(p.id)}
                            className="rounded-lg border border-stone-200 p-1.5 text-red-600 hover:bg-red-50"
                            title="Delete"
                          >
                            <Trash2 className="h-3.5 w-3.5" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>

      {/* Create/Edit Modal */}
      {modalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
          <form
            onSubmit={handleSaveProduct}
            className="max-h-[92vh] w-full max-w-4xl overflow-y-auto rounded-3xl bg-white p-6 shadow-2xl space-y-5"
          >
            <div className="flex items-center justify-between border-b border-stone-100 pb-3">
              <h2 className="text-lg font-extrabold text-stone-900">
                {form.id ? (ar ? 'تعديل المنتج' : 'Edit Product') : ar ? 'منتج جديد' : 'New Product'}
              </h2>
              <button
                type="button"
                onClick={() => setModalOpen(false)}
                className="rounded-lg p-1.5 text-stone-400 hover:bg-stone-100"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
              <div>
                <label className="mb-1 block text-xs font-bold">{ar ? 'الاسم (عربية) *' : 'Title AR *'}</label>
                <input
                  required
                  value={form.titleAr}
                  onChange={(e) => setForm({ ...form, titleAr: e.target.value })}
                  className="w-full rounded-xl border border-stone-300 px-3 py-2 text-xs"
                />
              </div>
              <div>
                <label className="mb-1 block text-xs font-bold">Title FR</label>
                <input
                  value={form.titleFr}
                  onChange={(e) => setForm({ ...form, titleFr: e.target.value })}
                  className="w-full rounded-xl border border-stone-300 px-3 py-2 text-xs"
                />
              </div>
              <div>
                <label className="mb-1 block text-xs font-bold">Title EN</label>
                <input
                  value={form.titleEn}
                  onChange={(e) => setForm({ ...form, titleEn: e.target.value })}
                  className="w-full rounded-xl border border-stone-300 px-3 py-2 text-xs"
                />
              </div>
            </div>

            <div className="grid grid-cols-1 gap-3 sm:grid-cols-4">
              <div>
                <label className="mb-1 block text-xs font-bold">
                  Slug <span className="text-[10px] text-stone-400 font-normal">{ar ? '(تلقائي إذا تُرك فارغاً)' : '(Auto if empty)'}</span>
                </label>
                <input
                  dir="ltr"
                  value={form.slug}
                  placeholder={ar ? 'تلقائي من اسم المنتج' : 'e.g. argan-oil-pure'}
                  onChange={(e) => setForm({ ...form, slug: e.target.value })}
                  className="w-full rounded-xl border border-stone-300 px-3 py-2 text-xs text-start"
                />
              </div>
              <div>
                <label className="mb-1 block text-xs font-bold">{ar ? 'النوع' : 'Type'}</label>
                <select
                  value={form.productType}
                  onChange={(e) => setForm({ ...form, productType: e.target.value as ProductType })}
                  className="w-full rounded-xl border border-stone-300 px-3 py-2 text-xs"
                >
                  <option value="PHYSICAL">PHYSICAL</option>
                  <option value="DIGITAL">DIGITAL</option>
                  <option value="SERVICE">SERVICE</option>
                  <option value="SUBSCRIPTION">SUBSCRIPTION</option>
                  <option value="BUNDLE">BUNDLE</option>
                </select>
              </div>
              <div>
                <label className="mb-1 block text-xs font-bold">{ar ? 'التصنيف' : 'Category'}</label>
                <select
                  value={form.categoryId}
                  onChange={(e) => setForm({ ...form, categoryId: e.target.value })}
                  className="w-full rounded-xl border border-stone-300 px-3 py-2 text-xs"
                >
                  <option value="">--</option>
                  {categories.map((c) => (
                    <option key={c.id} value={c.id}>
                      {pick(c.nameI18n)}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label className="mb-1 block text-xs font-bold">SKU</label>
                <input
                  dir="ltr"
                  value={form.sku}
                  onChange={(e) => setForm({ ...form, sku: e.target.value })}
                  className="w-full rounded-xl border border-stone-300 px-3 py-2 text-xs text-start"
                />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
              <div>
                <label className="mb-1 block text-xs font-bold">{ar ? 'السعر العادي *' : 'Regular Price *'}</label>
                <input
                  type="number"
                  step="0.01"
                  required
                  value={form.regularPrice}
                  onChange={(e) => setForm({ ...form, regularPrice: e.target.value })}
                  className="w-full rounded-xl border border-stone-300 px-3 py-2 text-xs"
                />
              </div>
              <div>
                <label className="mb-1 block text-xs font-bold">{ar ? 'سعر العرض' : 'Sale Price'}</label>
                <input
                  type="number"
                  step="0.01"
                  value={form.salePrice}
                  onChange={(e) => setForm({ ...form, salePrice: e.target.value })}
                  className="w-full rounded-xl border border-stone-300 px-3 py-2 text-xs"
                />
              </div>
              <div>
                <label className="mb-1 block text-xs font-bold">{ar ? 'المخزون' : 'Stock Qty'}</label>
                <input
                  type="number"
                  value={form.stockQuantity}
                  onChange={(e) => setForm({ ...form, stockQuantity: Number(e.target.value) })}
                  className="w-full rounded-xl border border-stone-300 px-3 py-2 text-xs"
                />
              </div>
              <div>
                <label className="mb-1 block text-xs font-bold">{ar ? 'انتهاء العرض' : 'Promo Ends'}</label>
                <input
                  type="datetime-local"
                  value={form.promoEndsAt}
                  onChange={(e) => setForm({ ...form, promoEndsAt: e.target.value })}
                  className="w-full rounded-xl border border-stone-300 px-3 py-2 text-xs"
                />
              </div>
            </div>

            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              <div>
                <label className="mb-1 block text-xs font-bold">{ar ? 'الوصف (عربية)' : 'Description AR'}</label>
                <textarea
                  rows={3}
                  value={form.descAr}
                  onChange={(e) => setForm({ ...form, descAr: e.target.value })}
                  className="w-full rounded-xl border border-stone-300 px-3 py-2 text-xs"
                />
              </div>
              <div>
                <label className="mb-1 block text-xs font-bold">Description FR</label>
                <textarea
                  rows={3}
                  value={form.descFr}
                  onChange={(e) => setForm({ ...form, descFr: e.target.value })}
                  className="w-full rounded-xl border border-stone-300 px-3 py-2 text-xs"
                />
              </div>
            </div>

            {/* Flags */}
            <div className="flex flex-wrap gap-4 text-xs font-semibold">
              <label className="inline-flex items-center gap-1.5">
                <input
                  type="checkbox"
                  checked={form.isPublished}
                  onChange={(e) => setForm({ ...form, isPublished: e.target.checked })}
                />
                {ar ? 'منشور' : 'Published'}
              </label>
              <label className="inline-flex items-center gap-1.5">
                <input
                  type="checkbox"
                  checked={form.isFeatured}
                  onChange={(e) => setForm({ ...form, isFeatured: e.target.checked })}
                />
                {ar ? 'مميز' : 'Featured'}
              </label>
              <label className="inline-flex items-center gap-1.5">
                <input
                  type="checkbox"
                  checked={form.isBestSeller}
                  onChange={(e) => setForm({ ...form, isBestSeller: e.target.checked })}
                />
                {ar ? 'الأكثر مبيعاً' : 'Best Seller'}
              </label>
              <label className="inline-flex items-center gap-1.5">
                <input
                  type="checkbox"
                  checked={form.allowBackorders}
                  onChange={(e) => setForm({ ...form, allowBackorders: e.target.checked })}
                />
                {ar ? 'السماح بالطلب عند نفاد المخزون' : 'Allow Backorder'}
              </label>
            </div>

            {/* Media Gallery Upload */}
            <div className="rounded-2xl border border-stone-200 p-4 space-y-3">
              <div className="flex items-center justify-between">
                <span className="text-xs font-extrabold">{ar ? 'الصور والفيديو' : 'Images & Video'}</span>
                <label className="inline-flex cursor-pointer items-center gap-1.5 rounded-xl border border-stone-300 px-3 py-1.5 text-xs font-bold hover:bg-stone-50">
                  <ImagePlus className="h-3.5 w-3.5" />
                  <span>{uploading ? '...' : ar ? 'رفع ملف' : 'Upload Media'}</span>
                  <input
                    type="file"
                    accept="image/*,video/*"
                    className="hidden"
                    onChange={(e) => {
                      const f = e.target.files?.[0];
                      if (f) handleFileUpload(f, 'public');
                    }}
                  />
                </label>
              </div>
              <div className="flex flex-wrap gap-2">
                {form.media.map((m, idx) => (
                  <div key={idx} className="relative h-16 w-16 rounded-xl border border-stone-200 overflow-hidden">
                    <img src={m.url} alt="" className="h-full w-full object-cover" />
                    <button
                      type="button"
                      onClick={() =>
                        setForm((prev) => ({
                          ...prev,
                          media: prev.media.filter((_, i) => i !== idx),
                        }))
                      }
                      className="absolute top-0.5 end-0.5 rounded-full bg-black/70 p-0.5 text-white"
                    >
                      <X className="h-3 w-3" />
                    </button>
                  </div>
                ))}
              </div>
            </div>

            {/* Digital File Upload if DIGITAL */}
            {form.productType === 'DIGITAL' && (
              <div className="rounded-2xl border border-sky-200 bg-sky-50/50 p-4 space-y-2">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-extrabold text-sky-950">
                    {ar ? 'الملفات الرقمية (مؤمنة)' : 'Protected Digital Files'}
                  </span>
                  <label className="inline-flex cursor-pointer items-center gap-1.5 rounded-xl bg-sky-700 px-3 py-1.5 text-xs font-bold text-white">
                    <FileUp className="h-3.5 w-3.5" />
                    <span>{ar ? 'رفع ملف PDF/ZIP' : 'Upload File'}</span>
                    <input
                      type="file"
                      className="hidden"
                      onChange={(e) => {
                        const f = e.target.files?.[0];
                        if (f) handleFileUpload(f, 'private');
                      }}
                    />
                  </label>
                </div>
                {form.digitalFiles.map((df, i) => (
                  <div key={i} className="flex items-center justify-between text-xs bg-white px-3 py-2 rounded-xl border">
                    <span>{df.fileName}</span>
                    <button
                      type="button"
                      onClick={() =>
                        setForm((p) => ({
                          ...p,
                          digitalFiles: p.digitalFiles.filter((_, idx) => idx !== i),
                        }))
                      }
                      className="text-red-600 font-bold"
                    >
                      ×
                    </button>
                  </div>
                ))}
              </div>
            )}

            {/* Variants Section */}
            <div className="rounded-2xl border border-stone-200 p-4 space-y-3">
              <div className="flex items-center justify-between">
                <span className="text-xs font-extrabold">{ar ? 'المتغييرات (Variants)' : 'Product Variants'}</span>
                <button
                  type="button"
                  onClick={() =>
                    setForm((p) => ({
                      ...p,
                      variants: [
                        ...p.variants,
                        {
                          titleI18n: { ar: 'حجم جديد', fr: 'Nouvelle option', en: 'New Option' },
                          optionValues: {},
                          sku: '',
                          regularPrice: form.regularPrice || '100',
                          salePrice: null,
                          stockQuantity: 15,
                          imageUrl: null,
                          isDefault: p.variants.length === 0,
                        },
                      ],
                    }))
                  }
                  className="rounded-xl border border-stone-300 px-3 py-1 text-xs font-bold hover:bg-stone-50"
                >
                  + {ar ? 'إضافة متغير' : 'Add Variant'}
                </button>
              </div>

              {form.variants.map((v, idx) => (
                <div key={idx} className="grid grid-cols-2 gap-2 rounded-xl bg-stone-50 p-2.5 sm:grid-cols-5">
                  <input
                    value={v.titleI18n.ar || ''}
                    onChange={(e) => {
                      const next = [...form.variants];
                      next[idx] = {
                        ...next[idx],
                        titleI18n: { ...next[idx].titleI18n, ar: e.target.value, fr: e.target.value },
                      };
                      setForm({ ...form, variants: next });
                    }}
                    placeholder={ar ? 'الاسم (مثال: 100 مل)' : 'Variant'}
                    className="rounded-lg border px-2 py-1 text-xs"
                  />
                  <input
                    value={v.sku || ''}
                    onChange={(e) => {
                      const next = [...form.variants];
                      next[idx] = { ...next[idx], sku: e.target.value };
                      setForm({ ...form, variants: next });
                    }}
                    placeholder="SKU"
                    className="rounded-lg border px-2 py-1 text-xs"
                  />
                  <input
                    type="number"
                    value={v.regularPrice}
                    onChange={(e) => {
                      const next = [...form.variants];
                      next[idx] = { ...next[idx], regularPrice: e.target.value };
                      setForm({ ...form, variants: next });
                    }}
                    placeholder="Price"
                    className="rounded-lg border px-2 py-1 text-xs"
                  />
                  <input
                    type="number"
                    value={v.stockQuantity}
                    onChange={(e) => {
                      const next = [...form.variants];
                      next[idx] = { ...next[idx], stockQuantity: Number(e.target.value) };
                      setForm({ ...form, variants: next });
                    }}
                    placeholder="Stock"
                    className="rounded-lg border px-2 py-1 text-xs"
                  />
                  <button
                    type="button"
                    onClick={() =>
                      setForm((p) => ({
                        ...p,
                        variants: p.variants.filter((_, i) => i !== idx),
                      }))
                    }
                    className="rounded-lg border border-red-200 bg-white text-xs font-bold text-red-600"
                  >
                    ×
                  </button>
                </div>
              ))}
            </div>

            {errMsg && (
              <div className="rounded-xl border border-red-200 bg-red-50 px-3 py-2 text-xs text-red-700">
                {errMsg}
              </div>
            )}

            <div className="flex justify-end gap-2 pt-2">
              <button
                type="button"
                onClick={() => setModalOpen(false)}
                className="rounded-xl border border-stone-300 px-5 py-2.5 text-xs font-bold"
              >
                {ar ? 'إلغاء' : 'Cancel'}
              </button>
              <button
                type="submit"
                disabled={saving}
                className="btn-store-primary px-6 py-2.5 text-xs font-extrabold disabled:opacity-50"
              >
                {saving ? '...' : ar ? 'حفظ المنتج' : 'Save Product'}
              </button>
            </div>
          </form>
        </div>
      )}
    </AdminShell>
  );
}

