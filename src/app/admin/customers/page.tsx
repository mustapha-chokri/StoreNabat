'use client';

import React, { useCallback, useEffect, useState } from 'react';
import { AlertTriangle, Ban, CheckCircle, Loader2 } from 'lucide-react';
import { AdminShell } from '@/components/admin/AdminShell';
import { useStore } from '@/components/providers/StoreContextProvider';

interface AdminCustomerRow {
  id: string;
  fullName: string;
  email: string | null;
  phone: string;
  isBlacklisted: boolean;
  blacklistReason: string | null;
  ordersCount: number;
  totalSpent: string;
  hasDuplicatePhone: boolean;
  notes: string | null;
}

export default function AdminCustomersPage() {
  const { locale, formatPrice } = useStore();
  const ar = locale === 'ar';

  const [customers, setCustomers] = useState<AdminCustomerRow[]>([]);
  const [q, setQ] = useState('');
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch(`/api/admin/customers?q=${encodeURIComponent(q.trim())}`);
      if (res.ok) {
        const d = await res.json();
        setCustomers(d.customers || []);
      }
    } finally {
      setLoading(false);
    }
  }, [q]);

  useEffect(() => {
    load();
  }, [load]);

  async function toggleBlacklist(c: AdminCustomerRow) {
    const next = !c.isBlacklisted;
    const reason = next
      ? prompt(ar ? 'سبب الحظر:' : 'Blacklist reason:', c.blacklistReason || 'Repeated returns')
      : null;
    if (next && reason === null) return;
    await fetch('/api/admin/customers', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        id: c.id,
        isBlacklisted: next,
        blacklistReason: reason,
      }),
    });
    await load();
  }

  return (
    <AdminShell>
      <div className="space-y-5">
        <div className="rounded-2xl border border-stone-200 bg-white p-4">
          <input
            type="search"
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder={ar ? 'بحث بالاسم، الهاتف، البريد...' : 'Search name, phone, email...'}
            className="w-72 rounded-xl border border-stone-300 px-3 py-2 text-xs focus:border-emerald-700 focus:outline-none"
          />
        </div>

        <div className="overflow-hidden rounded-2xl border border-stone-200 bg-white">
          {loading ? (
            <div className="flex justify-center py-16">
              <Loader2 className="h-6 w-6 animate-spin text-store-primary" />
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-xs sm:text-sm">
                <thead className="border-b border-stone-200 bg-stone-50 text-stone-600">
                  <tr>
                    <th className="p-3 text-start">{ar ? 'الزبون' : 'Customer'}</th>
                    <th className="p-3 text-start">{ar ? 'الهاتف' : 'Phone'}</th>
                    <th className="p-3 text-start">{ar ? 'الطلبات' : 'Orders'}</th>
                    <th className="p-3 text-start">{ar ? 'إجمالي الإنفاق' : 'Total Spent'}</th>
                    <th className="p-3 text-start">{ar ? 'التحذيرات' : 'Risk / Status'}</th>
                    <th className="p-3 text-end">{ar ? 'حظر' : 'Action'}</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-stone-100">
                  {customers.map((c) => (
                    <tr key={c.id}>
                      <td className="p-3 font-bold text-stone-900">
                        {c.fullName}
                        {c.email && <p className="text-[11px] font-normal text-stone-400">{c.email}</p>}
                      </td>
                      <td dir="ltr" className="p-3 text-start">
                        {c.phone}
                      </td>
                      <td className="p-3 tabular-nums">{c.ordersCount}</td>
                      <td className="p-3 font-bold tabular-nums">{formatPrice(c.totalSpent)}</td>
                      <td className="p-3 space-x-1">
                        {c.hasDuplicatePhone && (
                          <span className="inline-flex items-center gap-1 rounded-full bg-amber-50 px-2 py-0.5 text-[11px] font-bold text-amber-800">
                            <AlertTriangle className="h-3 w-3" />
                            {ar ? 'هاتف مكرر' : 'Dup Phone'}
                          </span>
                        )}
                        {c.isBlacklisted ? (
                          <span className="inline-flex items-center gap-1 rounded-full bg-red-50 px-2 py-0.5 text-[11px] font-bold text-red-700">
                            <Ban className="h-3 w-3" />
                            {ar ? 'محظور' : 'Blacklisted'}
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-1 rounded-full bg-emerald-50 px-2 py-0.5 text-[11px] font-bold text-emerald-800">
                            <CheckCircle className="h-3 w-3" />
                            OK
                          </span>
                        )}
                      </td>
                      <td className="p-3 text-end">
                        <button
                          type="button"
                          onClick={() => toggleBlacklist(c)}
                          className={`rounded-xl px-3 py-1.5 text-xs font-bold ${
                            c.isBlacklisted
                              ? 'border border-emerald-700 text-emerald-800 hover:bg-emerald-50'
                              : 'border border-red-300 text-red-700 hover:bg-red-50'
                          }`}
                        >
                          {c.isBlacklisted
                            ? ar
                              ? 'إلغاء الحظر'
                              : 'Unblock'
                            : ar
                              ? 'إضافة للقائمة السوداء'
                              : 'Blacklist'}
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>
    </AdminShell>
  );
}

