import { NextRequest, NextResponse } from 'next/server';
import { and, asc, eq } from 'drizzle-orm';
import { z } from 'zod';
import { categories } from '@/db/schema/tenant';
import { getRequestTenant, withTenantDb } from '@/core/tenancy/context';
import { requireAdmin } from '@/core/auth/admin-session';
import { assertSameOrigin, errorResponse } from '@/core/http/api';

const CategorySchema = z.object({
  id: z.string().uuid().optional(),
  parentId: z.string().uuid().nullable().optional(),
  slug: z.string().trim().min(2).max(150),
  nameI18n: z.record(z.string()),
  descriptionI18n: z.record(z.string()).default({}),
  imageUrl: z.string().nullable().optional(),
  isFeatured: z.boolean().default(false),
  sortOrder: z.number().int().default(0),
  isActive: z.boolean().default(true),
  seoI18n: z.record(z.any()).default({}),
});

export async function GET() {
  try {
    const tenant = await getRequestTenant();
    await requireAdmin(tenant, 'products.read');
    const list = await withTenantDb(tenant, async (db) =>
      db
        .select()
        .from(categories)
        .where(eq(categories.storeId, tenant.id))
        .orderBy(asc(categories.sortOrder))
    );
    return NextResponse.json({ categories: list });
  } catch (err) {
    return errorResponse(err);
  }
}

export async function POST(req: NextRequest) {
  const csrfErr = assertSameOrigin(req);
  if (csrfErr) return csrfErr;

  try {
    const tenant = await getRequestTenant();
    await requireAdmin(tenant, 'products.write');
    const body = CategorySchema.parse(await req.json());

    const row = await withTenantDb(tenant, async (db) => {
      if (body.id) {
        const [updated] = await db
          .update(categories)
          .set({
            parentId: body.parentId || null,
            slug: body.slug.toLowerCase().replace(/[^a-z0-9-_]/g, '-'),
            nameI18n: body.nameI18n,
            descriptionI18n: body.descriptionI18n,
            imageUrl: body.imageUrl || null,
            isFeatured: body.isFeatured,
            sortOrder: body.sortOrder,
            isActive: body.isActive,
            seoI18n: body.seoI18n,
            updatedAt: new Date(),
          })
          .where(and(eq(categories.storeId, tenant.id), eq(categories.id, body.id)))
          .returning();
        return updated;
      }

      const [created] = await db
        .insert(categories)
        .values({
          storeId: tenant.id,
          parentId: body.parentId || null,
          slug: body.slug.toLowerCase().replace(/[^a-z0-9-_]/g, '-'),
          nameI18n: body.nameI18n,
          descriptionI18n: body.descriptionI18n,
          imageUrl: body.imageUrl || null,
          isFeatured: body.isFeatured,
          sortOrder: body.sortOrder,
          isActive: body.isActive,
          seoI18n: body.seoI18n,
        })
        .returning();
      return created;
    });

    return NextResponse.json({ category: row }, { status: body.id ? 200 : 201 });
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
        .delete(categories)
        .where(and(eq(categories.storeId, tenant.id), eq(categories.id, id)));
    });
    return NextResponse.json({ ok: true });
  } catch (err) {
    return errorResponse(err);
  }
}

