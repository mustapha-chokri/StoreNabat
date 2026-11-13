import { NextRequest, NextResponse } from 'next/server';
import { and, eq, inArray } from 'drizzle-orm';
import { z } from 'zod';
import {
  cartItems,
  carts,
  coupons,
  productMedia,
  products,
  productVariants,
} from '@/db/schema/tenant';
import { withRequestTenantDb } from '@/core/tenancy/context';
import { getOrCreateCartToken } from '@/core/auth/customer-session';
import { assertSameOrigin, errorResponse } from '@/core/http/api';
import { computeEffectivePrice } from '@/services/catalog/pricing';

const CartMutateSchema = z.object({
  action: z.enum(['ADD', 'UPDATE', 'REMOVE', 'APPLY_COUPON', 'CLEAR']),
  productId: z.string().uuid().optional(),
  variantId: z.string().uuid().nullable().optional(),
  itemId: z.string().uuid().optional(),
  quantity: z.number().int().min(1).max(200).optional(),
  couponCode: z.string().trim().max(60).nullable().optional(),
});

async function buildCartResponse(
  db: Parameters<Parameters<typeof withRequestTenantDb>[0]>[0],
  storeId: string,
  cartToken: string
) {
  let [cart] = await db
    .select()
    .from(carts)
    .where(and(eq(carts.storeId, storeId), eq(carts.cartToken, cartToken)))
    .limit(1);

  if (!cart) {
    [cart] = await db
      .insert(carts)
      .values({ storeId, cartToken })
      .returning();
  }

  const lines = await db
    .select()
    .from(cartItems)
    .where(and(eq(cartItems.storeId, storeId), eq(cartItems.cartId, cart.id)));

  if (lines.length === 0) {
    return {
      cartId: cart.id,
      couponCode: cart.couponCode,
      items: [],
      subtotal: 0,
      discountAmount: 0,
      freeShippingFromCoupon: false,
      totalItems: 0,
    };
  }

  const pIds = Array.from(new Set(lines.map((l) => l.productId)));
  const vIds = lines.map((l) => l.variantId).filter((id): id is string => Boolean(id));

  const prods = await db
    .select()
    .from(products)
    .where(and(eq(products.storeId, storeId), inArray(products.id, pIds)));
  const pMap = new Map(prods.map((p) => [p.id, p]));

  const vars =
    vIds.length > 0
      ? await db
          .select()
          .from(productVariants)
          .where(and(eq(productVariants.storeId, storeId), inArray(productVariants.id, vIds)))
      : [];
  const vMap = new Map(vars.map((v) => [v.id, v]));

  const media = await db
    .select()
    .from(productMedia)
    .where(and(eq(productMedia.storeId, storeId), inArray(productMedia.productId, pIds)));

  let subtotal = 0;
  let totalItems = 0;

  const enriched = lines
    .map((line) => {
      const p = pMap.get(line.productId);
      if (!p || !p.isPublished) return null;
      const v = line.variantId ? vMap.get(line.variantId) : undefined;
      const price = v
        ? computeEffectivePrice({
            regularPrice: v.regularPrice,
            salePrice: v.salePrice,
            promoStartsAt: p.promoStartsAt,
            promoEndsAt: p.promoEndsAt,
          })
        : computeEffectivePrice({
            regularPrice: p.regularPrice,
            salePrice: p.salePrice,
            discountType: p.discountType,
            discountValue: p.discountValue,
            promoStartsAt: p.promoStartsAt,
            promoEndsAt: p.promoEndsAt,
          });

      const lineTotal = Number((price.effectivePrice * line.quantity).toFixed(2));
      subtotal += lineTotal;
      totalItems += line.quantity;

      const thumb =
        v?.imageUrl ||
        media.find((m) => m.productId === p.id && m.mediaType === 'IMAGE')?.url ||
        null;

      return {
        id: line.id,
        productId: p.id,
        slug: p.slug,
        productType: p.productType,
        requiresShipping: p.requiresShipping,
        titleI18n: p.titleI18n,
        variantId: v?.id || null,
        variantTitleI18n: v?.titleI18n || null,
        unitPrice: price.effectivePrice,
        regularPrice: price.regularPrice,
        quantity: line.quantity,
        lineTotal,
        imageUrl: thumb,
      };
    })
    .filter((item): item is NonNullable<typeof item> => item !== null);

  subtotal = Number(subtotal.toFixed(2));
  let discountAmount = 0;
  let freeShippingFromCoupon = false;

  if (cart.couponCode) {
    const [coupon] = await db
      .select()
      .from(coupons)
      .where(
        and(
          eq(coupons.storeId, storeId),
          eq(coupons.code, cart.couponCode),
          eq(coupons.isActive, true)
        )
      )
      .limit(1);

    const now = new Date();
    if (
      coupon &&
      (!coupon.startsAt || now >= coupon.startsAt) &&
      (!coupon.endsAt || now <= coupon.endsAt) &&
      (coupon.maxUses === null || coupon.usedCount < coupon.maxUses) &&
      (!coupon.minOrderAmount || subtotal >= Number(coupon.minOrderAmount))
    ) {
      if (coupon.discountType === 'PERCENT') {
        discountAmount = Number(((subtotal * Number(coupon.discountValue)) / 100).toFixed(2));
      } else if (coupon.discountType === 'FIXED') {
        discountAmount = Math.min(subtotal, Number(coupon.discountValue));
      } else if (coupon.discountType === 'FREE_SHIPPING') {
        freeShippingFromCoupon = true;
      }
    }
  }

  return {
    cartId: cart.id,
    couponCode: cart.couponCode,
    items: enriched,
    subtotal,
    discountAmount,
    freeShippingFromCoupon,
    totalItems,
  };
}

export async function GET() {
  try {
    const cartToken = await getOrCreateCartToken();
    const data = await withRequestTenantDb(async (db, tenant) =>
      buildCartResponse(db, tenant.id, cartToken)
    );
    return NextResponse.json(data);
  } catch (err) {
    return errorResponse(err);
  }
}

export async function POST(req: NextRequest) {
  const csrfErr = assertSameOrigin(req);
  if (csrfErr) return csrfErr;

  try {
    const body = CartMutateSchema.parse(await req.json());
    const cartToken = await getOrCreateCartToken();

    const data = await withRequestTenantDb(async (db, tenant) => {
      let [cart] = await db
        .select()
        .from(carts)
        .where(and(eq(carts.storeId, tenant.id), eq(carts.cartToken, cartToken)))
        .limit(1);

      if (!cart) {
        [cart] = await db
          .insert(carts)
          .values({ storeId: tenant.id, cartToken })
          .returning();
      }

      if (body.action === 'ADD' && body.productId) {
        const qty = body.quantity || 1;
        const existing = await db
          .select()
          .from(cartItems)
          .where(
            and(
              eq(cartItems.storeId, tenant.id),
              eq(cartItems.cartId, cart.id),
              eq(cartItems.productId, body.productId)
            )
          );
        const match = existing.find((e) => (e.variantId || null) === (body.variantId || null));
        if (match) {
          await db
            .update(cartItems)
            .set({ quantity: match.quantity + qty })
            .where(and(eq(cartItems.storeId, tenant.id), eq(cartItems.id, match.id)));
        } else {
          await db.insert(cartItems).values({
            storeId: tenant.id,
            cartId: cart.id,
            productId: body.productId,
            variantId: body.variantId || null,
            quantity: qty,
          });
        }
      } else if (body.action === 'UPDATE' && body.itemId && body.quantity) {
        await db
          .update(cartItems)
          .set({ quantity: body.quantity })
          .where(
            and(
              eq(cartItems.storeId, tenant.id),
              eq(cartItems.cartId, cart.id),
              eq(cartItems.id, body.itemId)
            )
          );
      } else if (body.action === 'REMOVE' && body.itemId) {
        await db
          .delete(cartItems)
          .where(
            and(
              eq(cartItems.storeId, tenant.id),
              eq(cartItems.cartId, cart.id),
              eq(cartItems.id, body.itemId)
            )
          );
      } else if (body.action === 'CLEAR') {
        await db
          .delete(cartItems)
          .where(and(eq(cartItems.storeId, tenant.id), eq(cartItems.cartId, cart.id)));
        await db
          .update(carts)
          .set({ couponCode: null, updatedAt: new Date() })
          .where(and(eq(carts.storeId, tenant.id), eq(carts.id, cart.id)));
      } else if (body.action === 'APPLY_COUPON') {
        const clean = body.couponCode ? body.couponCode.trim().toUpperCase() : null;
        if (clean) {
          const [coupon] = await db
            .select()
            .from(coupons)
            .where(
              and(
                eq(coupons.storeId, tenant.id),
                eq(coupons.code, clean),
                eq(coupons.isActive, true)
              )
            )
            .limit(1);
          if (!coupon) throw new Error('INVALID_COUPON');
        }
        await db
          .update(carts)
          .set({ couponCode: clean, updatedAt: new Date() })
          .where(and(eq(carts.storeId, tenant.id), eq(carts.id, cart.id)));
      }

      return buildCartResponse(db, tenant.id, cartToken);
    });

    return NextResponse.json(data);
  } catch (err) {
    return errorResponse(err);
  }
}

