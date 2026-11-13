'use client';

import React, { useCallback, useEffect, useState } from 'react';
import { Loader2, Plus, Trash2 } from 'lucide-react';
import { AdminShell } from '@/components/admin/AdminShell';
import { useStore } from '@/components/providers/StoreContextProvider';

interface CouponRow {
  id: string;
  code: string;
  discountType: 'PERCENT' | 'FIXED' | 'FREE_SHIPPING';
  discountValue: string;
  minOrderAmount: string | null;
  maxUses: number | null;
  usedCount: number;
  isActive: boolean;
}

export default function AdminCouponsPage() {
  const { locale, formatPrice } = useStore();
  const ar = locale === 'ar';

  const [coupons, setCoupons] = useState<CouponRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [code, setCode] = useState('');
  const [discountType, setDiscountType] = useState<'PERCENT' | 'FIXED' | 'FREE_SHIPPING'>('PERCENT');
  const [discountValue, setDiscountValue] = useState('10');
  const [minOrderAmount, setMinOrderAmount] = useState('100');
  const [maxUses, setMaxUses] = useState('');

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch('/api/admin/coupons');
      if (res.ok) {
        const d = await res.json();
        setCoupons(d.coupons || []);
      }
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  async function handleCreate(e: React.FormEvent) {
    e.preventDefault();
    const res = await fetch('/api/admin/coupons', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        code,
        discountType,
        discountValue: Number(discountValue || 0),
        minOrderAmount: minOrderAmount ? Number(minOrderAmount) : null,
        maxUses: maxUses ? Number(maxUses) : null,
        isActive: true,
      }),
    });
    if (res.ok) {
      setCode('');
      await load();
    }
  }

  async function handleDelete(id: string) {
    await fetch(`/api/admin/coupons?id=${encodeURIComponent(id)}`, { method: 'DELETE' });
    await load();
  }

  return (
    <AdminShell>
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-12">
        <form
          onSubmit={handleCreate}
          className="rounded-2xl border border-stone-200 bg-white p-5 space-y-3 lg:col-span-4 h-fit text-xs"
        >
          <h2 className="text-sm font-extrabold">{ar ? 'إنشاء كود خصم' : 'New Coupon'}</h2>
          <input
            required
            dir="ltr"
            value={code}
            onChange={(e) => setCode(e.target.value.toUpperCase())}
            placeholder="ATLAS15"
            className="w-full rounded-xl border border-stone-300 px-3 py-2 font-bold uppercase text-start"
          />
          <select
            value={discountType}
            onChange={(e) => setDiscountType(e.target.value as CouponRow['discountType'])}
            className="w-full rounded-xl border border-stone-300 px-3 py-2 font-bold"
          >
            <option value="PERCENT">PERCENT (%)</option>
            <option value="FIXED">FIXED (MAD)</option>
            <option value="FREE_SHIPPING">FREE SHIPPING</option>
          </select>
          {discountType !== 'FREE_SHIPPING' && (
            <input
              type="number"
              value={discountValue}
              onChange={(e) => setDiscountValue(e.target.value)}
              placeholder="Discount Value"
              className="w-full rounded-xl border border-stone-300 px-3 py-2"
            />
          )}
          <input
            type="number"
            value={minOrderAmount}
            onChange={(e) => setMinOrderAmount(e.target.value)}
            placeholder={ar ? 'الحد الأدنى للطلب' : 'Min order amount'}
            className="w-full rounded-xl border border-stone-300 px-3 py-2"
          />
          <input
            type="number"
            value={maxUses}
            onChange={(e) => setMaxUses(e.target.value)}
            placeholder={ar ? 'حد الاستخدام الأقصى (اختياري)' : 'Max uses (optional)'}
            className="w-full rounded-xl border border-stone-300 px-3 py-2"
          />
          <button
            type="submit"
            className="btn-store-primary flex w-full items-center justify-center gap-1.5 py-2.5 font-extrabold"
          >
            <Plus className="h-4 w-4" />
            {ar ? 'إنشاء الكوبون' : 'Create Coupon'}
          </button>
        </form>

        <div className="rounded-2xl border border-stone-200 bg-white p-5 lg:col-span-8">
          {loading ? (
            <div className="flex justify-center py-12">
              <Loader2 className="h-6 w-6 animate-spin text-store-primary" />
            </div>
          ) : (
            <div className="divide-y divide-stone-100 text-sm">
              {coupons.map((c) => (
                <div key={c.id} className="flex items-center justify-between py-3">
                  <div>
                    <span dir="ltr" className="font-mono font-extrabold text-store-primary">
                      {c.code}
                    </span>
                    <span className="ms-2 rounded-md bg-stone-100 px-2 py-0.5 text-xs font-bold">
                      {c.discountType === 'PERCENT'
                        ? `${c.discountValue}%`
                        : c.discountType === 'FIXED'
                          ? formatPrice(c.discountValue)
                          : 'FREE SHIPPING'}
                    </span>
                    <p className="text-xs text-stone-500">
                      Used: {c.usedCount} / {c.maxUses ?? '∞'}
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={() => handleDelete(c.id)}
                    className="rounded-lg border border-stone-200 p-1.5 text-red-600 hover:bg-red-50"
                  >
                    <Trash2 className="h-4 w-4" />
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </AdminShell>
  );
}

