import { NextRequest, NextResponse } from 'next/server';
import { and, desc, eq, inArray, sql } from 'drizzle-orm';
import { z } from 'zod';
import {
  auditLogs,
  digitalFiles,
  productBundleItems,
  productMedia,
  products,
  productVariants,
} from '@/db/schema/tenant';
import { getRequestTenant, withTenantDb } from '@/core/tenancy/context';
import { requireAdmin } from '@/core/auth/admin-session';
import { assertSameOrigin, errorResponse } from '@/core/http/api';

const ProductPayloadSchema = z.object({
  categoryId: z.preprocess((val) => (val === '' ? null : val), z.string().uuid().nullable().optional()),
  productType: z.enum(['PHYSICAL', 'DIGITAL', 'SERVICE', 'SUBSCRIPTION', 'BUNDLE']).default('PHYSICAL'),
  slug: z.preprocess((val) => (typeof val === 'string' && val.trim() ? val.trim() : undefined), z.string().min(1).max(170).optional()),
  titleI18n: z.record(z.string()).default({}),
  shortDescriptionI18n: z.record(z.string()).default({}),
  descriptionI18n: z.record(z.string()).default({}),
  specificationsI18n: z
    .record(z.array(z.object({ key: z.string(), value: z.string() })))
    .default({}),
  regularPrice: z.union([z.number(), z.string()]).default(0),
  salePrice: z.union([z.number(), z.string()]).nullable().optional(),
  discountType: z.enum(['PERCENT', 'FIXED']).nullable().optional(),
  discountValue: z.union([z.number(), z.string()]).nullable().optional(),
  promoStartsAt: z.string().datetime().nullable().optional(),
  promoEndsAt: z.string().datetime().nullable().optional(),
  sku: z.string().max(100).nullable().optional(),
  barcode: z.string().max(100).nullable().optional(),
  trackInventory: z.boolean().default(true),
  stockQuantity: z.number().int().default(0),
  lowStockThreshold: z.number().int().default(5),
  allowBackorders: z.boolean().default(false),
  hasVariants: z.boolean().default(false),
  variantOptions: z.array(z.any()).default([]),
  requiresShipping: z.boolean().default(true),
  shippingConfig: z.record(z.unknown()).default({}),
  subscriptionConfig: z.record(z.unknown()).default({}),
  isPublished: z.boolean().default(true),
  isFeatured: z.boolean().default(false),
  isBestSeller: z.boolean().default(false),
  isNewArrival: z.boolean().default(false),
  badgeI18n: z.record(z.string()).nullable().optional(),
  frequentlyBoughtTogetherIds: z.array(z.string().uuid()).default([]),
  relatedProductIds: z.array(z.string().uuid()).default([]),
  seoI18n: z.record(z.any()).default({}),
  media: z
    .array(
      z.object({
        mediaType: z.enum(['IMAGE', 'VIDEO']).default('IMAGE'),
        url: z.string().min(1, 'Media URL is required'),
        sortOrder: z.number().int().default(0),
      })
    )
    .default([]),
  variants: z
    .array(
      z.object({
        id: z.string().uuid().optional(),
        titleI18n: z.record(z.string()).default({ ar: 'خيار' }),
        optionValues: z.record(z.string()).default({}),
        sku: z.string().nullable().optional(),
        barcode: z.string().nullable().optional(),
        regularPrice: z.union([z.number(), z.string()]).default(0),
        salePrice: z.union([z.number(), z.string()]).nullable().optional(),
        stockQuantity: z.number().int().default(0),
        imageUrl: z.string().nullable().optional(),
        isDefault: z.boolean().default(false),
        isActive: z.boolean().default(true),
      })
    )
    .default([]),
  bundleItems: z
    .array(
      z.object({
        itemProductId: z.string().uuid(),
        itemVariantId: z.string().uuid().nullable().optional(),
        quantity: z.number().int().min(1).default(1),
      })
    )
    .default([]),
  digitalFiles: z
    .array(
      z.object({
        fileName: z.string().min(1, 'File name is required'),
        storageKey: z.string().min(1, 'Digital file storageKey is required'),
        mimeType: z.string().default('application/octet-stream'),
        fileSizeBytes: z.number().int().default(0),
        maxDownloads: z.number().int().nullable().optional(),
        expiryDays: z.number().int().nullable().optional(),
      })
    )
    .default([]),
});

export async function GET(req: NextRequest) {
  try {
    const tenant = await getRequestTenant();
    await requireAdmin(tenant, 'products.read');

    const q = (req.nextUrl.searchParams.get('q') || '').trim();
    const data = await withTenantDb(tenant, async (db) => {
      const conds = [eq(products.storeId, tenant.id)];
      if (q) {
        const pattern = `%${q}%`;
        conds.push(
          sql`(${products.titleI18n}::text ILIKE ${pattern} OR ${products.slug} ILIKE ${pattern} OR ${products.sku} ILIKE ${pattern})`
        );
      }

      const list = await db
        .select()
        .from(products)
        .where(and(...conds))
        .orderBy(desc(products.createdAt));

      const ids = list.map((p) => p.id);
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
                and(eq(productVariants.storeId, tenant.id), inArray(productVariants.productId, ids))
              )
          : [];
      const digitalRows =
        ids.length > 0
          ? await db
              .select()
              .from(digitalFiles)
              .where(and(eq(digitalFiles.storeId, tenant.id), inArray(digitalFiles.productId, ids)))
          : [];
      const bundleRows =
        ids.length > 0
          ? await db
              .select()
              .from(productBundleItems)
              .where(
                and(
                  eq(productBundleItems.storeId, tenant.id),
                  inArray(productBundleItems.bundleProductId, ids)
                )
              )
          : [];

      return list.map((p) => ({
        ...p,
        media: mediaRows.filter((m) => m.productId === p.id),
        variants: variantRows.filter((v) => v.productId === p.id),
        digitalFiles: digitalRows.filter((d) => d.productId === p.id),
        bundleItems: bundleRows.filter((b) => b.bundleProductId === p.id),
      }));
    });

    return NextResponse.json({ products: data });
  } catch (err) {
    return errorResponse(err);
  }
}

export async function POST(req: NextRequest) {
  const csrfErr = assertSameOrigin(req);
  if (csrfErr) return csrfErr;

  try {
    const tenant = await getRequestTenant();
    const admin = await requireAdmin(tenant, 'products.write');
    const body = ProductPayloadSchema.parse(await req.json());

    const created = await withTenantDb(tenant, async (db) => {
      const finalSlug = (
        body.slug ||
        body.titleI18n?.en ||
        body.titleI18n?.fr ||
        body.titleI18n?.ar ||
        `prod-${Date.now()}`
      )
        .toLowerCase()
        .replace(/[\s_]+/g, '-')
        .replace(/[^a-z0-9\u0600-\u06FF-]/g, '')
        .replace(/-+/g, '-')
        .replace(/^-|-$/g, '') || `prod-${Date.now()}`;

      const [prod] = await db
        .insert(products)
        .values({
          storeId: tenant.id,
          categoryId: body.categoryId || null,
          productType: body.productType,
          slug: finalSlug,
          titleI18n: body.titleI18n,
          shortDescriptionI18n: body.shortDescriptionI18n,
          descriptionI18n: body.descriptionI18n,
          specificationsI18n: body.specificationsI18n,
          regularPrice: Number(body.regularPrice).toFixed(2),
          salePrice:
            body.salePrice !== null && body.salePrice !== undefined && body.salePrice !== ''
              ? Number(body.salePrice).toFixed(2)
              : null,
          discountType: body.discountType || null,
          discountValue:
            body.discountValue !== null && body.discountValue !== undefined && body.discountValue !== ''
              ? Number(body.discountValue).toFixed(2)
              : null,
          promoStartsAt: body.promoStartsAt ? new Date(body.promoStartsAt) : null,
          promoEndsAt: body.promoEndsAt ? new Date(body.promoEndsAt) : null,
          sku: body.sku || null,
          barcode: body.barcode || null,
          trackInventory:
            body.productType === 'DIGITAL' || body.productType === 'SERVICE'
              ? false
              : body.trackInventory,
          stockQuantity: body.stockQuantity,
          lowStockThreshold: body.lowStockThreshold,
          allowBackorders: body.allowBackorders,
          hasVariants: body.hasVariants || body.variants.length > 0,
          variantOptions: body.variantOptions,
          requiresShipping: body.productType === 'DIGITAL' ? false : body.requiresShipping,
          shippingConfig: body.shippingConfig,
          subscriptionConfig: body.subscriptionConfig,
          isPublished: body.isPublished,
          isFeatured: body.isFeatured,
          isBestSeller: body.isBestSeller,
          isNewArrival: body.isNewArrival,
          badgeI18n: body.badgeI18n || null,
          frequentlyBoughtTogetherIds: body.frequentlyBoughtTogetherIds,
          relatedProductIds: body.relatedProductIds,
          seoI18n: body.seoI18n,
        })
        .returning();

      if (body.media.length > 0) {
        await db.insert(productMedia).values(
          body.media.map((m, idx) => ({
            storeId: tenant.id,
            productId: prod.id,
            mediaType: m.mediaType,
            url: m.url,
            sortOrder: m.sortOrder ?? idx,
          }))
        );
      }

      if (body.variants.length > 0) {
        await db.insert(productVariants).values(
          body.variants.map((v, idx) => ({
            storeId: tenant.id,
            productId: prod.id,
            titleI18n: v.titleI18n,
            optionValues: v.optionValues,
            sku: v.sku || null,
            barcode: v.barcode || null,
            regularPrice: Number(v.regularPrice).toFixed(2),
            salePrice:
              v.salePrice !== null && v.salePrice !== undefined && v.salePrice !== ''
                ? Number(v.salePrice).toFixed(2)
                : null,
            stockQuantity: v.stockQuantity,
            imageUrl: v.imageUrl || null,
            isDefault: v.isDefault ?? idx === 0,
            isActive: v.isActive ?? true,
          }))
        );
      }

      if (body.bundleItems.length > 0) {
        await db.insert(productBundleItems).values(
          body.bundleItems.map((b) => ({
            storeId: tenant.id,
            bundleProductId: prod.id,
            itemProductId: b.itemProductId,
            itemVariantId: b.itemVariantId || null,
            quantity: b.quantity,
          }))
        );
      }

      if (body.digitalFiles.length > 0) {
        await db.insert(digitalFiles).values(
          body.digitalFiles.map((d) => ({
            storeId: tenant.id,
            productId: prod.id,
            fileName: d.fileName,
            storageKey: d.storageKey,
            mimeType: d.mimeType,
            fileSizeBytes: d.fileSizeBytes,
            maxDownloads: d.maxDownloads ?? null,
            expiryDays: d.expiryDays ?? null,
          }))
        );
      }

      await db.insert(auditLogs).values({
        storeId: tenant.id,
        adminUserId: admin.id,
        actorEmail: admin.email,
        action: 'product.created',
        entityType: 'product',
        entityId: prod.id,
        metadata: { slug: prod.slug, productType: prod.productType },
      });

      return prod;
    });

    return NextResponse.json({ product: created }, { status: 201 });
  } catch (err) {
    return errorResponse(err);
  }
}

