import { NextResponse } from 'next/server';
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
import { withRequestTenantDb } from '@/core/tenancy/context';

export async function GET() {
  try {
    const data = await withRequestTenantDb(async (db, tenant) => {
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
        tenant: { id: tenant.id, slug: tenant.slug, name: tenant.name },
        settings: settings
          ? { ...settings, encryptedSmtpConfig: undefined }
          : null,
        theme,
        languages: languages.filter((l) => l.isActive),
        menus,
        cities: cities.filter((c) => c.isActive),
        paymentGateways: gateways.filter((g) => g.isEnabled),
        tracking: tracking || null,
      };
    });

    return NextResponse.json(data);
  } catch {
    return NextResponse.json({ error: 'Unable to load storefront context' }, { status: 500 });
  }
}

