import React from 'react';
import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { and, asc, desc, eq, inArray } from 'drizzle-orm';
import {
  categories,
  productBundleItems,
  productMedia,
  productReviews,
  products,
  productVariants,
} from '@/db/schema/tenant';
import { getRequestTenant, withTenantDb } from '@/core/tenancy/context';
import { getActiveLocale } from '@/core/i18n/server';
import { pickI18n } from '@/core/i18n/dictionaries';
import { sanitizeRichHtml } from '@/core/security/sanitize';
import { computeEffectivePrice } from '@/services/catalog/pricing';
import { StorefrontShell } from '@/components/storefront/StorefrontShell';
import {
  ProductDetailClient,
  type ProductDetailData,
} from '@/components/storefront/ProductDetailClient';
import type { I18nMap } from '@/db/schema/types';

export const dynamic = 'force-dynamic';

async function loadProductBySlug(slug: string) {
  const tenant = await getRequestTenant();
  return withTenantDb(tenant, async (db) => {
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
          .select({ id: categories.id, slug: categories.slug, nameI18n: categories.nameI18n })
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
              itemProduct: {
                id: products.id,
                slug: products.slug,
                titleI18n: products.titleI18n,
              },
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
            .where(and(eq(productMedia.storeId, tenant.id), inArray(productMedia.productId, extraIds)))
        : [];

    const attachMedia = (list: Array<typeof products.$inferSelect>) =>
      list.map((p) => ({
        ...p,
        promoStartsAt: p.promoStartsAt ? p.promoStartsAt.toISOString() : null,
        promoEndsAt: p.promoEndsAt ? p.promoEndsAt.toISOString() : null,
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
      bundleRows,
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
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ slug: string }>;
}): Promise<Metadata> {
  const { slug } = await params;
  const locale = await getActiveLocale();
  try {
    const loaded = await loadProductBySlug(slug);
    if (!loaded) return { title: 'Product Not Found' };
    const { product, media } = loaded;
    const seo = product.seoI18n?.[locale] || product.seoI18n?.ar || {};
    const title = seo.metaTitle || pickI18n(product.titleI18n, locale);
    const description = seo.metaDescription || pickI18n(product.shortDescriptionI18n, locale);
    const img = seo.ogImage || media.find((m) => m.mediaType === 'IMAGE')?.url;

    return {
      title,
      description,
      openGraph: {
        title,
        description,
        images: img ? [{ url: img }] : undefined,
      },
    };
  } catch {
    return { title: 'Product' };
  }
}

export default async function ProductPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const locale = await getActiveLocale();

  const loaded = await loadProductBySlug(slug).catch(() => null);
  if (!loaded) {
    notFound();
  }

  const { product, category, media, variants, reviews, bundleRows, relatedProducts, frequentlyBoughtTogether } =
    loaded;

  const descriptionSanitizedI18n: I18nMap = {};
  for (const [loc, html] of Object.entries(product.descriptionI18n || {})) {
    descriptionSanitizedI18n[loc] = sanitizeRichHtml(html || '');
  }

  const detailData: ProductDetailData = {
    product: {
      id: product.id,
      slug: product.slug,
      productType: product.productType,
      titleI18n: product.titleI18n,
      shortDescriptionI18n: product.shortDescriptionI18n,
      descriptionSanitizedI18n,
      specificationsI18n: product.specificationsI18n,
      regularPrice: product.regularPrice,
      salePrice: product.salePrice,
      discountType: product.discountType,
      discountValue: product.discountValue,
      promoStartsAt: product.promoStartsAt ? product.promoStartsAt.toISOString() : null,
      promoEndsAt: product.promoEndsAt ? product.promoEndsAt.toISOString() : null,
      sku: product.sku,
      barcode: product.barcode,
      trackInventory: product.trackInventory,
      stockQuantity: product.stockQuantity,
      allowBackorders: product.allowBackorders,
      hasVariants: product.hasVariants,
      variantOptions: product.variantOptions,
      requiresShipping: product.requiresShipping,
      shippingConfig: product.shippingConfig,
      subscriptionConfig: product.subscriptionConfig,
      badgeI18n: product.badgeI18n,
      averageRating: product.averageRating,
      reviewsCount: product.reviewsCount,
    },
    category,
    media: media.map((m) => ({
      id: m.id,
      mediaType: m.mediaType,
      url: m.url,
      altI18n: m.altI18n,
    })),
    variants: variants.map((v) => ({
      id: v.id,
      titleI18n: v.titleI18n,
      optionValues: v.optionValues,
      sku: v.sku,
      barcode: v.barcode,
      regularPrice: v.regularPrice,
      salePrice: v.salePrice,
      stockQuantity: v.stockQuantity,
      imageUrl: v.imageUrl,
      isDefault: v.isDefault,
    })),
    reviews: reviews.map((r) => ({
      id: r.id,
      customerName: r.customerName,
      rating: r.rating,
      title: r.title,
      comment: r.comment,
      isVerifiedPurchase: r.isVerifiedPurchase,
      createdAt: r.createdAt.toISOString(),
    })),
    bundleItems: bundleRows,
    relatedProducts,
    frequentlyBoughtTogether,
  };

  const price = computeEffectivePrice({
    regularPrice: product.regularPrice,
    salePrice: product.salePrice,
    discountType: product.discountType,
    discountValue: product.discountValue,
    promoStartsAt: product.promoStartsAt,
    promoEndsAt: product.promoEndsAt,
  });

  const jsonLd = {
    '@context': 'https://schema.org',
    '@type': 'Product',
    name: pickI18n(product.titleI18n, locale),
    description: pickI18n(product.shortDescriptionI18n, locale),
    sku: product.sku || undefined,
    image: media.filter((m) => m.mediaType === 'IMAGE').map((m) => m.url),
    offers: {
      '@type': 'Offer',
      priceCurrency: 'MAD',
      price: price.effectivePrice,
      availability:
        !product.trackInventory || product.allowBackorders || product.stockQuantity > 0
          ? 'https://schema.org/InStock'
          : 'https://schema.org/OutOfStock',
    },
    ...(Number(product.reviewsCount) > 0
      ? {
          aggregateRating: {
            '@type': 'AggregateRating',
            ratingValue: product.averageRating,
            reviewCount: product.reviewsCount,
          },
        }
      : {}),
  };

  return (
    <StorefrontShell>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
      />
      <ProductDetailClient data={detailData} />
    </StorefrontShell>
  );
}

