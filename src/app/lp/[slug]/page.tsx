import React from 'react';
import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { and, asc, eq, sql } from 'drizzle-orm';
import { landingPages, productMedia, products, productVariants } from '@/db/schema/tenant';
import { getRequestTenant, withTenantDb } from '@/core/tenancy/context';
import { getActiveLocale } from '@/core/i18n/server';
import { pickI18n } from '@/core/i18n/dictionaries';
import { StorefrontShell } from '@/components/storefront/StorefrontShell';
import { PixelManager } from '@/components/tracking/PixelManager';
import { LandingPageRenderer } from '@/components/storefront/LandingPageRenderer';

export const dynamic = 'force-dynamic';

async function loadLandingPage(slug: string, incrementView = false) {
  const tenant = await getRequestTenant();
  return withTenantDb(tenant, async (db) => {
    const rows = await db
      .select()
      .from(landingPages)
      .where(
        and(
          eq(landingPages.storeId, tenant.id),
          eq(landingPages.slug, slug),
          eq(landingPages.isPublished, true)
        )
      )
      .limit(1);

    if (rows.length === 0) return null;
    const lp = rows[0];

    if (incrementView) {
      await db
        .update(landingPages)
        .set({ viewsCount: sql`${landingPages.viewsCount} + 1` })
        .where(and(eq(landingPages.storeId, tenant.id), eq(landingPages.id, lp.id)));
    }

    let product = null;
    let firstImg: string | null = null;
    let variants: Array<typeof productVariants.$inferSelect> = [];

    if (lp.productId) {
      const [p] = await db
        .select()
        .from(products)
        .where(and(eq(products.storeId, tenant.id), eq(products.id, lp.productId)))
        .limit(1);
      if (p) {
        product = p;
        const med = await db
          .select()
          .from(productMedia)
          .where(and(eq(productMedia.storeId, tenant.id), eq(productMedia.productId, p.id)))
          .orderBy(asc(productMedia.sortOrder))
          .limit(1);
        firstImg = med[0]?.url || null;
        variants = await db
          .select()
          .from(productVariants)
          .where(
            and(
              eq(productVariants.storeId, tenant.id),
              eq(productVariants.productId, p.id),
              eq(productVariants.isActive, true)
            )
          );
      }
    }

    return { lp, product, firstImg, variants };
  });
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ slug: string }>;
}): Promise<Metadata> {
  const { slug } = await params;
  const locale = await getActiveLocale();
  try {
    const data = await loadLandingPage(slug, false);
    if (!data) return { title: 'Offer Not Found' };
    const seo = data.lp.seoI18n?.[locale] || data.lp.seoI18n?.ar || {};
    return {
      title: seo.metaTitle || pickI18n(data.lp.titleI18n, locale),
      description: seo.metaDescription,
      openGraph: seo.ogImage ? { images: [{ url: seo.ogImage }] } : undefined,
    };
  } catch {
    return { title: 'Landing Page' };
  }
}

export default async function LandingPageRoute({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const loaded = await loadLandingPage(slug, true).catch(() => null);
  if (!loaded) {
    notFound();
  }

  const { lp, product, firstImg, variants } = loaded;

  return (
    <StorefrontShell showHeader={lp.showHeader} showFooter={lp.showFooter}>
      <PixelManager overridePixels={lp.customPixels} />
      <LandingPageRenderer
        landingPageId={lp.id}
        sections={lp.sections}
        product={
          product
            ? {
                id: product.id,
                productType: product.productType,
                requiresShipping: product.requiresShipping,
                titleI18n: product.titleI18n,
                regularPrice: product.regularPrice,
                salePrice: product.salePrice,
                discountType: product.discountType,
                discountValue: product.discountValue,
                promoStartsAt: product.promoStartsAt ? product.promoStartsAt.toISOString() : null,
                promoEndsAt: product.promoEndsAt ? product.promoEndsAt.toISOString() : null,
                shippingConfig: product.shippingConfig,
                imageUrl: firstImg,
              }
            : null
        }
        variants={variants.map((v) => ({
          id: v.id,
          titleI18n: v.titleI18n,
          regularPrice: v.regularPrice,
          salePrice: v.salePrice,
        }))}
      />
    </StorefrontShell>
  );
}

