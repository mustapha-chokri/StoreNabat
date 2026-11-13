import { NextRequest, NextResponse } from 'next/server';
import { and, desc, eq, inArray, sql } from 'drizzle-orm';
import {
  categories,
  productMedia,
  products,
  productVariants,
} from '@/db/schema/tenant';
import { withRequestTenantDb } from '@/core/tenancy/context';

export async function GET(req: NextRequest) {
  try {
    const sp = req.nextUrl.searchParams;
    const search = (sp.get('q') || '').trim();
    const categorySlug = sp.get('category') || '';
    const productType = sp.get('type') || '';
    const flag = sp.get('flag') || ''; // featured | bestSeller | newArrival
    const sort = sp.get('sort') || 'newest';
    const page = Math.max(1, Number(sp.get('page') || 1));
    const limit = Math.min(48, Math.max(1, Number(sp.get('limit') || 16)));
    const offset = (page - 1) * limit;

    const result = await withRequestTenantDb(async (db, tenant) => {
      const conditions = [
        eq(products.storeId, tenant.id),
        eq(products.isPublished, true),
      ];

      if (categorySlug) {
        const catRows = await db
          .select({ id: categories.id })
          .from(categories)
          .where(and(eq(categories.storeId, tenant.id), eq(categories.slug, categorySlug)))
          .limit(1);
        if (catRows.length > 0) {
          conditions.push(eq(products.categoryId, catRows[0].id));
        } else {
          return { items: [], total: 0, page, limit };
        }
      }

      if (productType) {
        conditions.push(eq(products.productType, productType as never));
      }

      if (flag === 'featured') conditions.push(eq(products.isFeatured, true));
      if (flag === 'bestSeller') conditions.push(eq(products.isBestSeller, true));
      if (flag === 'newArrival') conditions.push(eq(products.isNewArrival, true));

      if (search) {
        const pattern = `%${search}%`;
        conditions.push(
          sql`(${products.titleI18n}::text ILIKE ${pattern} OR ${products.shortDescriptionI18n}::text ILIKE ${pattern} OR ${products.sku} ILIKE ${pattern})`
        );
      }

      const orderCol =
        sort === 'bestselling'
          ? desc(products.salesCount)
          : sort === 'price_asc'
            ? sql`COALESCE(${products.salePrice}, ${products.regularPrice}) ASC`
            : sort === 'price_desc'
              ? sql`COALESCE(${products.salePrice}, ${products.regularPrice}) DESC`
              : desc(products.createdAt);

      const rows = await db
        .select()
        .from(products)
        .where(and(...conditions))
        .orderBy(orderCol)
        .limit(limit)
        .offset(offset);

      const countRes = await db
        .select({ cnt: sql<number>`count(*)::int` })
        .from(products)
        .where(and(...conditions));

      const ids = rows.map((r) => r.id);
      const mediaRows =
        ids.length > 0
          ? await db
              .select()
              .from(productMedia)
              .where(and(eq(productMedia.storeId, tenant.id), inArray(productMedia.productId, ids)))
          : [];
      const variantRows =
        ids.length > 0
          ? await db
              .select()
              .from(productVariants)
              .where(
                and(
                  eq(productVariants.storeId, tenant.id),
                  inArray(productVariants.productId, ids),
                  eq(productVariants.isActive, true)
                )
              )
          : [];

      const items = rows.map((p) => ({
        ...p,
        media: mediaRows
          .filter((m) => m.productId === p.id)
          .sort((a, b) => a.sortOrder - b.sortOrder),
        variants: variantRows.filter((v) => v.productId === p.id),
      }));

      return {
        items,
        total: countRes[0]?.cnt || 0,
        page,
        limit,
      };
    });

    return NextResponse.json(result);
  } catch {
    return NextResponse.json({ error: 'Failed to load products' }, { status: 500 });
  }
}

