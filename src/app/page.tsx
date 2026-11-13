import React from 'react';
import { and, asc, desc, eq, inArray } from 'drizzle-orm';
import {
  categories,
  heroSliders,
  homepageSections,
  productMedia,
  productReviews,
  products,
  productVariants,
} from '@/db/schema/tenant';
import { getRequestTenant, withTenantDb } from '@/core/tenancy/context';
import { StorefrontShell } from '@/components/storefront/StorefrontShell';
import { HomepageSections } from '@/components/storefront/HomepageSections';
import { computeEffectivePrice } from '@/services/catalog/pricing';

export const dynamic = 'force-dynamic';

export default async function HomePage() {
  let sectionsData: Array<typeof homepageSections.$inferSelect> = [];
  let slidersData: Array<typeof heroSliders.$inferSelect> = [];
  let categoriesData: Array<typeof categories.$inferSelect> = [];
  let allProducts: Array<
    typeof products.$inferSelect & {
      media: Array<typeof productMedia.$inferSelect>;
      variants: Array<typeof productVariants.$inferSelect>;
    }
  > = [];
  let reviewsData: Array<{
    id: string;
    customerName: string;
    rating: number;
    title: string | null;
    comment: string | null;
    isVerifiedPurchase: boolean;
    productTitleI18n: Record<string, string>;
    productSlug: string;
  }> = [];

  try {
    const tenant = await getRequestTenant();
    const now = new Date();
    const loaded = await withTenantDb(tenant, async (db) => {
      const secs = await db
        .select()
        .from(homepageSections)
        .where(and(eq(homepageSections.storeId, tenant.id), eq(homepageSections.isEnabled, true)))
        .orderBy(asc(homepageSections.sortOrder));

      const sls = await db
        .select()
        .from(heroSliders)
        .where(and(eq(heroSliders.storeId, tenant.id), eq(heroSliders.isActive, true)))
        .orderBy(asc(heroSliders.sortOrder));

      const cats = await db
        .select()
        .from(categories)
        .where(and(eq(categories.storeId, tenant.id), eq(categories.isActive, true)))
        .orderBy(asc(categories.sortOrder));

      const prods = await db
        .select()
        .from(products)
        .where(and(eq(products.storeId, tenant.id), eq(products.isPublished, true)))
        .orderBy(desc(products.createdAt))
        .limit(40);

      const ids = prods.map((p) => p.id);
      const med =
        ids.length > 0
          ? await db
              .select()
              .from(productMedia)
              .where(and(eq(productMedia.storeId, tenant.id), inArray(productMedia.productId, ids)))
          : [];
      const vars =
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

      const revs = await db
        .select({
          id: productReviews.id,
          customerName: productReviews.customerName,
          rating: productReviews.rating,
          title: productReviews.title,
          comment: productReviews.comment,
          isVerifiedPurchase: productReviews.isVerifiedPurchase,
          productTitleI18n: products.titleI18n,
          productSlug: products.slug,
        })
        .from(productReviews)
        .innerJoin(products, eq(productReviews.productId, products.id))
        .where(
          and(
            eq(productReviews.storeId, tenant.id),
            eq(productReviews.status, 'APPROVED')
          )
        )
        .orderBy(desc(productReviews.createdAt))
        .limit(6);

      return {
        secs: secs.filter(
          (s) => (!s.startsAt || now >= s.startsAt) && (!s.endsAt || now <= s.endsAt)
        ),
        sls: sls.filter(
          (s) => (!s.startsAt || now >= s.startsAt) && (!s.endsAt || now <= s.endsAt)
        ),
        cats: cats.filter((c) => c.isFeatured).length > 0 ? cats.filter((c) => c.isFeatured) : cats,
        prods: prods.map((p) => ({
          ...p,
          media: med.filter((m) => m.productId === p.id).sort((a, b) => a.sortOrder - b.sortOrder),
          variants: vars.filter((v) => v.productId === p.id),
        })),
        revs,
      };
    });

    sectionsData = loaded.secs;
    slidersData = loaded.sls;
    categoriesData = loaded.cats;
    allProducts = loaded.prods;
    reviewsData = loaded.revs;
  } catch {
    // Graceful empty fallback when DB is not yet migrated/seeded
  }

  const featuredProducts = allProducts.filter((p) => p.isFeatured);
  const bestSellers = [...allProducts]
    .filter((p) => p.isBestSeller || p.salesCount > 0)
    .sort((a, b) => b.salesCount - a.salesCount);
  const newArrivals = allProducts.filter((p) => p.isNewArrival);
  const promoProducts = allProducts.filter((p) =>
    computeEffectivePrice({
      regularPrice: p.regularPrice,
      salePrice: p.salePrice,
      discountType: p.discountType,
      discountValue: p.discountValue,
      promoStartsAt: p.promoStartsAt,
      promoEndsAt: p.promoEndsAt,
    }).hasActiveDiscount
  );

  return (
    <StorefrontShell>
      <HomepageSections
        sections={sectionsData}
        slides={slidersData}
        categories={categoriesData}
        featuredProducts={featuredProducts.length > 0 ? featuredProducts : allProducts}
        promoProducts={promoProducts}
        bestSellers={bestSellers.length > 0 ? bestSellers : allProducts}
        newArrivals={newArrivals.length > 0 ? newArrivals : allProducts}
        reviews={reviewsData}
      />
    </StorefrontShell>
  );
}

