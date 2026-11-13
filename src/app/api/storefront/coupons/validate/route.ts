import { NextRequest, NextResponse } from 'next/server';
import { and, eq } from 'drizzle-orm';
import { z } from 'zod';
import { coupons } from '@/db/schema/tenant';
import { withRequestTenantDb } from '@/core/tenancy/context';
import { errorResponse } from '@/core/http/api';

const ValidateSchema = z.object({
  code: z.string().trim().min(1).max(60),
  subtotal: z.number().min(0),
});

export async function POST(req: NextRequest) {
  try {
    const body = ValidateSchema.parse(await req.json());
    const normalizedCode = body.code.toUpperCase();

    const result = await withRequestTenantDb(async (db, tenant) => {
      const [coupon] = await db
        .select()
        .from(coupons)
        .where(
          and(
            eq(coupons.storeId, tenant.id),
            eq(coupons.code, normalizedCode),
            eq(coupons.isActive, true)
          )
        )
        .limit(1);

      const now = new Date();
      if (!coupon) {
        return { valid: false, reason: 'COUPON_INVALID' };
      }
      if (coupon.startsAt && now < coupon.startsAt) {
        return { valid: false, reason: 'COUPON_NOT_STARTED' };
      }
      if (coupon.endsAt && now > coupon.endsAt) {
        return { valid: false, reason: 'COUPON_EXPIRED' };
      }
      if (coupon.maxUses !== null && coupon.usedCount >= coupon.maxUses) {
        return { valid: false, reason: 'COUPON_MAX_USES' };
      }
      if (coupon.minOrderAmount && body.subtotal < Number(coupon.minOrderAmount)) {
        return {
          valid: false,
          reason: 'COUPON_MIN_AMOUNT',
          minOrderAmount: Number(coupon.minOrderAmount),
        };
      }

      let discountAmount = 0;
      let freeShipping = false;
      if (coupon.discountType === 'PERCENT') {
        discountAmount = Number(((body.subtotal * Number(coupon.discountValue)) / 100).toFixed(2));
      } else if (coupon.discountType === 'FIXED') {
        discountAmount = Math.min(body.subtotal, Number(coupon.discountValue));
      } else if (coupon.discountType === 'FREE_SHIPPING') {
        freeShipping = true;
      }

      return {
        valid: true,
        code: coupon.code,
        discountType: coupon.discountType,
        discountValue: Number(coupon.discountValue),
        discountAmount,
        freeShipping,
      };
    });

    return NextResponse.json(result);
  } catch (err) {
    return errorResponse(err);
  }
}

