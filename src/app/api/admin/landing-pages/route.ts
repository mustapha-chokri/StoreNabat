import { NextRequest, NextResponse } from 'next/server';
import { and, desc, eq } from 'drizzle-orm';
import { z } from 'zod';
import { landingPages } from '@/db/schema/tenant';
import { getRequestTenant, withTenantDb } from '@/core/tenancy/context';
import { requireAdmin } from '@/core/auth/admin-session';
import { assertSameOrigin, errorResponse } from '@/core/http/api';

const LandingPageSchema = z.object({
  id: z.string().uuid().optional(),
  productId: z.string().uuid().nullable().optional(),
  slug: z.string().trim().min(2).max(150),
  titleI18n: z.record(z.string()),
  isPublished: z.boolean().default(false),
  showHeader: z.boolean().default(false),
  showFooter: z.boolean().default(false),
  sections: z.array(z.any()).default([]),
  seoI18n: z.record(z.any()).default({}),
  customPixels: z.record(z.any()).default({}),
});

export async function GET() {
  try {
    const tenant = await getRequestTenant();
    await requireAdmin(tenant, 'landing.write');
    const list = await withTenantDb(tenant, async (db) =>
      db
        .select()
        .from(landingPages)
        .where(eq(landingPages.storeId, tenant.id))
        .orderBy(desc(landingPages.updatedAt))
    );
    return NextResponse.json({ landingPages: list });
  } catch (err) {
    return errorResponse(err);
  }
}

export async function POST(req: NextRequest) {
  const csrfErr = assertSameOrigin(req);
  if (csrfErr) return csrfErr;

  try {
    const tenant = await getRequestTenant();
    await requireAdmin(tenant, 'landing.write');
    const raw = await req.json();

    if (raw?.action === 'DUPLICATE' && raw?.sourceId) {
      const cloned = await withTenantDb(tenant, async (db) => {
        const [src] = await db
          .select()
          .from(landingPages)
          .where(and(eq(landingPages.storeId, tenant.id), eq(landingPages.id, raw.sourceId)))
          .limit(1);
        if (!src) throw new Error('Landing page not found');
        const suffix = Date.now().toString().slice(-4);
        const [row] = await db
          .insert(landingPages)
          .values({
            storeId: tenant.id,
            productId: src.productId,
            slug: `${src.slug}-copy-${suffix}`,
            titleI18n: {
              ar: `${src.titleI18n.ar || ''} (نسخة)`,
              fr: `${src.titleI18n.fr || ''} (Copie)`,
              en: `${src.titleI18n.en || ''} (Copy)`,
            },
            isPublished: false,
            showHeader: src.showHeader,
            showFooter: src.showFooter,
            sections: src.sections,
            seoI18n: src.seoI18n,
            customPixels: src.customPixels,
          })
          .returning();
        return row;
      });
      return NextResponse.json({ landingPage: cloned }, { status: 201 });
    }

    const body = LandingPageSchema.parse(raw);
    const cleanSlug = body.slug.toLowerCase().replace(/[^a-z0-9-_]/g, '-');

    const saved = await withTenantDb(tenant, async (db) => {
      if (body.id) {
        const [u] = await db
          .update(landingPages)
          .set({
            productId: body.productId || null,
            slug: cleanSlug,
            titleI18n: body.titleI18n,
            isPublished: body.isPublished,
            showHeader: body.showHeader,
            showFooter: body.showFooter,
            sections: body.sections,
            seoI18n: body.seoI18n,
            customPixels: body.customPixels,
            updatedAt: new Date(),
          })
          .where(and(eq(landingPages.storeId, tenant.id), eq(landingPages.id, body.id)))
          .returning();
        return u;
      }

      const [c] = await db
        .insert(landingPages)
        .values({
          storeId: tenant.id,
          productId: body.productId || null,
          slug: cleanSlug,
          titleI18n: body.titleI18n,
          isPublished: body.isPublished,
          showHeader: body.showHeader,
          showFooter: body.showFooter,
          sections: body.sections,
          seoI18n: body.seoI18n,
          customPixels: body.customPixels,
        })
        .returning();
      return c;
    });

    return NextResponse.json({ landingPage: saved }, { status: body.id ? 200 : 201 });
  } catch (err) {
    return errorResponse(err);
  }
}

export async function DELETE(req: NextRequest) {
  const csrfErr = assertSameOrigin(req);
  if (csrfErr) return csrfErr;

  try {
    const tenant = await getRequestTenant();
    await requireAdmin(tenant, 'landing.write');
    const id = req.nextUrl.searchParams.get('id');
    if (!id) return NextResponse.json({ error: 'id required' }, { status: 400 });

    await withTenantDb(tenant, async (db) => {
      await db
        .delete(landingPages)
        .where(and(eq(landingPages.storeId, tenant.id), eq(landingPages.id, id)));
    });
    return NextResponse.json({ ok: true });
  } catch (err) {
    return errorResponse(err);
  }
}

