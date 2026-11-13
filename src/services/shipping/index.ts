import { and, eq } from 'drizzle-orm';
import { shippingCities, shippingZones } from '@/db/schema/tenant';
import type { TenantDb } from '@/db/pools';
import type { I18nMap } from '@/db/schema/types';

export interface ShippingQuote {
  cityId: string | null;
  cityName: string;
  regionName: string;
  deliveryFee: number;
  codFee: number;
  codAllowed: boolean;
  freeShippingApplied: boolean;
  estimatedDaysI18n: I18nMap;
}

/**
 * Abstract adapter interface allowing future integration with Moroccan couriers
 * (Amana, Ameex, Ozone, Cathedis, Sendit, Digylog) without changing checkout or order logic.
 */
export interface ShippingProviderAdapter {
  readonly code: string;
  createParcel(input: {
    orderNumber: string;
    customerName: string;
    phone: string;
    city: string;
    address: string;
    codAmount: number;
  }): Promise<{ trackingNumber: string; labelUrl?: string }>;
  getTrackingStatus(trackingNumber: string): Promise<{ status: string; updatedAt: string }>;
}

export class ManualShippingAdapter implements ShippingProviderAdapter {
  readonly code = 'MANUAL';

  async createParcel(input: { orderNumber: string }): Promise<{ trackingNumber: string }> {
    return { trackingNumber: `MAN-${input.orderNumber}` };
  }

  async getTrackingStatus(): Promise<{ status: string; updatedAt: string }> {
    return { status: 'MANUAL_TRACKING', updatedAt: new Date().toISOString() };
  }
}

export async function calculateShippingQuote(
  db: TenantDb,
  params: {
    storeId: string;
    cityId?: string | null;
    cityName?: string;
    subtotalAfterDiscount: number;
    requiresShipping: boolean;
    locale: string;
    forceFreeShippingCoupon?: boolean;
    extraProductShippingFee?: number;
    productAllowsFreeShipping?: boolean;
  }
): Promise<ShippingQuote> {
  if (!params.requiresShipping) {
    return {
      cityId: params.cityId || null,
      cityName: params.cityName || 'Digital / Online',
      regionName: 'Digital',
      deliveryFee: 0,
      codFee: 0,
      codAllowed: false,
      freeShippingApplied: true,
      estimatedDaysI18n: { ar: 'فوري', fr: 'Immédiat', en: 'Instant' },
    };
  }

  let cityRow: typeof shippingCities.$inferSelect | undefined;
  if (params.cityId) {
    const rows = await db
      .select()
      .from(shippingCities)
      .where(
        and(
          eq(shippingCities.storeId, params.storeId),
          eq(shippingCities.id, params.cityId),
          eq(shippingCities.isActive, true)
        )
      )
      .limit(1);
    cityRow = rows[0];
  }

  let zoneRow: typeof shippingZones.$inferSelect | undefined;
  if (cityRow?.zoneId) {
    const zRows = await db
      .select()
      .from(shippingZones)
      .where(and(eq(shippingZones.storeId, params.storeId), eq(shippingZones.id, cityRow.zoneId)))
      .limit(1);
    zoneRow = zRows[0];
  } else {
    const defaultZones = await db
      .select()
      .from(shippingZones)
      .where(and(eq(shippingZones.storeId, params.storeId), eq(shippingZones.isActive, true)))
      .limit(1);
    zoneRow = defaultZones[0];
  }

  const baseFee = cityRow
    ? Number(cityRow.deliveryFee)
    : zoneRow
      ? Number(zoneRow.defaultFee)
      : 35;

  const codFee = cityRow
    ? Number(cityRow.codFee)
    : zoneRow
      ? Number(zoneRow.codFee)
      : 0;

  const codAllowed = cityRow ? cityRow.codEnabled : zoneRow ? zoneRow.codEnabled : true;
  const freeThresholdRaw = cityRow?.freeShippingMinOrder ?? zoneRow?.freeShippingThreshold;
  const freeThreshold = freeThresholdRaw !== null && freeThresholdRaw !== undefined
    ? Number(freeThresholdRaw)
    : null;

  const freeByThreshold =
    freeThreshold !== null && params.subtotalAfterDiscount >= freeThreshold;
  const freeShippingApplied = Boolean(
    params.forceFreeShippingCoupon || params.productAllowsFreeShipping || freeByThreshold
  );

  const deliveryFee = freeShippingApplied
    ? 0
    : Number((baseFee + (params.extraProductShippingFee || 0)).toFixed(2));

  const cityName = cityRow
    ? cityRow.cityNameI18n[params.locale] ||
      cityRow.cityNameI18n.ar ||
      cityRow.cityNameI18n.fr ||
      params.cityName ||
      ''
    : params.cityName || '';

  const regionName = cityRow
    ? cityRow.regionNameI18n[params.locale] ||
      cityRow.regionNameI18n.ar ||
      cityRow.regionNameI18n.fr ||
      ''
    : '';

  return {
    cityId: cityRow?.id || null,
    cityName,
    regionName,
    deliveryFee,
    codFee,
    codAllowed,
    freeShippingApplied,
    estimatedDaysI18n:
      cityRow?.estimatedDaysI18n ||
      zoneRow?.estimatedDaysI18n || {
        ar: '24 - 48 ساعة',
        fr: '24 - 48h',
        en: '24 - 48h',
      },
  };
}

