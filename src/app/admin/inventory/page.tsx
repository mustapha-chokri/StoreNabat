'use client';

import React, { useCallback, useEffect, useState } from 'react';
import { Loader2, Save } from 'lucide-react';
import { AdminShell } from '@/components/admin/AdminShell';
import { useStore } from '@/components/providers/StoreContextProvider';
import type { I18nMap } from '@/db/schema/types';

interface InvProduct {
  id: string;
  titleI18n: I18nMap;
  sku: string | null;
  stockQuantity: number;
  lowStockThreshold: number;
  hasVariants: boolean;
}

interface InvVariant {
  id: string;
  productId: string;
  titleI18n: I18nMap;
  sku: string | null;
  stockQuantity: number;
}

interface InvMovement {
  id: string;
  productId: string;
  movementType: string;
  quantityDelta: number;
  previousQuantity: number;
  newQuantity: number;
  note: string | null;
  actorEmail: string | null;
  createdAt: string;
}

export default function AdminInventoryPage() {
  const { locale, pick } = useStore();
  const ar = locale === 'ar';

  const [products, setProducts] = useState<InvProduct[]>([]);
  const [variants, setVariants] = useState<InvVariant[]>([]);
  const [movements, setMovements] = useState<InvMovement[]>([]);
  const [draftQty, setDraftQty] = useState<Record<string, number>>({});
  const [loading, setLoading] = useState(true);
  const [savingKey, setSavingKey] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch('/api/admin/inventory');
      if (res.ok) {
        const d = await res.json();
        setProducts(d.products || []);
        setVariants(d.variants || []);
        setMovements(d.movements || []);
      }
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  async function saveAdjustment(productId: string, variantId: string | null, qty: number) {
    const key = variantId || productId;
    setSavingKey(key);
    try {
      const res = await fetch('/api/admin/inventory', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          productId,
          variantId,
          newQuantity: qty,
          note: 'Manual dashboard update',
        }),
      });
      if (res.ok) await load();
    } finally {
      setSavingKey(null);
    }
  }

  return (
    <AdminShell>
      <div className="space-y-6">
        {loading ? (
          <div className="flex min-h-[240px] items-center justify-center">
            <Loader2 className="h-6 w-6 animate-spin text-store-primary" />
          </div>
        ) : (
          <>
            <div className="overflow-hidden rounded-2xl border border-stone-200 bg-white">
              <div className="border-b border-stone-100 px-5 py-4 font-extrabold text-sm">
                {ar ? 'مستويات المخزون الحالية' : 'Stock Levels'}
              </div>
              <div className="divide-y divide-stone-100 text-sm">
                {products.map((p) => {
                  const pVars = variants.filter((v) => v.productId === p.id);
                  if (p.hasVariants && pVars.length > 0) {
                    return pVars.map((v) => {
                      const val = draftQty[v.id] ?? v.stockQuantity;
                      return (
                        <div key={v.id} className="flex flex-wrap items-center justify-between gap-3 px-5 py-3">
                          <div>
                            <p className="font-bold text-stone-900">
                              {pick(p.titleI18n)} — <span className="text-emerald-800">{pick(v.titleI18n)}</span>
                            </p>
                            <p dir="ltr" className="text-xs text-stone-400">
                              {v.sku || p.sku || ''}
                            </p>
                          </div>
                          <div className="flex items-center gap-2">
                            <input
                              type="number"
                              min={0}
                              value={val}
                              onChange={(e) =>
                                setDraftQty((prev) => ({ ...prev, [v.id]: Number(e.target.value) }))
                              }
                              className="w-24 rounded-xl border border-stone-300 px-3 py-1.5 text-xs font-bold"
                            />
                            <button
                              type="button"
                              disabled={savingKey === v.id}
                              onClick={() => saveAdjustment(p.id, v.id, val)}
                              className="btn-store-primary inline-flex items-center gap-1 px-3 py-1.5 text-xs font-bold"
                            >
                              <Save className="h-3.5 w-3.5" />
                              {ar ? 'حفظ' : 'Save'}
                            </button>
                          </div>
                        </div>
                      );
                    });
                  }

                  const val = draftQty[p.id] ?? p.stockQuantity;
                  const low = p.stockQuantity <= p.lowStockThreshold;
                  return (
                    <div key={p.id} className="flex flex-wrap items-center justify-between gap-3 px-5 py-3">
                      <div>
                        <p className="font-bold text-stone-900">{pick(p.titleI18n)}</p>
                        {low && (
                          <span className="text-[11px] font-bold text-red-600">
                            {ar ? 'مخزون منخفض!' : 'Low stock!'}
                          </span>
                        )}
                      </div>
                      <div className="flex items-center gap-2">
                        <input
                          type="number"
                          min={0}
                          value={val}
                          onChange={(e) =>
                            setDraftQty((prev) => ({ ...prev, [p.id]: Number(e.target.value) }))
                          }
                          className="w-24 rounded-xl border border-stone-300 px-3 py-1.5 text-xs font-bold"
                        />
                        <button
                          type="button"
                          disabled={savingKey === p.id}
                          onClick={() => saveAdjustment(p.id, null, val)}
                          className="btn-store-primary inline-flex items-center gap-1 px-3 py-1.5 text-xs font-bold"
                        >
                          <Save className="h-3.5 w-3.5" />
                          {ar ? 'حفظ' : 'Save'}
                        </button>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>

            <div className="rounded-2xl border border-stone-200 bg-white p-5 space-y-3">
              <h2 className="text-sm font-extrabold text-stone-900">
                {ar ? 'سجل حركات المخزون' : 'Inventory Movements Audit'}
              </h2>
              <div className="divide-y divide-stone-100 text-xs">
                {movements.map((m) => (
                  <div key={m.id} className="flex flex-wrap items-center justify-between gap-2 py-2.5">
                    <div>
                      <span className="font-bold text-stone-800">{m.movementType}</span>{' '}
                      <span className={m.quantityDelta >= 0 ? 'text-emerald-700 font-bold' : 'text-red-700 font-bold'}>
                        ({m.quantityDelta >= 0 ? `+${m.quantityDelta}` : m.quantityDelta})
                      </span>
                      <span className="ms-2 text-stone-500">
                        {m.previousQuantity} → {m.newQuantity}
                      </span>
                      {m.note && <p className="text-stone-400">{m.note}</p>}
                    </div>
                    <span dir="ltr" className="text-stone-400">
                      {m.actorEmail || 'system'} • {new Date(m.createdAt).toLocaleString()}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          </>
        )}
      </div>
    </AdminShell>
  );
}

