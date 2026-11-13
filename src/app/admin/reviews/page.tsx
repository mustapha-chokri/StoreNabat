'use client';

import React, { useCallback, useEffect, useState } from 'react';
import { Check, Loader2, Star, Trash2, X } from 'lucide-react';
import { AdminShell } from '@/components/admin/AdminShell';
import { useStore } from '@/components/providers/StoreContextProvider';
import type { I18nMap } from '@/db/schema/types';

interface ReviewRow {
  review: {
    id: string;
    customerName: string;
    rating: number;
    title: string | null;
    comment: string | null;
    status: 'PENDING' | 'APPROVED' | 'REJECTED';
    createdAt: string;
  };
  productTitleI18n: I18nMap;
}

export default function AdminReviewsPage() {
  const { locale, pick } = useStore();
  const ar = locale === 'ar';

  const [reviews, setReviews] = useState<ReviewRow[]>([]);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch('/api/admin/reviews');
      if (res.ok) {
        const d = await res.json();
        setReviews(d.reviews || []);
      }
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  async function updateStatus(id: string, status: 'APPROVED' | 'REJECTED') {
    await fetch('/api/admin/reviews', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id, status }),
    });
    await load();
  }

  async function removeReview(id: string) {
    await fetch(`/api/admin/reviews?id=${encodeURIComponent(id)}`, { method: 'DELETE' });
    await load();
  }

  return (
    <AdminShell>
      <div className="rounded-2xl border border-stone-200 bg-white p-5">
        {loading ? (
          <div className="flex justify-center py-12">
            <Loader2 className="h-6 w-6 animate-spin text-store-primary" />
          </div>
        ) : (
          <div className="divide-y divide-stone-100 space-y-4">
            {reviews.map(({ review, productTitleI18n }) => (
              <div
                key={review.id}
                className="flex flex-wrap items-start justify-between gap-4 pt-4 first:pt-0"
              >
                <div className="space-y-1 max-w-2xl">
                  <div className="flex items-center gap-2">
                    <span className="font-bold text-stone-900">{review.customerName}</span>
                    <div className="flex text-amber-500">
                      {Array.from({ length: review.rating }).map((_, i) => (
                        <Star key={i} className="h-3.5 w-3.5 fill-amber-500" />
                      ))}
                    </div>
                    <span className="rounded-full bg-stone-100 px-2 py-0.5 text-[11px] font-bold">
                      {review.status}
                    </span>
                  </div>
                  <p className="text-xs font-semibold text-store-primary">
                    {pick(productTitleI18n)}
                  </p>
                  {review.title && <p className="text-sm font-bold">{review.title}</p>}
                  {review.comment && <p className="text-sm text-stone-600">{review.comment}</p>}
                </div>

                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => updateStatus(review.id, 'APPROVED')}
                    className="inline-flex items-center gap-1 rounded-xl bg-emerald-50 px-3 py-1.5 text-xs font-bold text-emerald-900 hover:bg-emerald-100"
                  >
                    <Check className="h-3.5 w-3.5" />
                    {ar ? 'موافقة' : 'Approve'}
                  </button>
                  <button
                    type="button"
                    onClick={() => updateStatus(review.id, 'REJECTED')}
                    className="inline-flex items-center gap-1 rounded-xl bg-amber-50 px-3 py-1.5 text-xs font-bold text-amber-900 hover:bg-amber-100"
                  >
                    <X className="h-3.5 w-3.5" />
                    {ar ? 'رفض' : 'Reject'}
                  </button>
                  <button
                    type="button"
                    onClick={() => removeReview(review.id)}
                    className="rounded-xl border border-stone-200 p-1.5 text-red-600 hover:bg-red-50"
                  >
                    <Trash2 className="h-4 w-4" />
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </AdminShell>
  );
}

