export interface PriceCalculationInput {
  regularPrice: string | number;
  salePrice?: string | number | null;
  discountType?: string | null;
  discountValue?: string | number | null;
  promoStartsAt?: Date | string | null;
  promoEndsAt?: Date | string | null;
}

export interface EffectivePriceResult {
  regularPrice: number;
  effectivePrice: number;
  hasActiveDiscount: boolean;
  discountPercent: number;
  promoEndsAt: Date | null;
}

export function isPromoWindowActive(
  startsAt?: Date | string | null,
  endsAt?: Date | string | null,
  now = new Date()
): boolean {
  if (startsAt) {
    const start = new Date(startsAt);
    if (now < start) return false;
  }
  if (endsAt) {
    const end = new Date(endsAt);
    if (now > end) return false;
  }
  return true;
}

export function computeEffectivePrice(
  input: PriceCalculationInput,
  now = new Date()
): EffectivePriceResult {
  const regular = Number(input.regularPrice || 0);
  const windowActive = isPromoWindowActive(input.promoStartsAt, input.promoEndsAt, now);

  let effective = regular;

  if (windowActive) {
    if (input.salePrice !== null && input.salePrice !== undefined && Number(input.salePrice) > 0) {
      effective = Math.min(regular, Number(input.salePrice));
    } else if (input.discountType && input.discountValue) {
      const val = Number(input.discountValue);
      if (input.discountType === 'PERCENT' && val > 0 && val < 100) {
        effective = Number((regular * (1 - val / 100)).toFixed(2));
      } else if (input.discountType === 'FIXED' && val > 0) {
        effective = Math.max(0, Number((regular - val).toFixed(2)));
      }
    }
  }

  const hasActiveDiscount = effective < regular && regular > 0;
  const discountPercent = hasActiveDiscount
    ? Math.round(((regular - effective) / regular) * 100)
    : 0;

  return {
    regularPrice: Number(regular.toFixed(2)),
    effectivePrice: Number(effective.toFixed(2)),
    hasActiveDiscount,
    discountPercent,
    promoEndsAt:
      windowActive && input.promoEndsAt ? new Date(input.promoEndsAt) : null,
  };
}

