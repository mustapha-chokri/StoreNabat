import { NextRequest, NextResponse } from 'next/server';
import { and, desc, eq } from 'drizzle-orm';
import { z } from 'zod';
import { coupons } from '@/db/schema/tenant';
import { getRequestTenant, withTenantDb } from '@/core/tenancy/context';
import { requireAdmin } from '@/core/auth/admin-session';
import { assertSameOrigin, errorResponse } from '@/core/http/api';

const CouponSchema = z.object({
  id: z.string().uuid().optional(),
  code: z.string().trim().min(2).max(50),
  discountType: z.enum(['PERCENT', 'FIXED', 'FREE_SHIPPING']),
  discountValue: z.union([z.number(), z.string()]).default(0),
  minOrderAmount: z.union([z.number(), z.string()]).nullable().optional(),
  maxUses: z.number().int().nullable().optional(),
  startsAt: z.string().nullable().optional(),
  endsAt: z.string().nullable().optional(),
  isActive: z.boolean().default(true),
});

export async function GET() {
  try {
    const tenant = await getRequestTenant();
    await requireAdmin(tenant, 'marketing.write');
    const list = await withTenantDb(tenant, async (db) =>
      db.select().from(coupons).where(eq(coupons.storeId, tenant.id)).orderBy(desc(coupons.createdAt))
    );
    return NextResponse.json({ coupons: list });
  } catch (err) {
    return errorResponse(err);
  }
}

export async function POST(req: NextRequest) {
  const csrfErr = assertSameOrigin(req);
  if (csrfErr) return csrfErr;

  try {
    const tenant = await getRequestTenant();
    await requireAdmin(tenant, 'marketing.write');
    const body = CouponSchema.parse(await req.json());

    const row = await withTenantDb(tenant, async (db) => {
      const values = {
        code: body.code.toUpperCase(),
        discountType: body.discountType,
        discountValue: Number(body.discountValue).toFixed(2),
        minOrderAmount:
          body.minOrderAmount !== null && body.minOrderAmount !== undefined && body.minOrderAmount !== ''
            ? Number(body.minOrderAmount).toFixed(2)
            : null,
        maxUses: body.maxUses ?? null,
        startsAt: body.startsAt ? new Date(body.startsAt) : null,
        endsAt: body.endsAt ? new Date(body.endsAt) : null,
        isActive: body.isActive,
      };
      if (body.id) {
        const [u] = await db
          .update(coupons)
          .set(values)
          .where(and(eq(coupons.storeId, tenant.id), eq(coupons.id, body.id)))
          .returning();
        return u;
      }
      const [c] = await db.insert(coupons).values({ storeId: tenant.id, ...values }).returning();
      return c;
    });

    return NextResponse.json({ coupon: row });
  } catch (err) {
    return errorResponse(err);
  }
}

export async function DELETE(req: NextRequest) {
  const csrfErr = assertSameOrigin(req);
  if (csrfErr) return csrfErr;
  try {
    const tenant = await getRequestTenant();
    await requireAdmin(tenant, 'marketing.write');
    const id = req.nextUrl.searchParams.get('id');
    if (!id) return NextResponse.json({ error: 'id required' }, { status: 400 });
    await withTenantDb(tenant, async (db) => {
      await db.delete(coupons).where(and(eq(coupons.storeId, tenant.id), eq(coupons.id, id)));
    });
    return NextResponse.json({ ok: true });
  } catch (err) {
    return errorResponse(err);
  }
}

