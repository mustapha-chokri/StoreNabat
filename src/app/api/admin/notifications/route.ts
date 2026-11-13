import { NextRequest, NextResponse } from 'next/server';
import { and, desc, eq } from 'drizzle-orm';
import { notifications } from '@/db/schema/tenant';
import { getRequestTenant, withTenantDb } from '@/core/tenancy/context';
import { requireAdmin } from '@/core/auth/admin-session';
import { assertSameOrigin, errorResponse } from '@/core/http/api';

export async function GET() {
  try {
    const tenant = await getRequestTenant();
    await requireAdmin(tenant);

    const rows = await withTenantDb(tenant, async (db) =>
      db
        .select()
        .from(notifications)
        .where(eq(notifications.storeId, tenant.id))
        .orderBy(desc(notifications.createdAt))
        .limit(50)
    );

    const unreadCount = rows.filter((r) => !r.isRead).length;
    return NextResponse.json({ notifications: rows, unreadCount });
  } catch (err) {
    return errorResponse(err);
  }
}

export async function PATCH(req: NextRequest) {
  const csrfErr = assertSameOrigin(req);
  if (csrfErr) return csrfErr;

  try {
    const tenant = await getRequestTenant();
    await requireAdmin(tenant);
    const { id, markAll } = (await req.json()) as { id?: string; markAll?: boolean };

    await withTenantDb(tenant, async (db) => {
      if (markAll) {
        await db
          .update(notifications)
          .set({ isRead: true })
          .where(eq(notifications.storeId, tenant.id));
      } else if (id) {
        await db
          .update(notifications)
          .set({ isRead: true })
          .where(and(eq(notifications.storeId, tenant.id), eq(notifications.id, id)));
      }
    });

    return NextResponse.json({ ok: true });
  } catch (err) {
    return errorResponse(err);
  }
}

