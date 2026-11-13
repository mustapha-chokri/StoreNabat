import { NextRequest, NextResponse } from 'next/server';
import { and, eq } from 'drizzle-orm';
import { z } from 'zod';
import { productReviews, products } from '@/db/schema/tenant';
import { withRequestTenantDb } from '@/core/tenancy/context';
import { assertSameOrigin, errorResponse } from '@/core/http/api';
import { createTenantNotification } from '@/services/notifications';
import { checkRateLimit } from '@/core/security/rate-limit';
import { getClientIp } from '@/core/security/csrf';

const ReviewSchema = z.object({
  customerName: z.string().trim().min(2).max(120),
  rating: z.number().int().min(1).max(5),
  title: z.string().trim().max(180).optional(),
  comment: z.string().trim().min(4).max(2000),
});

export async function POST(
  req: NextRequest,
  context: { params: Promise<{ slug: string }> }
) {
  const csrfErr = assertSameOrigin(req);
  if (csrfErr) return csrfErr;

  try {
    const ip = getClientIp(req);
    const rl = await checkRateLimit({ key: `review:${ip}`, limit: 10, windowSeconds: 3600 });
    if (!rl.allowed) {
      return NextResponse.json({ error: 'Too many review submissions.' }, { status: 429 });
    }

    const { slug } = await context.params;
    const body = ReviewSchema.parse(await req.json());

    const created = await withRequestTenantDb(async (db, tenant) => {
      const prodRows = await db
        .select()
        .from(products)
        .where(and(eq(products.storeId, tenant.id), eq(products.slug, slug)))
        .limit(1);

      if (prodRows.length === 0) throw new Error('PRODUCT_NOT_FOUND');
      const prod = prodRows[0];

      const [review] = await db
        .insert(productReviews)
        .values({
          storeId: tenant.id,
          productId: prod.id,
          customerName: body.customerName,
          rating: body.rating,
          title: body.title || null,
          comment: body.comment,
          status: 'PENDING',
        })
        .returning();

      await createTenantNotification(db, {
        storeId: tenant.id,
        type: 'NEW_REVIEW',
        titleI18n: { ar: 'تقييم منتج جديد', fr: 'Nouvel avis client', en: 'New Product Review' },
        messageI18n: {
          ar: `${body.customerName} قيّم ${prod.titleI18n.ar || prod.slug} (${body.rating}/5)`,
          fr: `${body.customerName} a noté ${prod.titleI18n.fr || prod.slug} (${body.rating}/5)`,
          en: `${body.customerName} rated ${prod.titleI18n.en || prod.slug} (${body.rating}/5)`,
        },
        linkUrl: '/admin/reviews',
        entityType: 'review',
        entityId: review.id,
      });

      return review;
    });

    return NextResponse.json({ review: created }, { status: 201 });
  } catch (err) {
    return errorResponse(err);
  }
}

