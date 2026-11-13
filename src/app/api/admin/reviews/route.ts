import { NextRequest, NextResponse } from 'next/server';
import { and, desc, eq } from 'drizzle-orm';
import { productReviews, products } from '@/db/schema/tenant';
import { getRequestTenant, withTenantDb } from '@/core/tenancy/context';
import { requireAdmin } from '@/core/auth/admin-session';
import { assertSameOrigin, errorResponse } from '@/core/http/api';

export async function GET() {
  try {
    const tenant = await getRequestTenant();
    await requireAdmin(tenant, 'products.read');

    const rows = await withTenantDb(tenant, async (db) =>
      db
        .select({
          review: productReviews,
          productTitleI18n: products.titleI18n,
          productSlug: products.slug,
        })
        .from(productReviews)
        .innerJoin(products, eq(productReviews.productId, products.id))
        .where(eq(productReviews.storeId, tenant.id))
        .orderBy(desc(productReviews.createdAt))
        .limit(100)
    );

    return NextResponse.json({ reviews: rows });
  } catch (err) {
    return errorResponse(err);
  }
}

export async function PATCH(req: NextRequest) {
  const csrfErr = assertSameOrigin(req);
  if (csrfErr) return csrfErr;

  try {
    const tenant = await getRequestTenant();
    await requireAdmin(tenant, 'products.write');
    const { id, status } = (await req.json()) as {
      id: string;
      status: 'APPROVED' | 'REJECTED' | 'PENDING';
    };

    await withTenantDb(tenant, async (db) => {
      const [rev] = await db
        .update(productReviews)
        .set({ status })
        .where(and(eq(productReviews.storeId, tenant.id), eq(productReviews.id, id)))
        .returning();

      if (rev) {
        const approved = await db
          .select({ rating: productReviews.rating })
          .from(productReviews)
          .where(
            and(
              eq(productReviews.storeId, tenant.id),
              eq(productReviews.productId, rev.productId),
              eq(productReviews.status, 'APPROVED')
            )
          );
        const avg =
          approved.length > 0
            ? approved.reduce((s, r) => s + r.rating, 0) / approved.length
            : 0;
        await db
          .update(products)
          .set({
            averageRating: avg.toFixed(2),
            reviewsCount: approved.length,
          })
          .where(and(eq(products.storeId, tenant.id), eq(products.id, rev.productId)));
      }
    });

    return NextResponse.json({ ok: true });
  } catch (err) {
    return errorResponse(err);
  }
}

export async function DELETE(req: NextRequest) {
  const csrfErr = assertSameOrigin(req);
  if (csrfErr) return csrfErr;

  try {
    const tenant = await getRequestTenant();
    await requireAdmin(tenant, 'products.write');
    const id = req.nextUrl.searchParams.get('id');
    if (!id) return NextResponse.json({ error: 'id required' }, { status: 400 });

    await withTenantDb(tenant, async (db) => {
      await db
        .delete(productReviews)
        .where(and(eq(productReviews.storeId, tenant.id), eq(productReviews.id, id)));
    });
    return NextResponse.json({ ok: true });
  } catch (err) {
    return errorResponse(err);
  }
}

