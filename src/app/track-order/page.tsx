'use client';

import React, { Suspense, useCallback, useEffect, useState } from 'react';
import { useSearchParams } from 'next/navigation';
import { CheckCircle2, Clock, Download, Loader2, PackageSearch, Truck } from 'lucide-react';
import { useStore } from '@/components/providers/StoreContextProvider';
import { StorefrontShell } from '@/components/storefront/StorefrontShell';

interface TrackedOrderResult {
  order: {
    orderNumber: string;
    orderStatus: string;
    paymentMethod: string;
    paymentStatus: string;
    customerName: string;
    cityName: string;
    subtotal: string;
    discountAmount: string;
    shippingFee: string;
    codFee: string;
    totalAmount: string;
    currency: string;
    trackingNumber: string | null;
    createdAt: string;
  };
  items: Array<{
    id: string;
    productTitle: string;
    variantTitle: string | null;
    quantity: number;
    lineTotal: string;
  }>;
  history: Array<{
    id: string;
    previousStatus: string | null;
    newStatus: string;
    note: string | null;
    createdAt: string;
  }>;
  downloads: Array<{
    accessToken: string;
    fileName: string;
    downloadCount: number;
    maxDownloads: number | null;
  }>;
  digitalPendingPayment?: boolean;
}

function TrackOrderInner() {
  const sp = useSearchParams();
  const { tr, formatPrice, locale } = useStore();

  const [orderNumber, setOrderNumber] = useState(sp.get('orderNumber') || '');
  const [phone, setPhone] = useState(sp.get('phone') || '');
  const [loading, setLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [result, setResult] = useState<TrackedOrderResult | null>(null);

  const performLookup = useCallback(async (num: string, tel: string) => {
    if (!num.trim()) return;
    setLoading(true);
    setErrorMsg(null);
    try {
      const qs = new URLSearchParams({ orderNumber: num.trim() });
      if (tel.trim()) qs.set('phone', tel.trim());
      const res = await fetch(`/api/storefront/orders/track?${qs.toString()}`);
      const d = await res.json();
      if (!res.ok) {
        setResult(null);
        setErrorMsg(
          locale === 'ar'
            ? 'لم يتم العثور على هذا الطلب. تحقق من رقم الطلب والهاتف.'
            : locale === 'fr'
              ? 'Commande introuvable. Vérifiez le numéro et le téléphone.'
              : 'Order not found. Please check your order number and phone.'
        );
      } else {
        setResult(d);
      }
    } finally {
      setLoading(false);
    }
  }, [locale]);

  useEffect(() => {
    const initialNum = sp.get('orderNumber');
    if (initialNum) {
      performLookup(initialNum, sp.get('phone') || '');
    }
  }, [sp, performLookup]);

  return (
    <div className="mx-auto max-w-3xl px-4 py-10 sm:px-6 space-y-8">
      <div className="text-center space-y-2">
        <PackageSearch className="mx-auto h-10 w-10 text-store-primary" />
        <h1 className="text-2xl sm:text-3xl font-extrabold text-stone-900">
          {tr('nav.trackOrder')}
        </h1>
        <p className="text-sm text-stone-500">
          {locale === 'ar'
            ? 'أدخل رقم طلبك (مثال: NA-2026-00001-XXXX) لمعرفة حالته الفورية'
            : locale === 'fr'
              ? 'Entrez votre numéro de commande pour suivre son statut en temps réel'
              : 'Enter your order number to check live delivery status'}
        </p>
      </div>

      <form
        onSubmit={(e) => {
          e.preventDefault();
          performLookup(orderNumber, phone);
        }}
        className="rounded-3xl border border-stone-200 bg-white p-6 shadow-xs space-y-4"
      >
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <div>
            <label className="mb-1 block text-xs font-semibold text-stone-700">
              {tr('thankyou.orderNumber')} *
            </label>
            <input
              type="text"
              required
              dir="ltr"
              value={orderNumber}
              onChange={(e) => setOrderNumber(e.target.value)}
              placeholder="NA-2026-00001-..."
              className="w-full rounded-xl border border-stone-300 px-3.5 py-2.5 text-sm text-start focus:border-emerald-700 focus:outline-none"
            />
          </div>
          <div>
            <label className="mb-1 block text-xs font-semibold text-stone-700">
              {tr('checkout.phone')} ({locale === 'ar' ? 'اختياري للتحقق الكامل' : 'optional'})
            </label>
            <input
              type="tel"
              dir="ltr"
              value={phone}
              onChange={(e) => setPhone(e.target.value)}
              placeholder="0612345678"
              className="w-full rounded-xl border border-stone-300 px-3.5 py-2.5 text-sm text-start focus:border-emerald-700 focus:outline-none"
            />
          </div>
        </div>

        <button
          type="submit"
          disabled={loading}
          className="btn-store-primary flex w-full items-center justify-center gap-2 py-3 text-sm font-extrabold"
        >
          {loading && <Loader2 className="h-4 w-4 animate-spin" />}
          <span>{tr('thankyou.trackOrder')}</span>
        </button>
      </form>

      {errorMsg && (
        <div className="rounded-2xl border border-red-200 bg-red-50 p-4 text-center text-sm font-semibold text-red-700">
          {errorMsg}
        </div>
      )}

      {result && (
        <div className="space-y-6 rounded-3xl border border-stone-200 bg-white p-6 shadow-xs">
          <div className="flex flex-wrap items-center justify-between gap-3 border-b border-stone-100 pb-4">
            <div>
              <h2 dir="ltr" className="text-lg font-extrabold text-stone-900">
                #{result.order.orderNumber}
              </h2>
              <p className="text-xs text-stone-500">
                {result.order.customerName} — {result.order.cityName}
              </p>
            </div>
            <div className="flex flex-wrap gap-2">
              <span className="rounded-full bg-emerald-100 px-3 py-1 text-xs font-extrabold text-emerald-950">
                {tr(`orderStatus.${result.order.orderStatus}`)}
              </span>
              {result.order.trackingNumber && (
                <span className="inline-flex items-center gap-1 rounded-full bg-amber-50 px-3 py-1 text-xs font-bold text-amber-900">
                  <Truck className="h-3.5 w-3.5" />
                  <span dir="ltr">{result.order.trackingNumber}</span>
                </span>
              )}
            </div>
          </div>

          {/* Digital Downloads Section (Prominent) */}
          {result.downloads.length > 0 && (
            <div className="rounded-2xl border-2 border-emerald-300 bg-emerald-50/90 p-5 space-y-3 shadow-sm">
              <div className="flex items-center gap-2 text-emerald-950 font-black">
                <Download className="h-5 w-5 text-emerald-700" />
                <h3 className="text-base font-black">
                  {tr('thankyou.downloadsReady')}
                </h3>
              </div>
              <p className="text-xs text-emerald-800">
                {locale === 'ar'
                  ? 'تم تأكيد الأداء بنجاح! ملفاتك الرقمية جاهزة ومتاحة للتحميل الفوري:'
                  : locale === 'fr'
                    ? 'Paiement confirmé avec succès ! Vos fichiers numériques sont prêts au téléchargement :'
                    : 'Payment confirmed! Your digital files are ready for immediate download:'}
              </p>
              <div className="space-y-2 pt-1">
                {result.downloads.map((d) => (
                  <div
                    key={d.accessToken}
                    className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-emerald-200 bg-white p-3.5 shadow-sm"
                  >
                    <div>
                      <p className="font-extrabold text-stone-900 text-sm">{d.fileName}</p>
                      <p className="text-xs text-stone-400">
                        {tr('thankyou.downloadLimit')}: {d.downloadCount} / {d.maxDownloads ?? '∞'}
                      </p>
                    </div>
                    <a
                      href={`/api/digital/download/${encodeURIComponent(d.accessToken)}`}
                      className="inline-flex items-center gap-2 rounded-xl bg-emerald-800 px-5 py-2.5 text-xs font-black text-white hover:bg-emerald-700 active:scale-95 transition-all shadow-md"
                    >
                      <Download className="h-4 w-4" />
                      <span>{tr('thankyou.downloadNow')}</span>
                    </a>
                  </div>
                ))}
              </div>
            </div>
          )}

          {result.digitalPendingPayment && (
            <div className="rounded-2xl border border-amber-200 bg-amber-50/80 p-4 space-y-1.5">
              <div className="flex items-center gap-2">
                <Clock className="h-4 w-4 text-amber-700 shrink-0" />
                <p className="text-xs font-bold text-amber-900">
                  {locale === 'ar'
                    ? 'الملفات الرقمية في انتظار تأكيد استلام الدفع'
                    : locale === 'fr'
                      ? 'Fichiers numériques en attente de confirmation du paiement'
                      : 'Digital files pending payment verification'}
                </p>
              </div>
              <p className="text-xs text-amber-800 leading-relaxed">
                {locale === 'ar'
                  ? 'يتضمن هذا الطلب منتجات رقمية. سيتم تفعيل روابط التحميل وإظهارها هنا تلقائياً فور تأكيد إدارة المتجر أو بوابة الدفع استلام المبلغ.'
                  : locale === 'fr'
                    ? 'Cette commande contient des produits numériques. Les liens de téléchargement seront activés dès confirmation de la réception du paiement par notre équipe.'
                    : 'This order includes digital products. Download links will appear here automatically once payment receipt is verified by our team.'}
              </p>
            </div>
          )}

          <div className="space-y-3">
            <h3 className="text-sm font-extrabold text-stone-900">
              {locale === 'ar'
                ? 'سجل حالة الطلب'
                : locale === 'fr'
                  ? 'Historique de suivi'
                  : 'Status Timeline'}
            </h3>
            <div className="space-y-2.5">
              {result.history.map((h, idx) => (
                <div key={h.id} className="flex items-start gap-3 text-sm">
                  {idx === 0 ? (
                    <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-store-primary" />
                  ) : (
                    <Clock className="mt-0.5 h-4 w-4 shrink-0 text-stone-400" />
                  )}
                  <div className="flex-1">
                    <p className="font-bold text-stone-900">
                      {tr(`orderStatus.${h.newStatus}`)}
                    </p>
                    {h.note && <p className="text-xs text-stone-500">{h.note}</p>}
                  </div>
                  <span dir="ltr" className="text-xs text-stone-400">
                    {new Date(h.createdAt).toLocaleString()}
                  </span>
                </div>
              ))}
            </div>
          </div>

          <div className="border-t border-stone-100 pt-4 space-y-2 text-sm">
            {result.items.map((it) => (
              <div key={it.id} className="flex justify-between text-stone-700">
                <span>
                  {it.productTitle} × {it.quantity}
                </span>
                <span className="font-bold tabular-nums">{formatPrice(it.lineTotal)}</span>
              </div>
            ))}
            <div className="flex justify-between border-t border-stone-100 pt-2 text-base font-extrabold text-stone-900">
              <span>{tr('checkout.total')}</span>
              <span className="text-store-primary tabular-nums">
                {formatPrice(result.order.totalAmount)}
              </span>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export default function TrackOrderPage() {
  return (
    <StorefrontShell>
      <Suspense fallback={<div className="p-12 text-center">...</div>}>
        <TrackOrderInner />
      </Suspense>
    </StorefrontShell>
  );
}

