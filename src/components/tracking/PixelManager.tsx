'use client';

import React, { useEffect, useState } from 'react';
import Script from 'next/script';
import { usePathname } from 'next/navigation';
import { useStore } from '@/components/providers/StoreContextProvider';

export function PixelManager({
  overridePixels,
}: {
  overridePixels?: {
    metaPixelId?: string;
    tiktokPixelId?: string;
    ga4MeasurementId?: string;
    gtmContainerId?: string;
  } | null;
}) {
  const pathname = usePathname();
  const { ctx, locale } = useStore();
  const [consentGiven, setConsentGiven] = useState(true);
  const [showBanner, setShowBanner] = useState(false);

  const tracking = ctx?.tracking;
  const metaPixelId = overridePixels?.metaPixelId || tracking?.metaPixelId;
  const tiktokPixelId = overridePixels?.tiktokPixelId || tracking?.tiktokPixelId;
  const ga4Id = overridePixels?.ga4MeasurementId || tracking?.ga4MeasurementId;
  const gtmId = overridePixels?.gtmContainerId || tracking?.gtmContainerId;

  useEffect(() => {
    if (tracking?.requireConsent) {
      const saved = localStorage.getItem('nabat_tracking_consent');
      if (saved === 'granted') {
        setConsentGiven(true);
        setShowBanner(false);
      } else if (saved === 'denied') {
        setConsentGiven(false);
        setShowBanner(false);
      } else {
        setConsentGiven(false);
        setShowBanner(true);
      }
    }
  }, [tracking?.requireConsent]);

  useEffect(() => {
    if (!consentGiven || pathname?.startsWith('/admin')) return;
    const w = window as unknown as { fbq?: (...args: unknown[]) => void; ttq?: { page: () => void } };
    if (w.fbq) w.fbq('track', 'PageView');
    if (w.ttq) w.ttq.page();
  }, [pathname, consentGiven]);

  if (pathname?.startsWith('/admin')) return null;

  return (
    <>
      {consentGiven && metaPixelId && (
        <Script id={`meta-pixel-${metaPixelId}`} strategy="afterInteractive">
          {`
            !function(f,b,e,v,n,t,s){if(f.fbq)return;n=f.fbq=function(){n.callMethod?
            n.callMethod.apply(n,arguments):n.queue.push(arguments)};if(!f._fbq)f._fbq=n;
            n.push=n;n.loaded=!0;n.version='2.0';n.queue=[];t=b.createElement(e);t.async=!0;
            t.src=v;s=b.getElementsByTagName(e)[0];s.parentNode.insertBefore(t,s)}(window,
            document,'script','https://connect.facebook.net/en_US/fbevents.js');
            fbq('init', '${metaPixelId.replace(/[^a-zA-Z0-9_-]/g, '')}');
            fbq('track', 'PageView');
          `}
        </Script>
      )}

      {consentGiven && tiktokPixelId && (
        <Script id={`tiktok-pixel-${tiktokPixelId}`} strategy="afterInteractive">
          {`
            !function (w, d, t) {
              w.TiktokAnalyticsObject=t;var ttq=w[t]=w[t]||[];
              ttq.methods=["page","track","identify","instances","debug","on","off","once","ready","alias","group","enableCookie","disableCookie"];
              ttq.setAndDefer=function(t,e){t[e]=function(){t.push([e].concat(Array.prototype.slice.call(arguments,0)))}};
              for(var i=0;i<ttq.methods.length;i++)ttq.setAndDefer(ttq,ttq.methods[i]);
              ttq.load=function(e,n){var i="https://analytics.tiktok.com/i18n/pixel/events.js";
              ttq._i=ttq._i||{};ttq._i[e]=[];ttq._i[e]._u=i;ttq._t=ttq._t||{};ttq._t[e]=+new Date;
              var o=d.createElement("script");o.type="text/javascript";o.async=!0;o.src=i+"?sdkid="+e+"&lib="+t;
              var a=d.getElementsByTagName("script")[0];a.parentNode.insertBefore(o,a)};
              ttq.load('${tiktokPixelId.replace(/[^a-zA-Z0-9_-]/g, '')}');
              ttq.page();
            }(window, document, 'ttq');
          `}
        </Script>
      )}

      {consentGiven && ga4Id && (
        <>
          <Script
            src={`https://www.googletagmanager.com/gtag/js?id=${encodeURIComponent(ga4Id)}`}
            strategy="afterInteractive"
          />
          <Script id={`ga4-${ga4Id}`} strategy="afterInteractive">
            {`
              window.dataLayer = window.dataLayer || [];
              function gtag(){dataLayer.push(arguments);}
              gtag('js', new Date());
              gtag('config', '${ga4Id.replace(/[^a-zA-Z0-9_-]/g, '')}');
            `}
          </Script>
        </>
      )}

      {consentGiven && gtmId && (
        <Script id={`gtm-${gtmId}`} strategy="afterInteractive">
          {`
            (function(w,d,s,l,i){w[l]=w[l]||[];w[l].push({'gtm.start':
            new Date().getTime(),event:'gtm.js'});var f=d.getElementsByTagName(s)[0],
            j=d.createElement(s),dl=l!='dataLayer'?'&l='+l:'';j.async=true;j.src=
            'https://www.googletagmanager.com/gtm.js?id='+i+dl;f.parentNode.insertBefore(j,f);
            })(window,document,'script','dataLayer','${gtmId.replace(/[^a-zA-Z0-9_-]/g, '')}');
          `}
        </Script>
      )}

      {showBanner && (
        <div className="fixed bottom-4 inset-x-4 md:inset-x-auto md:end-6 md:max-w-md z-50 rounded-2xl border border-stone-200 bg-white p-4 shadow-xl">
          <p className="text-sm text-stone-700 mb-3">
            {locale === 'ar'
              ? 'نستخدم ملفات تعريف الارتباط لتحسين تجربة التسوق وقياس أداء العروض.'
              : locale === 'fr'
                ? 'Nous utilisons des cookies pour améliorer votre expérience et mesurer nos offres.'
                : 'We use cookies to improve your shopping experience and measure campaign performance.'}
          </p>
          <div className="flex gap-2 justify-end">
            <button
              type="button"
              onClick={() => {
                localStorage.setItem('nabat_tracking_consent', 'denied');
                setConsentGiven(false);
                setShowBanner(false);
              }}
              className="px-3 py-1.5 text-xs rounded-lg border border-stone-300 text-stone-600"
            >
              {locale === 'ar' ? 'رفض' : locale === 'fr' ? 'Refuser' : 'Decline'}
            </button>
            <button
              type="button"
              onClick={() => {
                localStorage.setItem('nabat_tracking_consent', 'granted');
                setConsentGiven(true);
                setShowBanner(false);
              }}
              className="px-4 py-1.5 text-xs font-semibold rounded-lg btn-store-primary"
            >
              {locale === 'ar' ? 'موافق' : locale === 'fr' ? 'Accepter' : 'Accept'}
            </button>
          </div>
        </div>
      )}
    </>
  );
}

