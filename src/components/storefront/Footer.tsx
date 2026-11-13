'use client';

import React from 'react';
import Link from 'next/link';
import { Mail, MapPin, MessageCircle, Phone } from 'lucide-react';
import { useStore } from '@/components/providers/StoreContextProvider';

export function Footer() {
  const { ctx, tr, pick, locale } = useStore();
  const settings = ctx?.settings;
  const storeName = pick(settings?.storeNameI18n, 'نبات الأطلس | Nabat Al Atlas');
  const description = pick(settings?.storeDescriptionI18n);
  const address = pick(settings?.addressI18n);
  const social = settings?.socialLinks || {};

  const footerMenu1 = ctx?.menus?.find((m) => m.location === 'FOOTER_COL_1')?.items || [];
  const footerMenu2 = ctx?.menus?.find((m) => m.location === 'FOOTER_COL_2')?.items || [];

  const whatsappRaw = (settings?.whatsappNumber || social.whatsapp || '').replace(/[^\d]/g, '');
  const waHref = whatsappRaw
    ? `https://wa.me/${whatsappRaw}?text=${encodeURIComponent(
        locale === 'ar'
          ? 'السلام عليكم، أحتاج مساعدة بخصوص الطلب من المتجر.'
          : locale === 'fr'
            ? 'Bonjour, j’ai besoin d’aide concernant la boutique.'
            : 'Hello, I need help regarding your store.'
      )}`
    : null;

  return (
    <>
      <footer className="mt-16 border-t border-stone-200 bg-stone-900 text-stone-300 no-print">
        <div className="mx-auto grid max-w-7xl grid-cols-1 gap-10 px-4 py-12 sm:grid-cols-2 lg:grid-cols-4 sm:px-6 lg:px-8">
          <div className="space-y-4">
            <div className="flex items-center gap-2.5">
              {settings?.logoUrl ? (
                <img
                  src={settings.logoUrl}
                  alt={storeName}
                  className="h-9 w-9 rounded-xl object-cover"
                />
              ) : (
                <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-emerald-700 text-sm font-bold text-white">
                  ن
                </span>
              )}
              <span className="text-lg font-bold text-white">{storeName}</span>
            </div>
            {description && (
              <p className="text-sm leading-relaxed text-stone-400">{description}</p>
            )}
            <div className="flex flex-wrap gap-2 pt-1">
              {social.instagram && (
                <a
                  href={social.instagram}
                  target="_blank"
                  rel="noreferrer"
                  className="rounded-lg bg-stone-800 px-3 py-1.5 text-xs font-medium hover:bg-emerald-800 hover:text-white"
                >
                  Instagram
                </a>
              )}
              {social.facebook && (
                <a
                  href={social.facebook}
                  target="_blank"
                  rel="noreferrer"
                  className="rounded-lg bg-stone-800 px-3 py-1.5 text-xs font-medium hover:bg-emerald-800 hover:text-white"
                >
                  Facebook
                </a>
              )}
              {social.tiktok && (
                <a
                  href={social.tiktok}
                  target="_blank"
                  rel="noreferrer"
                  className="rounded-lg bg-stone-800 px-3 py-1.5 text-xs font-medium hover:bg-emerald-800 hover:text-white"
                >
                  TikTok
                </a>
              )}
              {social.youtube && (
                <a
                  href={social.youtube}
                  target="_blank"
                  rel="noreferrer"
                  className="rounded-lg bg-stone-800 px-3 py-1.5 text-xs font-medium hover:bg-emerald-800 hover:text-white"
                >
                  YouTube
                </a>
              )}
            </div>
          </div>

          <div>
            <h3 className="mb-4 text-sm font-bold text-white">{tr('nav.shop')}</h3>
            <ul className="space-y-2.5 text-sm">
              {footerMenu1.length > 0 ? (
                footerMenu1.map((item) => (
                  <li key={item.id}>
                    <Link href={item.url} className="hover:text-amber-400 transition-colors">
                      {pick(item.labelI18n)}
                    </Link>
                  </li>
                ))
              ) : (
                <>
                  <li>
                    <Link href="/shop" className="hover:text-amber-400">
                      {tr('nav.shop')}
                    </Link>
                  </li>
                  <li>
                    <Link href="/track-order" className="hover:text-amber-400">
                      {tr('nav.trackOrder')}
                    </Link>
                  </li>
                  <li>
                    <Link href="/account" className="hover:text-amber-400">
                      {tr('nav.account')}
                    </Link>
                  </li>
                </>
              )}
            </ul>
          </div>

          <div>
            <h3 className="mb-4 text-sm font-bold text-white">
              {locale === 'ar'
                ? 'معلومات وخدمات'
                : locale === 'fr'
                  ? 'Informations'
                  : 'Information'}
            </h3>
            <ul className="space-y-2.5 text-sm">
              {footerMenu2.map((item) => (
                <li key={item.id}>
                  <Link href={item.url} className="hover:text-amber-400 transition-colors">
                    {pick(item.labelI18n)}
                  </Link>
                </li>
              ))}
              <li>
                <Link href="/track-order" className="hover:text-amber-400">
                  {tr('nav.trackOrder')}
                </Link>
              </li>
              <li>
                <Link href="/checkout" className="hover:text-amber-400">
                  {tr('cart.proceedCheckout')}
                </Link>
              </li>
            </ul>
          </div>

          <div className="space-y-3 text-sm">
            <h3 className="mb-4 text-sm font-bold text-white">
              {locale === 'ar'
                ? 'تواصل معنا'
                : locale === 'fr'
                  ? 'Contactez-nous'
                  : 'Contact Us'}
            </h3>
            {settings?.phone && (
              <a
                href={`tel:${settings.phone}`}
                className="flex items-center gap-2 hover:text-amber-400"
              >
                <Phone className="h-4 w-4 text-amber-400" />
                <span dir="ltr">{settings.phone}</span>
              </a>
            )}
            {settings?.email && (
              <a
                href={`mailto:${settings.email}`}
                className="flex items-center gap-2 hover:text-amber-400"
              >
                <Mail className="h-4 w-4 text-amber-400" />
                <span>{settings.email}</span>
              </a>
            )}
            {address && (
              <div className="flex items-start gap-2 text-stone-400">
                <MapPin className="mt-0.5 h-4 w-4 shrink-0 text-amber-400" />
                <span>{address}</span>
              </div>
            )}
          </div>
        </div>

        <div className="border-t border-stone-800 px-4 py-5">
          <div className="mx-auto flex max-w-7xl flex-col items-center justify-between gap-3 text-xs text-stone-400 sm:flex-row sm:px-6 lg:px-8">
            <p>
              © {new Date().getFullYear()} {storeName}
            </p>
            <div className="flex flex-wrap items-center gap-2">
              <span className="rounded-md bg-stone-800 px-2.5 py-1 text-[11px] font-semibold text-stone-200">
                COD
              </span>
              <span className="rounded-md bg-stone-800 px-2.5 py-1 text-[11px] font-semibold text-stone-200">
                CMI Morocco
              </span>
              <span className="rounded-md bg-stone-800 px-2.5 py-1 text-[11px] font-semibold text-stone-200">
                Stripe
              </span>
              <span className="rounded-md bg-stone-800 px-2.5 py-1 text-[11px] font-semibold text-stone-200">
                PayPal
              </span>
            </div>
          </div>
        </div>
      </footer>

      {waHref && (
        <a
          href={waHref}
          target="_blank"
          rel="noreferrer"
          className="fixed bottom-20 end-4 z-30 flex h-13 w-13 items-center justify-center rounded-full bg-emerald-600 text-white shadow-xl transition-transform hover:scale-105 hover:bg-emerald-500 sm:bottom-6 no-print"
          aria-label="WhatsApp Support"
        >
          <MessageCircle className="h-6 w-6" />
        </a>
      )}
    </>
  );
}

