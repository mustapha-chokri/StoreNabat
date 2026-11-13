'use client';

import React, { useCallback, useEffect, useState } from 'react';
import {
  CheckCircle2,
  CheckSquare,
  Download,
  Edit3,
  Eye,
  FileSpreadsheet,
  Loader2,
  MessageCircle,
  Printer,
  RefreshCcw,
  Send,
  X,
} from 'lucide-react';
import { AdminShell } from '@/components/admin/AdminShell';
import { useStore } from '@/components/providers/StoreContextProvider';
import type { OrderStatus } from '@/db/schema/types';

const ALL_ORDER_STATUSES: OrderStatus[] = [
  'NEW',
  'PENDING_WHATSAPP_CONFIRMATION',
  'CONFIRMED',
  'PROCESSING',
  'READY_FOR_SHIPPING',
  'SHIPPED',
  'OUT_FOR_DELIVERY',
  'DELIVERED',
  'CANCELLED',
  'RETURNED',
  'REFUNDED',
];

interface OrderSummaryRow {
  id: string;
  orderNumber: string;
  customerName: string;
  phone: string;
  cityName: string;
  shippingAddress: string;
  orderStatus: OrderStatus;
  paymentMethod: string;
  paymentStatus: string;
  totalAmount: string;
  subtotal: string;
  shippingFee: string;
  discountAmount: string;
  codFee: string;
  trackingNumber: string | null;
  whatsappConfirmationStatus: string;
  createdAt: string;
  items: Array<{
    id: string;
    productTitle: string;
    variantTitle: string | null;
    quantity: number;
    unitPrice: string;
    lineTotal: string;
  }>;
}

interface OrderDetailResponse {
  order: OrderSummaryRow & {
    customerEmail: string | null;
    internalNotes: string | null;
    customerNotes: string | null;
    currency: string;
  };
  items: OrderSummaryRow['items'];
  history: Array<{
    id: string;
    newStatus: string;
    note: string | null;
    changedByEmail: string | null;
    createdAt: string;
  }>;
  transactions: Array<{
    id: string;
    gatewayCode: string;
    status: string;
    chargeAmount: string | null;
    chargeCurrency: string | null;
    baseAmountMad: string;
  }>;
  whatsappLogs: Array<{
    id: string;
    templateKey: string;
    status: string;
    createdAt: string;
  }>;
  whatsappQuickUrl: string;
  whatsappCloudEnabled: boolean;
}

export default function AdminOrdersPage() {
  const { locale, tr, formatPrice, ctx } = useStore();
  const ar = locale === 'ar';

  const [ordersList, setOrdersList] = useState<OrderSummaryRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [q, setQ] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const [paymentMethodFilter, setPaymentMethodFilter] = useState('');
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [bulkStatus, setBulkStatus] = useState<OrderStatus>('CONFIRMED');
  const [bulkBusy, setBulkBusy] = useState(false);

  const [detail, setDetail] = useState<OrderDetailResponse | null>(null);
  const [detailLoading, setDetailLoading] = useState(false);
  const [savingDetail, setSavingDetail] = useState(false);

  // Editable detail states
  const [nextStatus, setNextStatus] = useState<OrderStatus>('NEW');
  const [nextPaymentStatus, setNextPaymentStatus] = useState<string>('PENDING');
  const [trackingNumber, setTrackingNumber] = useState('');
  const [internalNotes, setInternalNotes] = useState('');
  const [editMode, setEditMode] = useState(false);
  const [editName, setEditName] = useState('');
  const [editPhone, setEditPhone] = useState('');
  const [editCity, setEditCity] = useState('');
  const [editAddr, setEditAddr] = useState('');

  // Print mode ('INVOICE' | 'LABEL' | null)
  const [printMode, setPrintMode] = useState<'INVOICE' | 'LABEL' | null>(null);

  const loadOrders = useCallback(async () => {
    setLoading(true);
    try {
      const qs = new URLSearchParams();
      if (q.trim()) qs.set('q', q.trim());
      if (statusFilter) qs.set('status', statusFilter);
      if (paymentMethodFilter) qs.set('paymentMethod', paymentMethodFilter);
      const res = await fetch(`/api/admin/orders?${qs.toString()}`);
      if (res.ok) {
        const d = await res.json();
        setOrdersList(d.orders || []);
      }
    } finally {
      setLoading(false);
    }
  }, [q, statusFilter, paymentMethodFilter]);

  useEffect(() => {
    loadOrders();
  }, [loadOrders]);

  async function openOrderDetail(id: string) {
    setDetailLoading(true);
    setEditMode(false);
    try {
      const res = await fetch(`/api/admin/orders/${encodeURIComponent(id)}`);
      if (res.ok) {
        const d = (await res.json()) as OrderDetailResponse;
        setDetail(d);
        setNextStatus(d.order.orderStatus);
        setNextPaymentStatus(d.order.paymentStatus);
        setTrackingNumber(d.order.trackingNumber || '');
        setInternalNotes(d.order.internalNotes || '');
        setEditName(d.order.customerName);
        setEditPhone(d.order.phone);
        setEditCity(d.order.cityName);
        setEditAddr(d.order.shippingAddress);
      }
    } finally {
      setDetailLoading(false);
    }
  }

  async function handleBulkUpdate() {
    if (selectedIds.length === 0) return;
    setBulkBusy(true);
    try {
      const res = await fetch('/api/admin/orders', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ orderIds: selectedIds, newStatus: bulkStatus }),
      });
      if (res.ok) {
        setSelectedIds([]);
        await loadOrders();
      }
    } finally {
      setBulkBusy(false);
    }
  }

  async function handleUpdateOrderStatus() {
    if (!detail) return;
    setSavingDetail(true);
    try {
      const res = await fetch(`/api/admin/orders/${detail.order.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'UPDATE_STATUS',
          orderStatus: nextStatus,
          paymentStatus: nextPaymentStatus,
          trackingNumber,
          internalNotes,
        }),
      });
      if (res.ok) {
        await openOrderDetail(detail.order.id);
        await loadOrders();
      } else {
        const d = await res.json().catch(() => ({}));
        alert(d.error || 'Failed to update order status');
      }
    } finally {
      setSavingDetail(false);
    }
  }

  async function handleQuickMarkPaid() {
    if (!detail) return;
    setSavingDetail(true);
    try {
      const res = await fetch(`/api/admin/orders/${detail.order.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'UPDATE_STATUS',
          orderStatus: nextStatus,
          paymentStatus: 'PAID',
          note: 'Marked as paid by admin (digital downloads unlocked)',
        }),
      });
      if (res.ok) {
        await openOrderDetail(detail.order.id);
        await loadOrders();
      } else {
        const d = await res.json().catch(() => ({}));
        alert(d.error || 'Failed to mark as paid');
      }
    } finally {
      setSavingDetail(false);
    }
  }

  async function handleSaveCustomerDetails(e: React.FormEvent) {
    e.preventDefault();
    if (!detail) return;
    setSavingDetail(true);
    try {
      const res = await fetch(`/api/admin/orders/${detail.order.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'EDIT_DETAILS',
          customerName: editName,
          phone: editPhone,
          cityName: editCity,
          shippingAddress: editAddr,
          trackingNumber,
          internalNotes,
        }),
      });
      if (res.ok) {
        setEditMode(false);
        await openOrderDetail(detail.order.id);
        await loadOrders();
      }
    } finally {
      setSavingDetail(false);
    }
  }

  async function handleWhatsAppCloudAction(sendViaCloudApi: boolean) {
    if (!detail) return;
    setSavingDetail(true);
    try {
      const res = await fetch(`/api/admin/orders/${detail.order.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'WHATSAPP_ACTION',
          whatsappConfirmationStatus: 'CONFIRMED_BY_CUSTOMER',
          sendViaCloudApi,
        }),
      });
      if (res.ok) {
        await openOrderDetail(detail.order.id);
        await loadOrders();
      } else {
        const d = await res.json().catch(() => ({}));
        alert(d.error || 'Failed to update WhatsApp confirmation');
      }
    } catch {
      alert('Network error while updating WhatsApp confirmation');
    } finally {
      setSavingDetail(false);
    }
  }

  async function handleRefund() {
    if (!detail) return;
    if (!confirm(ar ? 'هل تريد فعلاً استرجاع مبلغ هذا الطلب؟' : 'Refund this payment?')) return;
    setSavingDetail(true);
    try {
      const res = await fetch(`/api/admin/orders/${detail.order.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'REFUND' }),
      });
      if (res.ok) {
        await openOrderDetail(detail.order.id);
        await loadOrders();
      }
    } finally {
      setSavingDetail(false);
    }
  }

  function triggerPrint(mode: 'INVOICE' | 'LABEL') {
    setPrintMode(mode);
    setTimeout(() => {
      window.print();
    }, 150);
  }

  return (
    <AdminShell>
      {/* Print sheet visible ONLY during print */}
      {printMode && detail && (
        <div className="hidden print:block p-8 text-black bg-white">
          {printMode === 'INVOICE' ? (
            <div className="space-y-6">
              <div className="flex justify-between border-b pb-4">
                <div>
                  <h1 className="text-2xl font-extrabold">
                    {ctx?.settings?.storeNameI18n?.ar || 'نبات الأطلس | Nabat Al Atlas'}
                  </h1>
                  <p className="text-sm">{ctx?.settings?.phone}</p>
                  <p className="text-sm">{ctx?.settings?.email}</p>
                </div>
                <div className="text-end">
                  <p className="text-lg font-bold">INVOICE #{detail.order.orderNumber}</p>
                  <p className="text-sm">
                    {new Date(detail.order.createdAt).toLocaleDateString()}
                  </p>
                </div>
              </div>

              <div className="text-sm space-y-1">
                <p>
                  <strong>{ar ? 'الزبون:' : 'Customer:'}</strong> {detail.order.customerName}
                </p>
                <p>
                  <strong>{ar ? 'الهاتف:' : 'Phone:'}</strong> {detail.order.phone}
                </p>
                <p>
                  <strong>{ar ? 'العنوان:' : 'Address:'}</strong> {detail.order.cityName} —{' '}
                  {detail.order.shippingAddress}
                </p>
              </div>

              <table className="w-full border-collapse text-sm">
                <thead>
                  <tr className="border-b bg-stone-100">
                    <th className="p-2 text-start">Item</th>
                    <th className="p-2 text-center">Qty</th>
                    <th className="p-2 text-end">Total</th>
                  </tr>
                </thead>
                <tbody>
                  {detail.items.map((it) => (
                    <tr key={it.id} className="border-b">
                      <td className="p-2">
                        {it.productTitle} {it.variantTitle ? `(${it.variantTitle})` : ''}
                      </td>
                      <td className="p-2 text-center">{it.quantity}</td>
                      <td className="p-2 text-end">{formatPrice(it.lineTotal)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>

              <div className="text-end space-y-1 text-sm">
                <p>Subtotal: {formatPrice(detail.order.subtotal)}</p>
                <p>Shipping: {formatPrice(detail.order.shippingFee)}</p>
                {Number(detail.order.discountAmount) > 0 && (
                  <p>Discount: -{formatPrice(detail.order.discountAmount)}</p>
                )}
                <p className="text-lg font-extrabold">
                  TOTAL: {formatPrice(detail.order.totalAmount)} ({detail.order.paymentMethod})
                </p>
              </div>
            </div>
          ) : (
            <div className="mx-auto max-w-md border-2 border-black p-6 space-y-3">
              <div className="border-b border-black pb-2 flex justify-between">
                <strong className="text-base">SHIPPING LABEL</strong>
                <span dir="ltr" className="font-mono font-bold">
                  #{detail.order.orderNumber}
                </span>
              </div>
              <p className="text-base font-bold">{detail.order.customerName}</p>
              <p dir="ltr" className="text-base font-mono">
                {detail.order.phone}
              </p>
              <p className="text-sm font-bold">{detail.order.cityName}</p>
              <p className="text-sm">{detail.order.shippingAddress}</p>
              <div className="border-t border-black pt-2 flex justify-between text-base font-extrabold">
                <span>COD / TOTAL:</span>
                <span>
                  {detail.order.paymentStatus === 'PAID'
                    ? 'PAID (0.00 MAD)'
                    : formatPrice(detail.order.totalAmount)}
                </span>
              </div>
              {detail.order.trackingNumber && (
                <p dir="ltr" className="font-mono text-xs pt-2">
                  TRACKING: {detail.order.trackingNumber}
                </p>
              )}
            </div>
          )}
        </div>
      )}

      <div className="space-y-5 no-print">
        {/* Top Filters & Exports */}
        <div className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-stone-200 bg-white p-4">
          <div className="flex flex-wrap items-center gap-2.5">
            <input
              type="search"
              value={q}
              onChange={(e) => setQ(e.target.value)}
              placeholder={ar ? 'ابحث برقم الطلب، الهاتف، الاسم...' : 'Search order #, phone, name...'}
              className="w-60 rounded-xl border border-stone-300 px-3 py-2 text-xs focus:border-emerald-700 focus:outline-none"
            />
            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
              className="rounded-xl border border-stone-300 px-3 py-2 text-xs"
            >
              <option value="">{ar ? 'جميع الحالات' : 'All Statuses'}</option>
              {ALL_ORDER_STATUSES.map((s) => (
                <option key={s} value={s}>
                  {tr(`orderStatus.${s}`)}
                </option>
              ))}
            </select>
            <select
              value={paymentMethodFilter}
              onChange={(e) => setPaymentMethodFilter(e.target.value)}
              className="rounded-xl border border-stone-300 px-3 py-2 text-xs"
            >
              <option value="">{ar ? 'كل طرق الدفع' : 'All Payments'}</option>
              <option value="COD">COD</option>
              <option value="CMI">CMI</option>
              <option value="STRIPE">Stripe</option>
              <option value="PAYPAL">PayPal</option>
            </select>
            <button
              type="button"
              onClick={loadOrders}
              className="rounded-xl border border-stone-200 p-2 text-stone-600 hover:bg-stone-50"
            >
              <RefreshCcw className="h-4 w-4" />
            </button>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <a
              href="/api/admin/orders/export?format=csv"
              download
              className="inline-flex items-center gap-1.5 rounded-xl border border-stone-300 bg-white px-3 py-2 text-xs font-bold text-stone-700 hover:bg-stone-50"
            >
              <Download className="h-3.5 w-3.5" />
              CSV
            </a>
            <a
              href="/api/admin/orders/export?format=xlsx"
              download
              className="inline-flex items-center gap-1.5 rounded-xl border border-emerald-700 bg-emerald-50 px-3 py-2 text-xs font-bold text-emerald-900 hover:bg-emerald-100"
            >
              <FileSpreadsheet className="h-3.5 w-3.5" />
              Excel
            </a>
          </div>
        </div>

        {/* Bulk Update Toolbar */}
        {selectedIds.length > 0 && (
          <div className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-emerald-300 bg-emerald-50 px-4 py-3 text-xs">
            <span className="font-extrabold text-emerald-950">
              <CheckSquare className="me-1.5 inline h-4 w-4" />
              {selectedIds.length} {ar ? 'طلب محدد' : 'selected'}
            </span>
            <div className="flex items-center gap-2">
              <select
                value={bulkStatus}
                onChange={(e) => setBulkStatus(e.target.value as OrderStatus)}
                className="rounded-xl border border-emerald-300 bg-white px-3 py-1.5 font-bold"
              >
                {ALL_ORDER_STATUSES.map((s) => (
                  <option key={s} value={s}>
                    {tr(`orderStatus.${s}`)}
                  </option>
                ))}
              </select>
              <button
                type="button"
                disabled={bulkBusy}
                onClick={handleBulkUpdate}
                className="btn-store-primary px-4 py-1.5 font-bold"
              >
                {ar ? 'تحديث جماعي' : 'Apply Bulk'}
              </button>
            </div>
          </div>
        )}

        {/* Orders Table */}
        <div className="overflow-hidden rounded-2xl border border-stone-200 bg-white shadow-2xs">
          {loading ? (
            <div className="flex min-h-[240px] items-center justify-center">
              <Loader2 className="h-6 w-6 animate-spin text-store-primary" />
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-xs sm:text-sm">
                <thead className="border-b border-stone-200 bg-stone-50 text-stone-600">
                  <tr>
                    <th className="p-3 text-start">
                      <input
                        type="checkbox"
                        checked={
                          ordersList.length > 0 && selectedIds.length === ordersList.length
                        }
                        onChange={(e) =>
                          setSelectedIds(e.target.checked ? ordersList.map((o) => o.id) : [])
                        }
                      />
                    </th>
                    <th className="p-3 text-start">{ar ? 'رقم الطلب' : 'Order #'}</th>
                    <th className="p-3 text-start">{ar ? 'الزبون' : 'Customer'}</th>
                    <th className="p-3 text-start">{ar ? 'المدينة' : 'City'}</th>
                    <th className="p-3 text-start">{ar ? 'الدفع' : 'Payment'}</th>
                    <th className="p-3 text-start">{ar ? 'الحالة' : 'Status'}</th>
                    <th className="p-3 text-end">{ar ? 'المبلغ' : 'Total'}</th>
                    <th className="p-3 text-end">{ar ? 'إجراءات' : 'Actions'}</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-stone-100">
                  {ordersList.map((ord) => (
                    <tr key={ord.id} className="hover:bg-stone-50/70">
                      <td className="p-3">
                        <input
                          type="checkbox"
                          checked={selectedIds.includes(ord.id)}
                          onChange={(e) =>
                            setSelectedIds((prev) =>
                              e.target.checked
                                ? [...prev, ord.id]
                                : prev.filter((x) => x !== ord.id)
                            )
                          }
                        />
                      </td>
                      <td className="p-3 font-extrabold text-stone-900">
                        <span dir="ltr">{ord.orderNumber}</span>
                        <p className="text-[11px] font-normal text-stone-400">
                          {new Date(ord.createdAt).toLocaleString()}
                        </p>
                      </td>
                      <td className="p-3">
                        <p className="font-bold text-stone-900">{ord.customerName}</p>
                        <div className="flex items-center gap-1.5 pt-0.5">
                          <span dir="ltr" className="text-xs text-stone-500">
                            {ord.phone}
                          </span>
                          {ord.whatsappConfirmationStatus === 'CONFIRMED_BY_CUSTOMER' ? (
                            <span className="inline-flex items-center gap-0.5 rounded-full bg-emerald-100 px-1.5 py-0.5 text-[10px] font-extrabold text-emerald-800">
                              <CheckCircle2 className="h-3 w-3 text-emerald-600" />
                              WA ✓
                            </span>
                          ) : (
                            <span className="rounded-full bg-stone-100 px-1.5 py-0.5 text-[10px] text-stone-400">
                              WA?
                            </span>
                          )}
                        </div>
                      </td>
                      <td className="p-3 text-stone-700">{ord.cityName}</td>
                      <td className="p-3">
                        <span className="rounded-md bg-stone-100 px-2 py-0.5 text-[11px] font-bold">
                          {ord.paymentMethod}
                        </span>
                        <span className="ms-1 text-[11px] text-stone-500">
                          ({ord.paymentStatus})
                        </span>
                      </td>
                      <td className="p-3">
                        <span className="rounded-full bg-emerald-50 px-2.5 py-1 text-[11px] font-bold text-emerald-900">
                          {tr(`orderStatus.${ord.orderStatus}`)}
                        </span>
                      </td>
                      <td className="p-3 text-end font-extrabold text-stone-900 tabular-nums">
                        {formatPrice(ord.totalAmount)}
                      </td>
                      <td className="p-3 text-end">
                        <button
                          type="button"
                          onClick={() => openOrderDetail(ord.id)}
                          className="inline-flex items-center gap-1 rounded-xl border border-stone-200 px-3 py-1.5 text-xs font-bold text-stone-800 hover:bg-stone-100"
                        >
                          <Eye className="h-3.5 w-3.5" />
                          <span>{ar ? 'إدارة' : 'Manage'}</span>
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

      {/* Order Detail Modal */}
      {(detailLoading || detail) && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4 no-print">
          <div className="max-h-[92vh] w-full max-w-4xl overflow-y-auto rounded-3xl bg-white p-6 shadow-2xl space-y-6">
            {detailLoading || !detail ? (
              <div className="flex py-20 justify-center">
                <Loader2 className="h-7 w-7 animate-spin text-store-primary" />
              </div>
            ) : (
              <>
                <div className="flex flex-wrap items-center justify-between gap-3 border-b border-stone-100 pb-4">
                  <div>
                    <h2 dir="ltr" className="text-xl font-extrabold text-stone-900">
                      #{detail.order.orderNumber}
                    </h2>
                    <p className="text-xs text-stone-500">
                      {detail.order.paymentMethod} • {detail.order.paymentStatus}
                    </p>
                  </div>
                  <div className="flex flex-wrap items-center gap-2">
                    <button
                      type="button"
                      onClick={() => triggerPrint('INVOICE')}
                      className="inline-flex items-center gap-1.5 rounded-xl border border-stone-300 px-3 py-1.5 text-xs font-bold hover:bg-stone-50"
                    >
                      <Printer className="h-3.5 w-3.5" />
                      {ar ? 'فاتورة A4' : 'Print Invoice'}
                    </button>
                    <button
                      type="button"
                      onClick={() => triggerPrint('LABEL')}
                      className="inline-flex items-center gap-1.5 rounded-xl border border-stone-300 px-3 py-1.5 text-xs font-bold hover:bg-stone-50"
                    >
                      <Printer className="h-3.5 w-3.5" />
                      {ar ? 'ملصق الشحن' : 'Shipping Label'}
                    </button>
                    <button
                      type="button"
                      onClick={() => setDetail(null)}
                      className="rounded-lg p-1.5 text-stone-400 hover:bg-stone-100"
                    >
                      <X className="h-5 w-5" />
                    </button>
                  </div>
                </div>

                <div className="grid grid-cols-1 gap-6 lg:grid-cols-12">
                  <div className="space-y-4 lg:col-span-7">
                    {/* Customer Box */}
                    <div className="rounded-2xl border border-stone-200 p-4 space-y-2">
                      <div className="flex items-center justify-between">
                        <h3 className="text-xs font-extrabold uppercase text-stone-500">
                          {ar ? 'بيانات الزبون والتوصيل' : 'Customer & Delivery'}
                        </h3>
                        <button
                          type="button"
                          onClick={() => setEditMode((v) => !v)}
                          className="inline-flex items-center gap-1 text-xs font-bold text-store-primary"
                        >
                          <Edit3 className="h-3.5 w-3.5" />
                          <span>{ar ? 'تعديل' : 'Edit'}</span>
                        </button>
                      </div>

                      {editMode ? (
                        <form onSubmit={handleSaveCustomerDetails} className="space-y-2.5 pt-2">
                          <input
                            type="text"
                            value={editName}
                            onChange={(e) => setEditName(e.target.value)}
                            className="w-full rounded-xl border border-stone-300 px-3 py-1.5 text-xs"
                          />
                          <input
                            type="text"
                            dir="ltr"
                            value={editPhone}
                            onChange={(e) => setEditPhone(e.target.value)}
                            className="w-full rounded-xl border border-stone-300 px-3 py-1.5 text-xs text-start"
                          />
                          <input
                            type="text"
                            value={editCity}
                            onChange={(e) => setEditCity(e.target.value)}
                            className="w-full rounded-xl border border-stone-300 px-3 py-1.5 text-xs"
                          />
                          <input
                            type="text"
                            value={editAddr}
                            onChange={(e) => setEditAddr(e.target.value)}
                            className="w-full rounded-xl border border-stone-300 px-3 py-1.5 text-xs"
                          />
                          <button
                            type="submit"
                            disabled={savingDetail}
                            className="btn-store-primary px-4 py-2 text-xs font-bold"
                          >
                            {ar ? 'حفظ التعديلات' : 'Save Details'}
                          </button>
                        </form>
                      ) : (
                        <div className="text-sm space-y-1">
                          <p className="font-bold">{detail.order.customerName}</p>
                          <p dir="ltr" className="text-xs text-stone-600">
                            {detail.order.phone}
                          </p>
                          <p className="text-xs text-stone-600">
                            {detail.order.cityName} — {detail.order.shippingAddress}
                          </p>
                          {detail.order.customerNotes && (
                            <p className="text-xs text-amber-800">
                              Note: {detail.order.customerNotes}
                            </p>
                          )}
                        </div>
                      )}
                    </div>

                    {/* Items */}
                    <div className="rounded-2xl border border-stone-200 p-4 space-y-2">
                      <h3 className="text-xs font-extrabold uppercase text-stone-500">
                        {ar ? 'المنتجات' : 'Items'}
                      </h3>
                      <div className="divide-y divide-stone-100 text-sm">
                        {detail.items.map((it) => (
                          <div key={it.id} className="flex justify-between py-2">
                            <span>
                              {it.productTitle}{' '}
                              {it.variantTitle ? `(${it.variantTitle})` : ''} × {it.quantity}
                            </span>
                            <span className="font-bold tabular-nums">
                              {formatPrice(it.lineTotal)}
                            </span>
                          </div>
                        ))}
                      </div>
                      <div className="flex justify-between border-t border-stone-100 pt-2 font-extrabold">
                        <span>{ar ? 'الإجمالي' : 'Total'}</span>
                        <span className="text-store-primary tabular-nums">
                          {formatPrice(detail.order.totalAmount)}
                        </span>
                      </div>
                    </div>

                    {/* WhatsApp Actions */}
                    <div className="rounded-2xl border border-emerald-200 bg-emerald-50/50 p-4 space-y-3">
                      <div className="flex items-center justify-between">
                        <span className="text-xs font-extrabold text-emerald-950">
                          {ar ? 'تأكيد الطلب عبر واتساب' : 'WhatsApp Order Confirmation'}
                        </span>
                        {detail.order.whatsappConfirmationStatus === 'CONFIRMED_BY_CUSTOMER' ? (
                          <span className="inline-flex items-center gap-1 rounded-full bg-emerald-200 px-2.5 py-0.5 text-xs font-black text-emerald-900">
                            <CheckCircle2 className="h-3.5 w-3.5 text-emerald-700" />
                            {ar ? 'مؤكد من الزبون' : 'Confirmed'}
                          </span>
                        ) : (
                          <span className="rounded-full bg-amber-100 px-2.5 py-0.5 text-xs font-bold text-amber-900">
                            {ar ? 'بانتظار التأكيد' : 'Pending Confirmation'}
                          </span>
                        )}
                      </div>
                      <div className="flex flex-wrap gap-2">
                        <a
                          href={detail.whatsappQuickUrl}
                          target="_blank"
                          rel="noreferrer"
                          className="inline-flex items-center gap-1.5 rounded-xl bg-emerald-600 px-3.5 py-2 text-xs font-bold text-white hover:bg-emerald-500 shadow-xs"
                        >
                          <MessageCircle className="h-4 w-4" />
                          {ar ? 'مراسلة عبر واتساب' : 'Open WhatsApp Chat'}
                        </a>
                        <button
                          type="button"
                          disabled={savingDetail}
                          onClick={() => handleWhatsAppCloudAction(false)}
                          className={`rounded-xl px-3.5 py-2 text-xs font-bold transition-all shadow-xs ${
                            detail.order.whatsappConfirmationStatus === 'CONFIRMED_BY_CUSTOMER'
                              ? 'border border-emerald-300 bg-emerald-100 text-emerald-900'
                              : 'bg-emerald-800 text-white hover:bg-emerald-700'
                          }`}
                        >
                          {detail.order.whatsappConfirmationStatus === 'CONFIRMED_BY_CUSTOMER'
                            ? ar
                              ? '✓ تم التأكيد بنجاح'
                              : '✓ Confirmed'
                            : ar
                            ? 'تعيين كمؤكد واتساب'
                            : 'Mark WA Confirmed'}
                        </button>
                        {detail.whatsappCloudEnabled && (
                          <button
                            type="button"
                            disabled={savingDetail}
                            onClick={() => handleWhatsAppCloudAction(true)}
                            className="inline-flex items-center gap-1 rounded-xl bg-stone-900 px-3.5 py-2 text-xs font-bold text-white shadow-xs hover:bg-stone-800"
                          >
                            <Send className="h-3.5 w-3.5" />
                            Cloud API
                          </button>
                        )}
                      </div>
                    </div>
                  </div>

                  {/* Right column: Status, Tracking & Timeline */}
                  <div className="space-y-4 lg:col-span-5">
                    <div className="rounded-2xl border border-stone-200 p-4 space-y-3">
                      <h3 className="text-xs font-extrabold uppercase text-stone-500">
                        {ar ? 'تحديث الحالة والتتبع' : 'Status & Tracking'}
                      </h3>
                      <div>
                        <label className="mb-1 block text-[11px] font-bold text-stone-600">
                          {ar ? 'حالة الطلب:' : 'Order Status:'}
                        </label>
                        <select
                          value={nextStatus}
                          onChange={(e) => setNextStatus(e.target.value as OrderStatus)}
                          className="w-full rounded-xl border border-stone-300 px-3 py-2 text-xs font-bold"
                        >
                          {ALL_ORDER_STATUSES.map((s) => (
                            <option key={s} value={s}>
                              {tr(`orderStatus.${s}`)}
                            </option>
                          ))}
                        </select>
                      </div>

                      <div>
                        <label className="mb-1 block text-[11px] font-bold text-stone-600">
                          {ar ? 'حالة الدفع والأداء:' : 'Payment Status:'}
                        </label>
                        <select
                          value={nextPaymentStatus}
                          onChange={(e) => setNextPaymentStatus(e.target.value)}
                          className="w-full rounded-xl border border-stone-300 px-3 py-2 text-xs font-bold"
                        >
                          <option value="PENDING">{ar ? 'في انتظار الدفع (PENDING)' : 'Pending'}</option>
                          <option value="PAID">{ar ? 'تم الأداء (PAID) — تفعيل التحميل الرقمي' : 'Paid'}</option>
                          <option value="FAILED">{ar ? 'فشل الدفع (FAILED)' : 'Failed'}</option>
                          <option value="REFUNDED">{ar ? 'مسترجع (REFUNDED)' : 'Refunded'}</option>
                        </select>
                      </div>

                      {detail.order.paymentStatus !== 'PAID' && (
                        <button
                          type="button"
                          disabled={savingDetail}
                          onClick={handleQuickMarkPaid}
                          className="flex w-full items-center justify-center gap-1.5 rounded-xl bg-emerald-700 py-2.5 text-xs font-black text-white shadow-sm hover:bg-emerald-600 active:scale-95 transition-all"
                        >
                          <CheckCircle2 className="h-4 w-4" />
                          <span>{ar ? 'تعيين كـ: تم الأداء (تفعيل التحميل الرقمي)' : 'Mark as Paid (Unlock Downloads)'}</span>
                        </button>
                      )}

                      <input
                        type="text"
                        dir="ltr"
                        value={trackingNumber}
                        onChange={(e) => setTrackingNumber(e.target.value)}
                        placeholder={ar ? 'رقم التتبع (اختياري)' : 'Tracking #'}
                        className="w-full rounded-xl border border-stone-300 px-3 py-2 text-xs text-start"
                      />
                      <textarea
                        rows={2}
                        value={internalNotes}
                        onChange={(e) => setInternalNotes(e.target.value)}
                        placeholder={ar ? 'ملاحظات داخلية...' : 'Internal notes...'}
                        className="w-full rounded-xl border border-stone-300 px-3 py-2 text-xs"
                      />
                      <button
                        type="button"
                        disabled={savingDetail}
                        onClick={handleUpdateOrderStatus}
                        className="btn-store-primary w-full py-2.5 text-xs font-extrabold"
                      >
                        {ar ? 'حفظ التغييرات' : 'Save Changes'}
                      </button>

                      {detail.order.paymentStatus === 'PAID' &&
                        detail.order.paymentMethod !== 'COD' && (
                          <button
                            type="button"
                            onClick={handleRefund}
                            className="w-full rounded-xl border border-red-300 bg-red-50 py-2 text-xs font-bold text-red-700 hover:bg-red-100"
                          >
                            {ar ? 'استرجاع المبلغ (Refund)' : 'Refund Payment'}
                          </button>
                        )}
                    </div>

                    <div className="rounded-2xl border border-stone-200 p-4 space-y-2.5">
                      <h3 className="text-xs font-extrabold uppercase text-stone-500">
                        {ar ? 'سجل التغييرات' : 'Timeline'}
                      </h3>
                      <div className="space-y-2 text-xs">
                        {detail.history.map((h) => (
                          <div key={h.id} className="border-s-2 border-emerald-700 ps-2.5">
                            <p className="font-bold">{tr(`orderStatus.${h.newStatus}`)}</p>
                            {h.note && <p className="text-stone-500">{h.note}</p>}
                            <p dir="ltr" className="text-[10px] text-stone-400">
                              {h.changedByEmail || 'system'} •{' '}
                              {new Date(h.createdAt).toLocaleString()}
                            </p>
                          </div>
                        ))}
                      </div>
                    </div>
                  </div>
                </div>
              </>
            )}
          </div>
        </div>
      )}
    </AdminShell>
  );
}
