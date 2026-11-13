import { asc, eq } from 'drizzle-orm';
import {
  paymentGatewayConfigs,
  shippingCities,
  storeMenus,
  storeSettings,
  storeThemes,
  storeTranslations,
  trackingConfigs,
} from '@/db/schema/tenant';
import { getRequestTenant, withTenantDb } from '@/core/tenancy/context';
import { getActiveLocale, getLocaleDirection } from '@/core/i18n/server';

export interface StorefrontContextData {
  tenant: { id: string; slug: string; name: string };
  locale: string;
  direction: 'rtl' | 'ltr';
  settings: Omit<typeof storeSettings.$inferSelect, 'encryptedSmtpConfig'> | null;
  theme: typeof storeThemes.$inferSelect | null;
  languages: Array<typeof storeTranslations.$inferSelect>;
  menus: Array<typeof storeMenus.$inferSelect>;
  cities: Array<typeof shippingCities.$inferSelect>;
  paymentGateways: Array<{
    gatewayCode: string;
    isEnabled: boolean;
    mode: string;
    displayNameI18n: Record<string, string>;
    instructionsI18n: Record<string, string>;
    publicConfig: Record<string, unknown>;
  }>;
  tracking: {
    metaPixelId: string | null;
    tiktokPixelId: string | null;
    ga4MeasurementId: string | null;
    gtmContainerId: string | null;
    googleAdsId: string | null;
    googleAdsConversionLabel: string | null;
    requireConsent: boolean;
  } | null;
}

export async function loadStorefrontContext(): Promise<StorefrontContextData | null> {
  try {
    const tenant = await getRequestTenant();
    const data = await withTenantDb(tenant, async (db) => {
      const [settings] = await db
        .select()
        .from(storeSettings)
        .where(eq(storeSettings.storeId, tenant.id))
        .limit(1);

      const [theme] = await db
        .select()
        .from(storeThemes)
        .where(eq(storeThemes.storeId, tenant.id))
        .limit(1);

      const languages = await db
        .select()
        .from(storeTranslations)
        .where(eq(storeTranslations.storeId, tenant.id));

      const menus = await db
        .select()
        .from(storeMenus)
        .where(eq(storeMenus.storeId, tenant.id));

      const cities = await db
        .select()
        .from(shippingCities)
        .where(eq(shippingCities.storeId, tenant.id))
        .orderBy(asc(shippingCities.sortOrder));

      const gateways = await db
        .select({
          gatewayCode: paymentGatewayConfigs.gatewayCode,
          isEnabled: paymentGatewayConfigs.isEnabled,
          mode: paymentGatewayConfigs.mode,
          displayNameI18n: paymentGatewayConfigs.displayNameI18n,
          instructionsI18n: paymentGatewayConfigs.instructionsI18n,
          publicConfig: paymentGatewayConfigs.publicConfig,
        })
        .from(paymentGatewayConfigs)
        .where(eq(paymentGatewayConfigs.storeId, tenant.id));

      const [tracking] = await db
        .select({
          metaPixelId: trackingConfigs.metaPixelId,
          tiktokPixelId: trackingConfigs.tiktokPixelId,
          ga4MeasurementId: trackingConfigs.ga4MeasurementId,
          gtmContainerId: trackingConfigs.gtmContainerId,
          googleAdsId: trackingConfigs.googleAdsId,
          googleAdsConversionLabel: trackingConfigs.googleAdsConversionLabel,
          requireConsent: trackingConfigs.requireConsent,
        })
        .from(trackingConfigs)
        .where(eq(trackingConfigs.storeId, tenant.id))
        .limit(1);

      return {
        settings: settings
          ? { ...settings, encryptedSmtpConfig: undefined } as Omit<
              typeof storeSettings.$inferSelect,
              'encryptedSmtpConfig'
            >
          : null,
        theme: theme || null,
        languages: languages.filter((l) => l.isActive),
        menus,
        cities: cities.filter((c) => c.isActive),
        paymentGateways: gateways.filter((g) => g.isEnabled),
        tracking: tracking || null,
      };
    });

    const defaultLang = data.settings?.defaultLanguage || 'ar';
    const locale = await getActiveLocale(defaultLang);
    const direction = getLocaleDirection(locale, data.languages);

    return {
      tenant: { id: tenant.id, slug: tenant.slug, name: tenant.name },
      locale,
      direction,
      ...data,
    };
  } catch {
    return null;
  }
}

