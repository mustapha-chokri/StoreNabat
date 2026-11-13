import { NextRequest, NextResponse } from 'next/server';
import { and, asc, desc, eq, inArray } from 'drizzle-orm';
import {
  categories,
  productBundleItems,
  productMedia,
  productReviews,
  products,
  productVariants,
} from '@/db/schema/tenant';
import { withRequestTenantDb } from '@/core/tenancy/context';

export async function GET(
  _req: NextRequest,
  context: { params: Promise<{ slug: string }> }
) {
  try {
    const { slug } = await context.params;
    const result = await withRequestTenantDb(async (db, tenant) => {
      const rows = await db
        .select()
        .from(products)
        .where(
          and(
            eq(products.storeId, tenant.id),
            eq(products.slug, slug),
            eq(products.isPublished, true)
          )
        )
        .limit(1);

      if (rows.length === 0) return null;
      const product = rows[0];

      const [category] = product.categoryId
        ? await db
            .select()
            .from(categories)
            .where(and(eq(categories.storeId, tenant.id), eq(categories.id, product.categoryId)))
            .limit(1)
        : [null];

      const media = await db
        .select()
        .from(productMedia)
        .where(and(eq(productMedia.storeId, tenant.id), eq(productMedia.productId, product.id)))
        .orderBy(asc(productMedia.sortOrder));

      const variants = await db
        .select()
        .from(productVariants)
        .where(
          and(
            eq(productVariants.storeId, tenant.id),
            eq(productVariants.productId, product.id),
            eq(productVariants.isActive, true)
          )
        );

      const reviews = await db
        .select()
        .from(productReviews)
        .where(
          and(
            eq(productReviews.storeId, tenant.id),
            eq(productReviews.productId, product.id),
            eq(productReviews.status, 'APPROVED')
          )
        )
        .orderBy(desc(productReviews.createdAt))
        .limit(30);

      const bundleRows =
        product.productType === 'BUNDLE'
          ? await db
              .select({
                quantity: productBundleItems.quantity,
                itemProduct: products,
              })
              .from(productBundleItems)
              .innerJoin(products, eq(productBundleItems.itemProductId, products.id))
              .where(
                and(
                  eq(productBundleItems.storeId, tenant.id),
                  eq(productBundleItems.bundleProductId, product.id)
                )
              )
          : [];

      const extraIds = Array.from(
        new Set([
          ...(product.relatedProductIds || []),
          ...(product.frequentlyBoughtTogetherIds || []),
        ])
      );
      const linkedProducts =
        extraIds.length > 0
          ? await db
              .select()
              .from(products)
              .where(
                and(
                  eq(products.storeId, tenant.id),
                  inArray(products.id, extraIds),
                  eq(products.isPublished, true)
                )
              )
          : [];

      const linkedMedia =
        extraIds.length > 0
          ? await db
              .select()
              .from(productMedia)
              .where(
                and(
                  eq(productMedia.storeId, tenant.id),
                  inArray(productMedia.productId, extraIds)
                )
              )
          : [];

      const attachMedia = (list: Array<typeof products.$inferSelect>) =>
        list.map((p) => ({
          ...p,
          media: linkedMedia
            .filter((m) => m.productId === p.id)
            .sort((a, b) => a.sortOrder - b.sortOrder),
        }));

      return {
        product,
        category,
        media,
        variants,
        reviews,
        bundleItems: bundleRows,
        relatedProducts: attachMedia(
          linkedProducts.filter((p) => (product.relatedProductIds || []).includes(p.id))
        ),
        frequentlyBoughtTogether: attachMedia(
          linkedProducts.filter((p) =>
            (product.frequentlyBoughtTogetherIds || []).includes(p.id)
          )
        ),
      };
    });

    if (!result) {
      return NextResponse.json({ error: 'Product not found' }, { status: 404 });
    }
    return NextResponse.json(result);
  } catch {
    return NextResponse.json({ error: 'Failed to load product' }, { status: 500 });
  }
}

