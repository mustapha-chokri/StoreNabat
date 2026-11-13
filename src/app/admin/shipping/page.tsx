'use client';

import React, { useCallback, useEffect, useState } from 'react';
import { Loader2, Plus, Save, Trash2, Truck } from 'lucide-react';
import { AdminShell } from '@/components/admin/AdminShell';
import { useStore } from '@/components/providers/StoreContextProvider';
import type { I18nMap } from '@/db/schema/types';

interface CityRow {
  id: string;
  regionCode: string;
  regionNameI18n: I18nMap;
  cityNameI18n: I18nMap;
  deliveryFee: string;
  codFee: string;
  codEnabled: boolean;
  freeShippingMinOrder: string | null;
  estimatedDaysI18n: I18nMap;
  isActive: boolean;
}

interface ProviderRow {
  id: string;
  code: string;
  name: string;
  isEnabled: boolean;
}

export default function AdminShippingPage() {
  const { locale, pick, formatPrice } = useStore();
  const ar = locale === 'ar';

  const [cities, setCities] = useState<CityRow[]>([]);
  const [providers, setProviders] = useState<ProviderRow[]>([]);
  const [loading, setLoading] = useState(true);

  // Add city state
  const [cityAr, setCityAr] = useState('');
  const [cityFr, setCityFr] = useState('');
  const [regionAr, setRegionAr] = useState('');
  const [fee, setFee] = useState('35');
  const [freeMin, setFreeMin] = useState('300');

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch('/api/admin/shipping');
      if (res.ok) {
        const d = await res.json();
        setCities(d.cities || []);
        setProviders(d.providers || []);
      }
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  async function addCity(e: React.FormEvent) {
    e.preventDefault();
    const res = await fetch('/api/admin/shipping', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        entity: 'CITY',
        data: {
          regionCode: 'CUSTOM',
          regionNameI18n: { ar: regionAr || cityAr, fr: cityFr || cityAr, en: cityFr || cityAr },
          cityNameI18n: { ar: cityAr, fr: cityFr || cityAr, en: cityFr || cityAr },
          deliveryFee: Number(fee),
          codFee: 0,
          codEnabled: true,
          freeShippingMinOrder: freeMin ? Number(freeMin) : null,
          isActive: true,
        },
      }),
    });
    if (res.ok) {
      setCityAr('');
      setCityFr('');
      await load();
    }
  }

  async function updateCity(city: CityRow, patch: Partial<CityRow>) {
    await fetch('/api/admin/shipping', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        entity: 'CITY',
        id: city.id,
        data: { ...city, ...patch },
      }),
    });
    await load();
  }

  async function deleteCity(id: string) {
    if (!confirm(ar ? 'حذف المدينة؟' : 'Delete city?')) return;
    await fetch(`/api/admin/shipping?entity=CITY&id=${encodeURIComponent(id)}`, {
      method: 'DELETE',
    });
    await load();
  }

  async function toggleProvider(p: ProviderRow) {
    await fetch('/api/admin/shipping', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        entity: 'PROVIDER',
        id: p.id,
        data: { isEnabled: !p.isEnabled, config: {} },
      }),
    });
    await load();
  }

  return (
    <AdminShell>
      <div className="space-y-6">
        {loading ? (
          <div className="flex justify-center py-16">
            <Loader2 className="h-6 w-6 animate-spin text-store-primary" />
          </div>
        ) : (
          <>
            {/* Courier Provider Adapters */}
            <div className="rounded-2xl border border-stone-200 bg-white p-5 space-y-3">
              <h2 className="text-sm font-extrabold text-stone-900 flex items-center gap-2">
                <Truck className="h-4 w-4 text-store-primary" />
                <span>{ar ? 'مزودو الشحن والربط البرمجي' : 'Shipping Adapters'}</span>
              </h2>
              <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
                {providers.map((p) => (
                  <div
                    key={p.id}
                    className="flex items-center justify-between rounded-xl border border-stone-200 p-3.5 text-xs"
                  >
                    <div>
                      <p className="font-bold text-stone-900">{p.name}</p>
                      <p className="text-stone-400">{p.code}</p>
                    </div>
                    <button
                      type="button"
                      onClick={() => toggleProvider(p)}
                      className={`rounded-lg px-3 py-1.5 font-bold ${
                        p.isEnabled
                          ? 'bg-emerald-100 text-emerald-900'
                          : 'bg-stone-100 text-stone-600'
                      }`}
                    >
                      {p.isEnabled ? (ar ? 'مفعل' : 'Enabled') : ar ? 'معطل' : 'Disabled'}
                    </button>
                  </div>
                ))}
              </div>
            </div>

            {/* Add City */}
            <form
              onSubmit={addCity}
              className="flex flex-wrap items-end gap-3 rounded-2xl border border-stone-200 bg-white p-4 text-xs"
            >
              <div>
                <label className="mb-1 block font-bold">{ar ? 'المدينة (عربية) *' : 'City AR *'}</label>
                <input
                  required
                  value={cityAr}
                  onChange={(e) => setCityAr(e.target.value)}
                  className="rounded-xl border border-stone-300 px-3 py-2"
                />
              </div>
              <div>
                <label className="mb-1 block font-bold">City FR</label>
                <input
                  value={cityFr}
                  onChange={(e) => setCityFr(e.target.value)}
                  className="rounded-xl border border-stone-300 px-3 py-2"
                />
              </div>
              <div>
                <label className="mb-1 block font-bold">{ar ? 'الجهة' : 'Region'}</label>
                <input
                  value={regionAr}
                  onChange={(e) => setRegionAr(e.target.value)}
                  className="rounded-xl border border-stone-300 px-3 py-2"
                />
              </div>
              <div>
                <label className="mb-1 block font-bold">{ar ? 'رسوم التوصيل' : 'Fee (MAD)'}</label>
                <input
                  type="number"
                  value={fee}
                  onChange={(e) => setFee(e.target.value)}
                  className="w-24 rounded-xl border border-stone-300 px-3 py-2"
                />
              </div>
              <div>
                <label className="mb-1 block font-bold">{ar ? 'مجاني فوق' : 'Free Over'}</label>
                <input
                  type="number"
                  value={freeMin}
                  onChange={(e) => setFreeMin(e.target.value)}
                  className="w-24 rounded-xl border border-stone-300 px-3 py-2"
                />
              </div>
              <button
                type="submit"
                className="btn-store-primary inline-flex items-center gap-1.5 px-4 py-2 font-extrabold"
              >
                <Plus className="h-4 w-4" />
                {ar ? 'إضافة مدينة' : 'Add City'}
              </button>
            </form>

            {/* Cities Table */}
            <div className="overflow-hidden rounded-2xl border border-stone-200 bg-white">
              <div className="overflow-x-auto">
                <table className="w-full text-xs sm:text-sm">
                  <thead className="border-b border-stone-200 bg-stone-50 text-stone-600">
                    <tr>
                      <th className="p-3 text-start">{ar ? 'المدينة' : 'City'}</th>
                      <th className="p-3 text-start">{ar ? 'الجهة' : 'Region'}</th>
                      <th className="p-3 text-start">{ar ? 'التوصيل' : 'Delivery Fee'}</th>
                      <th className="p-3 text-start">{ar ? 'الشحن المجاني فوق' : 'Free Over'}</th>
                      <th className="p-3 text-start">COD</th>
                      <th className="p-3 text-end">{ar ? 'إجراءات' : 'Actions'}</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-stone-100">
                    {cities.map((c) => (
                      <tr key={c.id}>
                        <td className="p-3 font-bold text-stone-900">{pick(c.cityNameI18n)}</td>
                        <td className="p-3 text-stone-500">{pick(c.regionNameI18n)}</td>
                        <td className="p-3 font-bold tabular-nums">{formatPrice(c.deliveryFee)}</td>
                        <td className="p-3 text-stone-600 tabular-nums">
                          {c.freeShippingMinOrder ? formatPrice(c.freeShippingMinOrder) : '—'}
                        </td>
                        <td className="p-3">
                          <button
                            type="button"
                            onClick={() => updateCity(c, { codEnabled: !c.codEnabled })}
                            className={`rounded-md px-2 py-0.5 text-[11px] font-bold ${
                              c.codEnabled
                                ? 'bg-emerald-50 text-emerald-900'
                                : 'bg-stone-100 text-stone-500'
                            }`}
                          >
                            {c.codEnabled ? 'COD ON' : 'COD OFF'}
                          </button>
                        </td>
                        <td className="p-3 text-end space-x-2">
                          <button
                            type="button"
                            onClick={() => {
                              const nextFee = prompt(
                                ar ? 'أدخل سعر التوصيل الجديد (MAD):' : 'New fee (MAD):',
                                c.deliveryFee
                              );
                              if (nextFee !== null && nextFee !== '') {
                                updateCity(c, { deliveryFee: nextFee });
                              }
                            }}
                            className="inline-flex rounded-lg border border-stone-200 p-1.5 hover:bg-stone-50"
                          >
                            <Save className="h-3.5 w-3.5" />
                          </button>
                          <button
                            type="button"
                            onClick={() => deleteCity(c.id)}
                            className="inline-flex rounded-lg border border-stone-200 p-1.5 text-red-600 hover:bg-red-50"
                          >
                            <Trash2 className="h-3.5 w-3.5" />
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          </>
        )}
      </div>
    </AdminShell>
  );
}

