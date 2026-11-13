'use client';

import React, { useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import {
  AlertTriangle,
  ArrowUpRight,
  Banknote,
  CheckCircle2,
  Clock,
  Loader2,
  ShoppingBag,
  TrendingUp,
  Users,
  XCircle,
} from 'lucide-react';
import {
  Area,
  AreaChart,
  CartesianGrid,
  Cell,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';
import { AdminShell } from '@/components/admin/AdminShell';
import { useStore } from '@/components/providers/StoreContextProvider';
import type { I18nMap } from '@/db/schema/types';

interface AnalyticsResponse {
  kpis: {
    totalRevenue: number;
    totalOrders: number;
    pendingOrders: number;
    confirmedOrders: number;
    deliveredOrders: number;
    cancelledOrders: number;
    averageOrderValue: number;
    conversionRate: number | null;
  };
  salesChart: Array<{ date: string; revenue: number; orders: number }>;
  statusChart: Array<{ status: string; count: number }>;
  bestSellers: Array<{
    id: string;
    slug: string;
    titleI18n: I18nMap;
    salesCount: number;
    regularPrice: string;
    stockQuantity: number;
  }>;
  lowStockProducts: Array<{
    id: string;
    titleI18n: I18nMap;
    stockQuantity: number;
    lowStockThreshold: number;
  }>;
  recentOrders: Array<{
    id: string;
    orderNumber: string;
    customerName: string;
    cityName: string;
    totalAmount: string;
    orderStatus: string;
    paymentMethod: string;
    createdAt: string;
  }>;
  recentCustomers: Array<{
    id: string;
    fullName: string;
    phone: string;
    ordersCount: number;
    totalSpent: string;
  }>;
}

const PIE_COLORS = ['#14532D', '#D97706', '#0369A1', '#15803D', '#DC2626', '#7C3AED'];

export default function AdminDashboardPage() {
  const { locale, pick, formatPrice, tr } = useStore();
  const [data, setData] = useState<AnalyticsResponse | null>(null);
  const [loading, setLoading] = useState(true);

  const [fromDate, setFromDate] = useState('');
  const [toDate, setToDate] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const [categories, setCategories] = useState<Array<{ id: string; nameI18n: I18nMap }>>([]);
  const [categoryId, setCategoryId] = useState('');

  const loadAnalytics = useCallback(async () => {
    setLoading(true);
    try {
      const qs = new URLSearchParams();
      if (fromDate) qs.set('from', fromDate);
      if (toDate) qs.set('to', toDate);
      if (statusFilter) qs.set('status', statusFilter);
      if (categoryId) qs.set('categoryId', categoryId);
      const res = await fetch(`/api/admin/analytics?${qs.toString()}`);
      if (res.ok) setData(await res.json());
    } finally {
      setLoading(false);
    }
  }, [fromDate, toDate, statusFilter, categoryId]);

  useEffect(() => {
    fetch('/api/admin/categories')
      .then((r) => (r.ok ? r.json() : { categories: [] }))
      .then((d) => setCategories(d.categories || []))
      .catch(() => {});
  }, []);

  useEffect(() => {
    loadAnalytics();
  }, [loadAnalytics]);

  const ar = locale === 'ar';

  return (
    <AdminShell>
      <div className="space-y-6">
        {/* Filters bar */}
        <div className="flex flex-wrap items-end justify-between gap-3 rounded-2xl border border-stone-200 bg-white p-4">
          <div className="flex flex-wrap items-end gap-3">
            <div>
              <label className="mb-1 block text-[11px] font-bold text-stone-500">
                {ar ? 'من تاريخ' : 'From'}
              </label>
              <input
                type="date"
                value={fromDate}
                onChange={(e) => setFromDate(e.target.value)}
                className="rounded-xl border border-stone-200 px-3 py-1.5 text-xs"
              />
            </div>
            <div>
              <label className="mb-1 block text-[11px] font-bold text-stone-500">
                {ar ? 'إلى تاريخ' : 'To'}
              </label>
              <input
                type="date"
                value={toDate}
                onChange={(e) => setToDate(e.target.value)}
                className="rounded-xl border border-stone-200 px-3 py-1.5 text-xs"
              />
            </div>
            <div>
              <label className="mb-1 block text-[11px] font-bold text-stone-500">
                {ar ? 'الحالة' : 'Status'}
              </label>
              <select
                value={statusFilter}
                onChange={(e) => setStatusFilter(e.target.value)}
                className="rounded-xl border border-stone-200 px-3 py-1.5 text-xs"
              >
                <option value="">{ar ? 'الكل' : 'All'}</option>
                {[
                  'NEW',
                  'PENDING_WHATSAPP_CONFIRMATION',
                  'CONFIRMED',
                  'PROCESSING',
                  'SHIPPED',
                  'DELIVERED',
                  'CANCELLED',
                  'RETURNED',
                ].map((s) => (
                  <option key={s} value={s}>
                    {tr(`orderStatus.${s}`)}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="mb-1 block text-[11px] font-bold text-stone-500">
                {ar ? 'التصنيف' : 'Category'}
              </label>
              <select
                value={categoryId}
                onChange={(e) => setCategoryId(e.target.value)}
                className="rounded-xl border border-stone-200 px-3 py-1.5 text-xs"
              >
                <option value="">{ar ? 'الكل' : 'All'}</option>
                {categories.map((c) => (
                  <option key={c.id} value={c.id}>
                    {pick(c.nameI18n)}
                  </option>
                ))}
              </select>
            </div>
          </div>

          <button
            type="button"
            onClick={() => {
              setFromDate('');
              setToDate('');
              setStatusFilter('');
              setCategoryId('');
            }}
            className="rounded-xl border border-stone-200 px-3 py-1.5 text-xs font-bold text-stone-600 hover:bg-stone-50"
          >
            {ar ? 'إعادة ضبط' : 'Reset'}
          </button>
        </div>

        {loading || !data ? (
          <div className="flex min-h-[240px] items-center justify-center">
            <Loader2 className="h-7 w-7 animate-spin text-store-primary" />
          </div>
        ) : (
          <>
            {/* KPI Cards */}
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
              {[
                {
                  label: ar ? 'إجمالي الإيرادات' : 'Total Revenue',
                  value: formatPrice(data.kpis.totalRevenue),
                  icon: Banknote,
                  color: 'text-emerald-800 bg-emerald-50',
                },
                {
                  label: ar ? 'إجمالي الطلبات' : 'Total Orders',
                  value: data.kpis.totalOrders,
                  icon: ShoppingBag,
                  color: 'text-stone-800 bg-stone-100',
                },
                {
                  label: ar ? 'طلبات بانتظار التأكيد' : 'Pending Orders',
                  value: data.kpis.pendingOrders,
                  icon: Clock,
                  color: 'text-amber-700 bg-amber-50',
                },
                {
                  label: ar ? 'طلبات مؤكدة / مشحونة' : 'Confirmed / Active',
                  value: data.kpis.confirmedOrders,
                  icon: CheckCircle2,
                  color: 'text-sky-700 bg-sky-50',
                },
                {
                  label: ar ? 'تم تسليمها' : 'Delivered',
                  value: data.kpis.deliveredOrders,
                  icon: CheckCircle2,
                  color: 'text-emerald-700 bg-emerald-50',
                },
                {
                  label: ar ? 'ملغاة' : 'Cancelled',
                  value: data.kpis.cancelledOrders,
                  icon: XCircle,
                  color: 'text-red-700 bg-red-50',
                },
                {
                  label: ar ? 'متوسط قيمة الطلب' : 'Average Order Value',
                  value: formatPrice(data.kpis.averageOrderValue),
                  icon: TrendingUp,
                  color: 'text-violet-700 bg-violet-50',
                },
                {
                  label: ar ? 'معدل التحويل (LP)' : 'Conversion Rate',
                  value:
                    data.kpis.conversionRate !== null
                      ? `${data.kpis.conversionRate}%`
                      : ar
                        ? 'متاح عند التتبع'
                        : 'N/A',
                  icon: ArrowUpRight,
                  color: 'text-amber-800 bg-amber-50',
                },
              ].map((kpi, idx) => (
                <div
                  key={idx}
                  className="rounded-2xl border border-stone-200 bg-white p-4 shadow-2xs"
                >
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-semibold text-stone-500">{kpi.label}</span>
                    <span className={`rounded-xl p-2 ${kpi.color}`}>
                      <kpi.icon className="h-4 w-4" />
                    </span>
                  </div>
                  <p className="mt-2 text-lg sm:text-xl font-extrabold text-stone-900 tabular-nums">
                    {kpi.value}
                  </p>
                </div>
              ))}
            </div>

            {/* Charts */}
            <div className="grid grid-cols-1 gap-6 lg:grid-cols-12">
              <div className="rounded-2xl border border-stone-200 bg-white p-5 lg:col-span-8">
                <h2 className="mb-4 text-sm font-extrabold text-stone-900">
                  {ar ? 'المبيعات والإيرادات اليومية' : 'Sales & Revenue Trend'}
                </h2>
                {data.salesChart.length === 0 ? (
                  <p className="py-16 text-center text-xs text-stone-400">
                    {ar ? 'لا توجد بيانات مبيعات للفترة المحددة' : 'No sales data in range'}
                  </p>
                ) : (
                  <div className="h-72 w-full" dir="ltr">
                    <ResponsiveContainer width="100%" height="100%">
                      <AreaChart data={data.salesChart}>
                        <CartesianGrid strokeDasharray="3 3" stroke="#e7e5e4" />
                        <XAxis dataKey="date" tick={{ fontSize: 11 }} />
                        <YAxis tick={{ fontSize: 11 }} />
                        <Tooltip />
                        <Area
                          type="monotone"
                          dataKey="revenue"
                          stroke="#14532D"
                          fill="#14532D"
                          fillOpacity={0.15}
                        />
                      </AreaChart>
                    </ResponsiveContainer>
                  </div>
                )}
              </div>

              <div className="rounded-2xl border border-stone-200 bg-white p-5 lg:col-span-4">
                <h2 className="mb-4 text-sm font-extrabold text-stone-900">
                  {ar ? 'توزيع حالات الطلبات' : 'Orders by Status'}
                </h2>
                {data.statusChart.length === 0 ? (
                  <p className="py-16 text-center text-xs text-stone-400">—</p>
                ) : (
                  <div className="h-72 w-full" dir="ltr">
                    <ResponsiveContainer width="100%" height="100%">
                      <PieChart>
                        <Pie
                          data={data.statusChart}
                          dataKey="count"
                          nameKey="status"
                          innerRadius={50}
                          outerRadius={85}
                        >
                          {data.statusChart.map((_, i) => (
                            <Cell key={i} fill={PIE_COLORS[i % PIE_COLORS.length]} />
                          ))}
                        </Pie>
                        <Tooltip />
                      </PieChart>
                    </ResponsiveContainer>
                  </div>
                )}
              </div>
            </div>

            {/* Recent Orders, Low Stock, Best Sellers, Recent Customers */}
            <div className="grid grid-cols-1 gap-6 lg:grid-cols-12">
              <div className="rounded-2xl border border-stone-200 bg-white p-5 lg:col-span-7 space-y-3">
                <div className="flex items-center justify-between">
                  <h2 className="text-sm font-extrabold text-stone-900">
                    {ar ? 'أحدث الطلبات' : 'Recent Orders'}
                  </h2>
                  <Link
                    href="/admin/orders"
                    className="text-xs font-bold text-store-primary hover:underline"
                  >
                    {ar ? 'عرض الكل' : 'View All'}
                  </Link>
                </div>
                <div className="divide-y divide-stone-100 text-xs">
                  {data.recentOrders.map((o) => (
                    <div key={o.id} className="flex items-center justify-between py-2.5">
                      <div>
                        <p dir="ltr" className="font-bold text-stone-900">
                          {o.orderNumber}
                        </p>
                        <p className="text-stone-500">
                          {o.customerName} — {o.cityName}
                        </p>
                      </div>
                      <div className="text-end">
                        <p className="font-extrabold text-store-primary tabular-nums">
                          {formatPrice(o.totalAmount)}
                        </p>
                        <span className="text-[11px] text-stone-500">
                          {tr(`orderStatus.${o.orderStatus}`)}
                        </span>
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              <div className="space-y-6 lg:col-span-5">
                {/* Low Stock */}
                <div className="rounded-2xl border border-amber-200 bg-amber-50/40 p-5 space-y-3">
                  <div className="flex items-center gap-2 text-sm font-extrabold text-amber-950">
                    <AlertTriangle className="h-4 w-4 text-amber-600" />
                    <span>{ar ? 'تنبيهات انخفاض المخزون' : 'Low Stock Alerts'}</span>
                  </div>
                  {data.lowStockProducts.length === 0 ? (
                    <p className="text-xs text-stone-500">
                      {ar ? 'المخزون جيد حالياً.' : 'All stock levels healthy.'}
                    </p>
                  ) : (
                    <div className="space-y-2 text-xs">
                      {data.lowStockProducts.map((p) => (
                        <div key={p.id} className="flex justify-between">
                          <span className="font-semibold">{pick(p.titleI18n)}</span>
                          <span className="font-extrabold text-red-700">
                            {p.stockQuantity} / {p.lowStockThreshold}
                          </span>
                        </div>
                      ))}
                    </div>
                  )}
                </div>

                {/* Best Sellers */}
                <div className="rounded-2xl border border-stone-200 bg-white p-5 space-y-3">
                  <h2 className="text-sm font-extrabold text-stone-900">
                    {ar ? 'المنتجات الأكثر مبيعاً' : 'Best Sellers'}
                  </h2>
                  <div className="space-y-2 text-xs">
                    {data.bestSellers.map((p) => (
                      <div key={p.id} className="flex justify-between">
                        <span className="font-semibold text-stone-800">{pick(p.titleI18n)}</span>
                        <span className="font-bold text-store-primary">
                          {p.salesCount} {ar ? 'مبيعة' : 'sold'}
                        </span>
                      </div>
                    ))}
                  </div>
                </div>

                {/* Recent Customers */}
                <div className="rounded-2xl border border-stone-200 bg-white p-5 space-y-3">
                  <h2 className="flex items-center gap-2 text-sm font-extrabold text-stone-900">
                    <Users className="h-4 w-4 text-store-primary" />
                    <span>{ar ? 'نشاط الزبناء الأخير' : 'Recent Customers'}</span>
                  </h2>
                  <div className="space-y-2 text-xs">
                    {data.recentCustomers.map((c) => (
                      <div key={c.id} className="flex justify-between">
                        <span className="font-semibold">{c.fullName}</span>
                        <span className="text-stone-500 tabular-nums">
                          {c.ordersCount} • {formatPrice(c.totalSpent)}
                        </span>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            </div>
          </>
        )}
      </div>
    </AdminShell>
  );
}

