'use client';

import React, { useCallback, useEffect, useState } from 'react';
import { Edit3, Loader2, Plus, Trash2 } from 'lucide-react';
import { AdminShell } from '@/components/admin/AdminShell';
import { useStore } from '@/components/providers/StoreContextProvider';
import type { I18nMap } from '@/db/schema/types';

interface CategoryRow {
  id: string;
  slug: string;
  nameI18n: I18nMap;
  descriptionI18n: I18nMap;
  imageUrl: string | null;
  isFeatured: boolean;
  sortOrder: number;
  isActive: boolean;
}

export default function AdminCategoriesPage() {
  const { locale, pick } = useStore();
  const ar = locale === 'ar';

  const [list, setList] = useState<CategoryRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [editId, setEditId] = useState<string | null>(null);
  const [slug, setSlug] = useState('');
  const [nameAr, setNameAr] = useState('');
  const [nameFr, setNameFr] = useState('');
  const [nameEn, setNameEn] = useState('');
  const [imageUrl, setImageUrl] = useState('');
  const [isFeatured, setIsFeatured] = useState(true);
  const [sortOrder, setSortOrder] = useState(0);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch('/api/admin/categories');
      if (res.ok) {
        const d = await res.json();
        setList(d.categories || []);
      }
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  function startEdit(cat: CategoryRow) {
    setEditId(cat.id);
    setSlug(cat.slug);
    setNameAr(cat.nameI18n?.ar || '');
    setNameFr(cat.nameI18n?.fr || '');
    setNameEn(cat.nameI18n?.en || '');
    setImageUrl(cat.imageUrl || '');
    setIsFeatured(cat.isFeatured);
    setSortOrder(cat.sortOrder);
  }

  function resetForm() {
    setEditId(null);
    setSlug('');
    setNameAr('');
    setNameFr('');
    setNameEn('');
    setImageUrl('');
    setIsFeatured(true);
    setSortOrder(0);
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    const res = await fetch('/api/admin/categories', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        id: editId || undefined,
        slug,
        nameI18n: { ar: nameAr, fr: nameFr || nameAr, en: nameEn || nameAr },
        imageUrl: imageUrl || null,
        isFeatured,
        sortOrder: Number(sortOrder),
        isActive: true,
      }),
    });
    if (res.ok) {
      resetForm();
      await load();
    }
  }

  async function handleDelete(id: string) {
    if (!confirm(ar ? 'حذف التصنيف؟' : 'Delete category?')) return;
    const res = await fetch(`/api/admin/categories?id=${encodeURIComponent(id)}`, {
      method: 'DELETE',
    });
    if (res.ok) await load();
  }

  return (
    <AdminShell>
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-12">
        <form
          onSubmit={handleSubmit}
          className="rounded-2xl border border-stone-200 bg-white p-5 space-y-3 lg:col-span-4 h-fit"
        >
          <h2 className="text-sm font-extrabold text-stone-900">
            {editId ? (ar ? 'تعديل التصنيف' : 'Edit Category') : ar ? 'تصنيف جديد' : 'New Category'}
          </h2>
          <input
            required
            value={nameAr}
            onChange={(e) => setNameAr(e.target.value)}
            placeholder={ar ? 'الاسم بالعربية *' : 'Name AR *'}
            className="w-full rounded-xl border border-stone-300 px-3 py-2 text-xs"
          />
          <input
            value={nameFr}
            onChange={(e) => setNameFr(e.target.value)}
            placeholder="Name FR"
            className="w-full rounded-xl border border-stone-300 px-3 py-2 text-xs"
          />
          <input
            value={nameEn}
            onChange={(e) => setNameEn(e.target.value)}
            placeholder="Name EN"
            className="w-full rounded-xl border border-stone-300 px-3 py-2 text-xs"
          />
          <input
            required
            dir="ltr"
            value={slug}
            onChange={(e) => setSlug(e.target.value)}
            placeholder="slug-url"
            className="w-full rounded-xl border border-stone-300 px-3 py-2 text-xs text-start"
          />
          <input
            dir="ltr"
            value={imageUrl}
            onChange={(e) => setImageUrl(e.target.value)}
            placeholder="Image URL"
            className="w-full rounded-xl border border-stone-300 px-3 py-2 text-xs text-start"
          />
          <div className="flex items-center justify-between text-xs">
            <label className="inline-flex items-center gap-1.5 font-semibold">
              <input
                type="checkbox"
                checked={isFeatured}
                onChange={(e) => setIsFeatured(e.target.checked)}
              />
              {ar ? 'مميز في الرئيسية' : 'Featured'}
            </label>
            <input
              type="number"
              value={sortOrder}
              onChange={(e) => setSortOrder(Number(e.target.value))}
              className="w-20 rounded-xl border border-stone-300 px-2 py-1 text-xs"
            />
          </div>
          <div className="flex gap-2">
            <button
              type="submit"
              className="btn-store-primary flex flex-1 items-center justify-center gap-1.5 py-2.5 text-xs font-extrabold"
            >
              <Plus className="h-4 w-4" />
              <span>{editId ? (ar ? 'تحديث' : 'Update') : ar ? 'إضافة' : 'Create'}</span>
            </button>
            {editId && (
              <button
                type="button"
                onClick={resetForm}
                className="rounded-xl border border-stone-300 px-3 py-2 text-xs font-bold"
              >
                ×
              </button>
            )}
          </div>
        </form>

        <div className="rounded-2xl border border-stone-200 bg-white p-5 lg:col-span-8">
          {loading ? (
            <div className="flex justify-center py-12">
              <Loader2 className="h-6 w-6 animate-spin text-store-primary" />
            </div>
          ) : (
            <div className="divide-y divide-stone-100 text-sm">
              {list.map((c) => (
                <div key={c.id} className="flex items-center justify-between py-3">
                  <div>
                    <p className="font-bold text-stone-900">{pick(c.nameI18n)}</p>
                    <p dir="ltr" className="text-xs text-stone-400">
                      /{c.slug}
                    </p>
                  </div>
                  <div className="flex gap-2">
                    <button
                      type="button"
                      onClick={() => startEdit(c)}
                      className="rounded-lg border border-stone-200 p-1.5 hover:bg-stone-50"
                    >
                      <Edit3 className="h-3.5 w-3.5" />
                    </button>
                    <button
                      type="button"
                      onClick={() => handleDelete(c.id)}
                      className="rounded-lg border border-stone-200 p-1.5 text-red-600 hover:bg-red-50"
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </AdminShell>
  );
}

