'use client';

import React, { useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import {
  CheckCircle2,
  Clock,
  Download,
  Loader2,
  MessageCircle,
  PackageSearch,
  Sparkles,
  XCircle,
} from 'lucide-react';
import { useStore } from '@/components/providers/StoreContextProvider';
import { ProductCard, type ProductCardData } from './ProductCard';
import type { I18nMap } from '@/db/schema/types';

export interface ThankYouOrderData {
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
  items: Array<{
    id: string;
    productId: string | null;
    productTitle: string;
    variantTitle: string | null;
    quantity: number;
    lineTotal: string;
  }>;
  downloads: Array<{
    accessToken: string;
    fileName: string;
    downloadCount: number;
    maxDownloads: number | null;
  }>;
  digitalPendingPayment?: boolean;
}

export interface ThankYouRuleView {
  titleI18n: I18nMap;
  messageI18n: I18nMap;
  mediaUrl: string | null;
  mediaType: string | null;
  showOrderSummary: boolean;
  showWhatsappButton: boolean;
  showTrackingLink: boolean;
  showSocialLinks: boolean;
  sanitizedCustomHtml: string | null;
}

export function ThankYouClient({
  order,
  rule,
  whatsappConfirmUrl,
  upsells,
  paypalToken,
  cancelled,
}: {
  order: ThankYouOrderData;
  rule: ThankYouRuleView | null;
  whatsappConfirmUrl: string | null;
  upsells: ProductCardData[];
  paypalToken?: string;
  cancelled?: boolean;
}) {
  const router = useRouter();
  const { ctx, tr, pick, formatPrice, locale, setLocale, trackEvent } = useStore();
  const [capturingPaypal, setCapturingPaypal] = useState(
    Boolean(paypalToken && order.paymentStatus !== 'PAID')
  );
  const [captureError, setCaptureError] = useState<string | null>(null);
  const [markingPaid, setMarkingPaid] = useState(false);
  const trackedRef = useRef(false);

  async function handleMarkPaid() {
    setMarkingPaid(true);
    try {
      const res = await fetch('/api/storefront/orders/track/mark-paid', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          orderNumber: order.orderNumber,
        }),
      });
      const data = await res.json();
      if (res.ok && data.success) {
        router.refresh();
      } else {
        alert(data.error || 'Failed to update payment status');
      }
    } catch {
      alert('Network error');
    } finally {
      setMarkingPaid(false);
    }
  }

  useEffect(() => {
    if (!trackedRef.current && !cancelled) {
      trackedRef.current = true;
      trackEvent('Purchase', {
        value: Number(order.totalAmount),
        contentIds: order.items
          .map((i) => i.productId)
          .filter((id): id is string => Boolean(id)),
        orderNumber: order.orderNumber,
      });
    }
  }, [order.orderNumber, order.totalAmount, order.items, cancelled, trackEvent]);

  useEffect(() => {
    if (!paypalToken || order.paymentStatus === 'PAID') {
      setCapturingPaypal(false);
      return;
    }
    let active = true;
    async function capture() {
      try {
        const res = await fetch('/api/storefront/payments/paypal/capture', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            paypalOrderId: paypalToken,
            orderNumber: order.orderNumber,
          }),
        });
        const d = await res.json();
        if (!res.ok || !d.captured) {
          if (active) setCaptureError(d.error || 'PayPal capture failed');
        } else if (active) {
          router.refresh();
        }
      } catch {
        if (active) setCaptureError('PayPal verification error');
      } finally {
        if (active) setCapturingPaypal(false);
      }
    }
    capture();
    return () => {
      active = false;
    };
  }, [paypalToken, order.orderNumber, order.paymentStatus, router]);

  const title = rule
    ? pick(rule.titleI18n)
    : locale === 'ar'
      ? 'شكراً لطلبك!'
      : locale === 'fr'
        ? 'Merci pour votre commande !'
        : 'Thank you for your order!';

  const message = rule
    ? pick(rule.messageI18n)
    : locale === 'ar'
      ? 'تم استلام طلبك بنجاح.'
      : locale === 'fr'
        ? 'Votre commande a été reçue avec succès.'
        : 'Your order has been received.';

  const social = ctx?.settings?.socialLinks || {};

  return (
    <div className="mx-auto max-w-4xl px-4 py-10 sm:px-6 lg:px-8 space-y-8">
      {cancelled && (
        <div className="flex items-center gap-3 rounded-2xl border border-amber-300 bg-amber-50 p-4 text-sm font-semibold text-amber-900">
          <XCircle className="h-5 w-5 shrink-0 text-amber-600" />
          <span>
            {locale === 'ar'
              ? 'تم إلغاء عملية الدفع الإلكتروني. طلبك لا يزال مسجلاً ويمكنك تأكيده معنا عبر واتساب.'
              : 'Online payment was cancelled. Your order is saved — reach out on WhatsApp if you need help.'}
          </span>
        </div>
      )}

      {capturingPaypal && (
        <div className="flex items-center justify-center gap-2 rounded-2xl border border-emerald-200 bg-emerald-50 p-4 text-sm font-bold text-emerald-900">
          <Loader2 className="h-4 w-4 animate-spin" />
          <span>
            {locale === 'ar'
              ? 'جاري تأكيد عملية الدفع عبر PayPal...'
              : 'Verifying PayPal payment...'}
          </span>
        </div>
      )}

      {captureError && (
        <div className="rounded-2xl border border-red-200 bg-red-50 p-4 text-sm text-red-700">
          {captureError}
        </div>
      )}

      {/* Hero Confirmation Card */}
      <div className="rounded-3xl border border-stone-200 bg-white p-6 sm:p-10 text-center shadow-sm space-y-5">
        <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-full bg-emerald-100 text-store-primary">
          <CheckCircle2 className="h-9 w-9" />
        </div>

        <div className="space-y-2">
          {/* Language selector for Thank You page */}
          <div className="flex items-center justify-center gap-1.5 pb-2">
            {(['ar', 'fr', 'en'] as const).map((lang) => (
              <button
                key={lang}
                type="button"
                onClick={() => setLocale(lang)}
                className={`rounded-full px-3.5 py-1 text-xs font-bold transition-all ${
                  locale === lang
                    ? 'bg-store-primary text-white shadow-xs'
                    : 'bg-stone-100 text-stone-600 hover:bg-stone-200'
                }`}
              >
                {lang === 'ar' ? 'العربية' : lang === 'fr' ? 'Français' : 'English'}
              </button>
            ))}
          </div>

          <p className="text-xs font-bold uppercase tracking-wider text-stone-500">
            {tr('thankyou.orderNumber')}:{' '}
            <span dir="ltr" className="font-extrabold text-stone-900">
              {order.orderNumber}
            </span>
          </p>
          <h1 className="text-2xl sm:text-3xl font-extrabold text-stone-900">{title}</h1>
          <p className="mx-auto max-w-xl text-sm sm:text-base text-stone-600">{message}</p>
        </div>

        {rule?.mediaUrl && (
          <div className="mx-auto max-w-lg overflow-hidden rounded-2xl border border-stone-200">
            {rule.mediaType === 'VIDEO' ? (
              <video src={rule.mediaUrl} controls className="w-full" />
            ) : (
              <img src={rule.mediaUrl} alt="" className="w-full object-cover" />
            )}
          </div>
        )}

        <div className="flex flex-wrap items-center justify-center gap-3 pt-2">
          {(rule?.showWhatsappButton ?? true) && whatsappConfirmUrl && (
            <a
              href={whatsappConfirmUrl}
              target="_blank"
              rel="noreferrer"
              className="inline-flex items-center gap-2 rounded-xl bg-emerald-600 px-6 py-3 text-sm font-extrabold text-white shadow-md hover:bg-emerald-500"
            >
              <MessageCircle className="h-5 w-5" />
              <span>{tr('thankyou.confirmWhatsapp')}</span>
            </a>
          )}

          {(rule?.showTrackingLink ?? true) && (
            <Link
              href={`/track-order?orderNumber=${encodeURIComponent(order.orderNumber)}`}
              className="inline-flex items-center gap-2 rounded-xl border border-stone-300 bg-white px-5 py-3 text-sm font-bold text-stone-800 hover:bg-stone-50"
            >
              <PackageSearch className="h-4 w-4 text-store-primary" />
              <span>{tr('thankyou.trackOrder')}</span>
            </Link>
          )}

          <Link
            href="/"
            className="inline-flex items-center gap-2 rounded-xl border border-stone-200 px-5 py-3 text-sm font-semibold text-stone-600 hover:bg-stone-50"
          >
            <span>{tr('thankyou.backHome')}</span>
          </Link>
        </div>

        {(rule?.showSocialLinks ?? true) &&
          (social.instagram || social.facebook || social.tiktok) && (
            <div className="flex flex-wrap items-center justify-center gap-2 pt-2 text-xs">
              {social.instagram && (
                <a
                  href={social.instagram}
                  target="_blank"
                  rel="noreferrer"
                  className="rounded-lg bg-stone-100 px-3 py-1.5 font-semibold text-stone-700 hover:bg-stone-200"
                >
                  Instagram
                </a>
              )}
              {social.facebook && (
                <a
                  href={social.facebook}
                  target="_blank"
                  rel="noreferrer"
                  className="rounded-lg bg-stone-100 px-3 py-1.5 font-semibold text-stone-700 hover:bg-stone-200"
                >
                  Facebook
                </a>
              )}
              {social.tiktok && (
                <a
                  href={social.tiktok}
                  target="_blank"
                  rel="noreferrer"
                  className="rounded-lg bg-stone-100 px-3 py-1.5 font-semibold text-stone-700 hover:bg-stone-200"
                >
                  TikTok
                </a>
              )}
            </div>
          )}
      </div>

      {/* Digital downloads if ready */}
      {order.downloads.length > 0 && (
        <div className="rounded-3xl border border-sky-200 bg-sky-50/70 p-6 space-y-3">
          <div className="flex items-center gap-2 text-sky-950 font-extrabold">
            <Sparkles className="h-5 w-5 text-sky-700" />
            <h2>{tr('thankyou.downloadsReady')}</h2>
          </div>
          <div className="space-y-2">
            {order.downloads.map((d) => (
              <div
                key={d.accessToken}
                className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-sky-200 bg-white px-4 py-3"
              >
                <div>
                  <p className="text-sm font-bold text-stone-900">{d.fileName}</p>
                  {d.maxDownloads !== null && (
                    <p className="text-xs text-stone-500">
                      {d.downloadCount} / {d.maxDownloads}
                    </p>
                  )}
                </div>
                <a
                  href={`/api/digital/download/${encodeURIComponent(d.accessToken)}`}
                  className="inline-flex items-center gap-2 rounded-xl bg-sky-700 px-4 py-2 text-xs font-bold text-white hover:bg-sky-600"
                >
                  <Download className="h-4 w-4" />
                  <span>{tr('thankyou.downloadNow')}</span>
                </a>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Digital products pending payment notice */}
      {order.digitalPendingPayment && (
        <div className="rounded-3xl border border-amber-200 bg-amber-50/80 p-6 space-y-3">
          <div className="flex items-center gap-2 text-amber-950 font-extrabold">
            <Clock className="h-5 w-5 text-amber-700" />
            <h2>
              {locale === 'ar'
                ? 'الملفات الرقمية في انتظار تأكيد الدفع'
                : locale === 'fr'
                ? 'Fichiers numériques en attente de paiement'
                : 'Digital files pending payment confirmation'}
            </h2>
          </div>
          <p className="text-sm text-amber-900 leading-relaxed">
            {locale === 'ar'
              ? 'يتضمن طلبك منتجات رقمية. سيتم تفعيل روابط التحميل وإرسالها إليك مباشرة بمجرد تأكيد واستلام الدفع بنجاح.'
              : locale === 'fr'
              ? 'Votre commande inclut des produits numériques. Les liens de téléchargement seront activés dès la confirmation et la réception de votre paiement.'
              : 'Your order includes digital products. Download links will be activated as soon as payment is confirmed and received.'}
          </p>
          <div className="pt-1">
            <button
              type="button"
              onClick={handleMarkPaid}
              disabled={markingPaid}
              className="inline-flex items-center gap-2 rounded-xl bg-emerald-700 px-5 py-2.5 text-xs sm:text-sm font-extrabold text-white shadow-md hover:bg-emerald-600 active:scale-95 transition-all"
            >
              {markingPaid && <Loader2 className="h-4 w-4 animate-spin" />}
              <CheckCircle2 className="h-4 w-4" />
              <span>
                {locale === 'ar'
                  ? 'تم الأداء — تفعيل وتحميل الملفات الرقمية الآن'
                  : locale === 'fr'
                  ? 'Payé — Activer et télécharger les fichiers numériques'
                  : 'Mark as Paid — Unlock & Download Digital Files Now'}
              </span>
            </button>
          </div>
        </div>
      )}

      {rule?.sanitizedCustomHtml && (
        <div
          className="prose prose-stone max-w-none rounded-3xl border border-stone-200 bg-white p-6"
          dangerouslySetInnerHTML={{ __html: rule.sanitizedCustomHtml }}
        />
      )}

      {/* Order Summary */}
      {(rule?.showOrderSummary ?? true) && (
        <div className="rounded-3xl border border-stone-200 bg-white p-6 space-y-4">
          <div className="flex flex-wrap items-center justify-between gap-2 border-b border-stone-100 pb-3">
            <h2 className="text-lg font-extrabold text-stone-900">
              {tr('thankyou.orderNumber')}: <span dir="ltr">{order.orderNumber}</span>
            </h2>
            <div className="flex items-center gap-2 text-xs font-bold">
              <span className="rounded-full bg-emerald-50 px-3 py-1 text-emerald-900">
                {tr(`orderStatus.${order.orderStatus}`)}
              </span>
              <span className="rounded-full bg-stone-100 px-3 py-1 text-stone-700">
                {order.paymentMethod === 'COD'
                  ? locale === 'ar'
                    ? 'الدفع عند الاستلام'
                    : locale === 'fr'
                    ? 'Paiement à la livraison'
                    : 'Cash on Delivery'
                  : order.paymentMethod}{' '}
                •{' '}
                {order.paymentStatus === 'PAID'
                  ? locale === 'ar'
                    ? 'تم الدفع'
                    : locale === 'fr'
                    ? 'Payé'
                    : 'Paid'
                  : order.paymentStatus === 'PENDING'
                  ? locale === 'ar'
                    ? 'في انتظار الدفع'
                    : locale === 'fr'
                    ? 'En attente'
                    : 'Pending Payment'
                  : order.paymentStatus}
              </span>
            </div>
          </div>

          <div className="divide-y divide-stone-100 text-sm">
            {order.items.map((item) => (
              <div key={item.id} className="flex justify-between py-2.5">
                <div>
                  <p className="font-bold text-stone-900">
                    {item.productTitle}{' '}
                    <span className="text-stone-500">× {item.quantity}</span>
                  </p>
                  {item.variantTitle && (
                    <p className="text-xs text-stone-500">{item.variantTitle}</p>
                  )}
                </div>
                <span className="font-bold tabular-nums">{formatPrice(item.lineTotal)}</span>
              </div>
            ))}
          </div>

          <div className="space-y-1.5 border-t border-stone-200 pt-3 text-sm">
            <div className="flex justify-between text-stone-600">
              <span>{tr('checkout.subtotal')}</span>
              <span className="tabular-nums">{formatPrice(order.subtotal)}</span>
            </div>
            {Number(order.discountAmount) > 0 && (
              <div className="flex justify-between text-emerald-700">
                <span>{tr('checkout.discount')}</span>
                <span className="tabular-nums">-{formatPrice(order.discountAmount)}</span>
              </div>
            )}
            <div className="flex justify-between text-stone-600">
              <span>{tr('checkout.shipping')}</span>
              <span className="tabular-nums">
                {Number(order.shippingFee) === 0
                  ? tr('checkout.free')
                  : formatPrice(order.shippingFee)}
              </span>
            </div>
            {Number(order.codFee) > 0 && (
              <div className="flex justify-between text-stone-600">
                <span>{tr('checkout.codFee')}</span>
                <span className="tabular-nums">{formatPrice(order.codFee)}</span>
              </div>
            )}
            <div className="flex justify-between border-t border-stone-100 pt-2 text-base font-extrabold text-stone-900">
              <span>{tr('checkout.total')}</span>
              <span className="text-store-primary tabular-nums">
                {formatPrice(order.totalAmount)}
              </span>
            </div>
          </div>
        </div>
      )}

      {upsells.length > 0 && (
        <section className="space-y-4">
          <h2 className="text-xl font-extrabold text-stone-900">
            {locale === 'ar'
              ? 'عروض خاصة لك'
              : locale === 'fr'
                ? 'Offres recommandées pour vous'
                : 'Recommended For You'}
          </h2>
          <div className="grid grid-cols-2 gap-4 md:grid-cols-4">
            {upsells.map((p) => (
              <ProductCard key={p.id} product={p} />
            ))}
          </div>
        </section>
      )}
    </div>
  );
}

