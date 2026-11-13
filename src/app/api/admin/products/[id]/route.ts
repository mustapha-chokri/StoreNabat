import { NextRequest, NextResponse } from 'next/server';
import { and, eq } from 'drizzle-orm';
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

export async function PATCH(
  req: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  const csrfErr = assertSameOrigin(req);
  if (csrfErr) return csrfErr;

  try {
    const { id } = await context.params;
    const tenant = await getRequestTenant();
    const admin = await requireAdmin(tenant, 'products.write');
    const body = (await req.json()) as Record<string, unknown>;

    const updated = await withTenantDb(tenant, async (db) => {
      const existingRows = await db
        .select()
        .from(products)
        .where(and(eq(products.storeId, tenant.id), eq(products.id, id)))
        .limit(1);

      if (existingRows.length === 0) throw new Error('PRODUCT_NOT_FOUND');

      const updateFields: Record<string, unknown> = { updatedAt: new Date() };
      const allowedDirectKeys = [
        'categoryId',
        'productType',
        'slug',
        'titleI18n',
        'shortDescriptionI18n',
        'descriptionI18n',
        'specificationsI18n',
        'discountType',
        'sku',
        'barcode',
        'trackInventory',
        'stockQuantity',
        'lowStockThreshold',
        'allowBackorders',
        'hasVariants',
        'variantOptions',
        'requiresShipping',
        'shippingConfig',
        'subscriptionConfig',
        'isPublished',
        'isFeatured',
        'isBestSeller',
        'isNewArrival',
        'badgeI18n',
        'frequentlyBoughtTogetherIds',
        'relatedProductIds',
        'seoI18n',
      ];

      for (const k of allowedDirectKeys) {
        if (k in body) updateFields[k] = body[k];
      }
      if ('regularPrice' in body) {
        updateFields.regularPrice = Number(body.regularPrice).toFixed(2);
      }
      if ('salePrice' in body) {
        updateFields.salePrice =
          body.salePrice !== null && body.salePrice !== ''
            ? Number(body.salePrice).toFixed(2)
            : null;
      }
      if ('discountValue' in body) {
        updateFields.discountValue =
          body.discountValue !== null && body.discountValue !== ''
            ? Number(body.discountValue).toFixed(2)
            : null;
      }
      if ('promoStartsAt' in body) {
        updateFields.promoStartsAt = body.promoStartsAt ? new Date(String(body.promoStartsAt)) : null;
      }
      if ('promoEndsAt' in body) {
        updateFields.promoEndsAt = body.promoEndsAt ? new Date(String(body.promoEndsAt)) : null;
      }

      const [prod] = await db
        .update(products)
        .set(updateFields)
        .where(and(eq(products.storeId, tenant.id), eq(products.id, id)))
        .returning();

      if (Array.isArray(body.media)) {
        await db
          .delete(productMedia)
          .where(and(eq(productMedia.storeId, tenant.id), eq(productMedia.productId, id)));
        if (body.media.length > 0) {
          await db.insert(productMedia).values(
            (body.media as Array<{ mediaType?: string; url: string; sortOrder?: number }>).map(
              (m, idx) => ({
                storeId: tenant.id,
                productId: id,
                mediaType: m.mediaType || 'IMAGE',
                url: m.url,
                sortOrder: m.sortOrder ?? idx,
              })
            )
          );
        }
      }

      if (Array.isArray(body.variants)) {
        await db
          .delete(productVariants)
          .where(and(eq(productVariants.storeId, tenant.id), eq(productVariants.productId, id)));
        if (body.variants.length > 0) {
          await db.insert(productVariants).values(
            (
              body.variants as Array<{
                titleI18n: Record<string, string>;
                optionValues?: Record<string, string>;
                sku?: string | null;
                barcode?: string | null;
                regularPrice: number | string;
                salePrice?: number | string | null;
                stockQuantity?: number;
                imageUrl?: string | null;
                isDefault?: boolean;
                isActive?: boolean;
              }>
            ).map((v, idx) => ({
              storeId: tenant.id,
              productId: id,
              titleI18n: v.titleI18n,
              optionValues: v.optionValues || {},
              sku: v.sku || null,
              barcode: v.barcode || null,
              regularPrice: Number(v.regularPrice).toFixed(2),
              salePrice:
                v.salePrice !== null && v.salePrice !== undefined && v.salePrice !== ''
                  ? Number(v.salePrice).toFixed(2)
                  : null,
              stockQuantity: v.stockQuantity ?? 0,
              imageUrl: v.imageUrl || null,
              isDefault: v.isDefault ?? idx === 0,
              isActive: v.isActive ?? true,
            }))
          );
        }
      }

      if (Array.isArray(body.bundleItems)) {
        await db
          .delete(productBundleItems)
          .where(
            and(
              eq(productBundleItems.storeId, tenant.id),
              eq(productBundleItems.bundleProductId, id)
            )
          );
        if (body.bundleItems.length > 0) {
          await db.insert(productBundleItems).values(
            (
              body.bundleItems as Array<{
                itemProductId: string;
                itemVariantId?: string | null;
                quantity?: number;
              }>
            ).map((b) => ({
              storeId: tenant.id,
              bundleProductId: id,
              itemProductId: b.itemProductId,
              itemVariantId: b.itemVariantId || null,
              quantity: b.quantity || 1,
            }))
          );
        }
      }

      if (Array.isArray(body.digitalFiles)) {
        await db
          .delete(digitalFiles)
          .where(and(eq(digitalFiles.storeId, tenant.id), eq(digitalFiles.productId, id)));
        if (body.digitalFiles.length > 0) {
          await db.insert(digitalFiles).values(
            (
              body.digitalFiles as Array<{
                fileName: string;
                storageKey: string;
                mimeType: string;
                fileSizeBytes: number;
                maxDownloads?: number | null;
                expiryDays?: number | null;
              }>
            ).map((d) => ({
              storeId: tenant.id,
              productId: id,
              fileName: d.fileName,
              storageKey: d.storageKey,
              mimeType: d.mimeType,
              fileSizeBytes: d.fileSizeBytes,
              maxDownloads: d.maxDownloads ?? null,
              expiryDays: d.expiryDays ?? null,
            }))
          );
        }
      }

      await db.insert(auditLogs).values({
        storeId: tenant.id,
        adminUserId: admin.id,
        actorEmail: admin.email,
        action: 'product.updated',
        entityType: 'product',
        entityId: id,
      });

      return prod;
    });

    return NextResponse.json({ product: updated });
  } catch (err) {
    return errorResponse(err);
  }
}

export async function POST(
  req: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  // Duplicate product endpoint
  const csrfErr = assertSameOrigin(req);
  if (csrfErr) return csrfErr;

  try {
    const { id } = await context.params;
    const tenant = await getRequestTenant();
    const admin = await requireAdmin(tenant, 'products.write');

    const duplicated = await withTenantDb(tenant, async (db) => {
      const [src] = await db
        .select()
        .from(products)
        .where(and(eq(products.storeId, tenant.id), eq(products.id, id)))
        .limit(1);

      if (!src) throw new Error('PRODUCT_NOT_FOUND');

      const copySuffix = Date.now().toString().slice(-5);
      const [clone] = await db
        .insert(products)
        .values({
          ...src,
          id: undefined,
          slug: `${src.slug}-copy-${copySuffix}`,
          titleI18n: {
            ar: `${src.titleI18n.ar || ''} (نسخة)`,
            fr: `${src.titleI18n.fr || ''} (Copie)`,
            en: `${src.titleI18n.en || ''} (Copy)`,
          },
          isPublished: false,
          salesCount: 0,
          createdAt: undefined,
          updatedAt: undefined,
        })
        .returning();

      const media = await db
        .select()
        .from(productMedia)
        .where(and(eq(productMedia.storeId, tenant.id), eq(productMedia.productId, src.id)));
      if (media.length > 0) {
        await db.insert(productMedia).values(
          media.map((m) => ({
            storeId: tenant.id,
            productId: clone.id,
            mediaType: m.mediaType,
            url: m.url,
            altI18n: m.altI18n,
            sortOrder: m.sortOrder,
          }))
        );
      }

      const vars = await db
        .select()
        .from(productVariants)
        .where(and(eq(productVariants.storeId, tenant.id), eq(productVariants.productId, src.id)));
      if (vars.length > 0) {
        await db.insert(productVariants).values(
          vars.map((v) => ({
            storeId: tenant.id,
            productId: clone.id,
            titleI18n: v.titleI18n,
            optionValues: v.optionValues,
            sku: v.sku ? `${v.sku}-${copySuffix}` : null,
            regularPrice: v.regularPrice,
            salePrice: v.salePrice,
            stockQuantity: v.stockQuantity,
            imageUrl: v.imageUrl,
            isDefault: v.isDefault,
            isActive: v.isActive,
          }))
        );
      }

      await db.insert(auditLogs).values({
        storeId: tenant.id,
        adminUserId: admin.id,
        actorEmail: admin.email,
        action: 'product.duplicated',
        entityType: 'product',
        entityId: clone.id,
      });

      return clone;
    });

    return NextResponse.json({ product: duplicated }, { status: 201 });
  } catch (err) {
    return errorResponse(err);
  }
}

export async function DELETE(
  req: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  const csrfErr = assertSameOrigin(req);
  if (csrfErr) return csrfErr;

  try {
    const { id } = await context.params;
    const tenant = await getRequestTenant();
    const admin = await requireAdmin(tenant, 'products.write');

    await withTenantDb(tenant, async (db) => {
      await db
        .delete(products)
        .where(and(eq(products.storeId, tenant.id), eq(products.id, id)));

      await db.insert(auditLogs).values({
        storeId: tenant.id,
        adminUserId: admin.id,
        actorEmail: admin.email,
        action: 'product.deleted',
        entityType: 'product',
        entityId: id,
      });
    });

    return NextResponse.json({ ok: true });
  } catch (err) {
    return errorResponse(err);
  }
}

