import type { Metadata } from 'next';
import { IBM_Plex_Sans_Arabic, Plus_Jakarta_Sans } from 'next/font/google';
import './globals.css';
import { loadStorefrontContext } from '@/core/storefront/load-context';
import { StoreContextProvider } from '@/components/providers/StoreContextProvider';
import { PixelManager } from '@/components/tracking/PixelManager';
import { pickI18n } from '@/core/i18n/dictionaries';
import { sanitizeCustomCss } from '@/core/security/sanitize';

const ibmPlexArabic = IBM_Plex_Sans_Arabic({
  subsets: ['arabic'],
  weight: ['400', '500', '600', '700'],
  variable: '--font-arabic',
});

const plusJakarta = Plus_Jakarta_Sans({
  subsets: ['latin'],
  weight: ['400', '500', '600', '700'],
  variable: '--font-latin',
});

export const dynamic = 'force-dynamic';

export async function generateMetadata(): Promise<Metadata> {
  const ctx = await loadStorefrontContext();
  const locale = ctx?.locale || 'ar';
  const seo = (ctx?.settings?.seoDefaults || {}) as {
    metaTitleI18n?: Record<string, string>;
    metaDescriptionI18n?: Record<string, string>;
    ogImageUrl?: string;
  };
  const title =
    pickI18n(seo.metaTitleI18n, locale) ||
    pickI18n(ctx?.settings?.storeNameI18n, locale, 'نبات الأطلس | Nabat Al Atlas');
  const description =
    pickI18n(seo.metaDescriptionI18n, locale) ||
    pickI18n(ctx?.settings?.storeDescriptionI18n, locale);

  return {
    title,
    description,
    openGraph: {
      title,
      description,
      images: seo.ogImageUrl ? [{ url: seo.ogImageUrl }] : undefined,
    },
  };
}

export default async function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const ctx = await loadStorefrontContext();
  const locale = ctx?.locale || 'ar';
  const direction = ctx?.direction || 'rtl';
  const theme = ctx?.theme;

  const radius =
    theme?.buttonStyle === 'pill'
      ? '9999px'
      : theme?.buttonStyle === 'square'
        ? '0.25rem'
        : '0.75rem';

  const cssVars = {
    '--store-primary': theme?.primaryColor || '#14532D',
    '--store-secondary': theme?.secondaryColor || '#D97706',
    '--store-bg': theme?.darkModeEnabled ? '#111827' : theme?.backgroundColor || '#FAF9F6',
    '--store-surface': theme?.darkModeEnabled ? '#1F2937' : theme?.surfaceColor || '#FFFFFF',
    '--store-text': theme?.darkModeEnabled ? '#F9FAFB' : theme?.textColor || '#1C1917',
    '--store-radius': radius,
  } as React.CSSProperties;

  const safeCustomCss = theme?.customCss ? sanitizeCustomCss(theme.customCss) : '';

  return (
    <html
      lang={locale}
      dir={direction}
      className={`${ibmPlexArabic.variable} ${plusJakarta.variable}`}
      suppressHydrationWarning
    >
      <body
        suppressHydrationWarning
        style={{
          ...cssVars,
          fontFamily:
            direction === 'rtl'
              ? 'var(--font-arabic), sans-serif'
              : 'var(--font-latin), var(--font-arabic), sans-serif',
        }}
        className="min-h-screen antialiased selection:bg-emerald-900 selection:text-white"
      >
        {safeCustomCss && (
          <style dangerouslySetInnerHTML={{ __html: safeCustomCss }} />
        )}
        <StoreContextProvider initialContext={ctx}>
          <PixelManager />
          {children}
        </StoreContextProvider>
      </body>
    </html>
  );
}

