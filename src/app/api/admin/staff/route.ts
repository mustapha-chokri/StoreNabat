import { NextRequest, NextResponse } from 'next/server';
import { and, desc, eq } from 'drizzle-orm';
import { z } from 'zod';
import { adminUsers, auditLogs } from '@/db/schema/tenant';
import { getControlDb } from '@/db/pools';
import { tenantDomains, tenantMigrationsLog } from '@/db/schema/control-plane';
import { getRequestTenant, withTenantDb } from '@/core/tenancy/context';
import { requireAdmin } from '@/core/auth/admin-session';
import { hashPassword } from '@/core/crypto';
import { assertSameOrigin, errorResponse } from '@/core/http/api';

const StaffCreateSchema = z.object({
  email: z.string().trim().email(),
  fullName: z.string().trim().min(2).max(150),
  password: z.string().min(8).max(128),
  role: z.enum(['ADMIN', 'MANAGER', 'CONFIRMATOR', 'EDITOR']),
  permissions: z.array(z.string()).default([]),
  preferredLocale: z.enum(['ar', 'fr', 'en']).default('ar'),
});

export async function GET() {
  try {
    const tenant = await getRequestTenant();
    await requireAdmin(tenant, 'staff.manage');

    const controlDb = getControlDb();
    const domains = await controlDb
      .select()
      .from(tenantDomains)
      .where(eq(tenantDomains.tenantId, tenant.id));

    const migrations = await controlDb
      .select()
      .from(tenantMigrationsLog)
      .where(eq(tenantMigrationsLog.tenantId, tenant.id))
      .orderBy(desc(tenantMigrationsLog.startedAt))
      .limit(20);

    const tenantData = await withTenantDb(tenant, async (db) => {
      const staff = await db
        .select({
          id: adminUsers.id,
          email: adminUsers.email,
          fullName: adminUsers.fullName,
          role: adminUsers.role,
          permissions: adminUsers.permissions,
          preferredLocale: adminUsers.preferredLocale,
          isActive: adminUsers.isActive,
          lastLoginAt: adminUsers.lastLoginAt,
          createdAt: adminUsers.createdAt,
        })
        .from(adminUsers)
        .where(eq(adminUsers.storeId, tenant.id));

      const logs = await db
        .select()
        .from(auditLogs)
        .where(eq(auditLogs.storeId, tenant.id))
        .orderBy(desc(auditLogs.createdAt))
        .limit(80);

      return { staff, auditLogs: logs };
    });

    return NextResponse.json({
      ...tenantData,
      tenancy: {
        id: tenant.id,
        slug: tenant.slug,
        name: tenant.name,
        status: tenant.status,
        isolationMode: tenant.isolationMode,
        migrationVersion: tenant.migrationVersion,
        planTier: tenant.planTier,
        domains,
        migrations,
      },
    });
  } catch (err) {
    return errorResponse(err);
  }
}

export async function POST(req: NextRequest) {
  const csrfErr = assertSameOrigin(req);
  if (csrfErr) return csrfErr;

  try {
    const tenant = await getRequestTenant();
    const admin = await requireAdmin(tenant, 'staff.manage');
    const body = StaffCreateSchema.parse(await req.json());
    const passwordHash = await hashPassword(body.password);

    const created = await withTenantDb(tenant, async (db) => {
      const [user] = await db
        .insert(adminUsers)
        .values({
          storeId: tenant.id,
          email: body.email.toLowerCase(),
          fullName: body.fullName,
          passwordHash,
          role: body.role,
          permissions: body.permissions,
          preferredLocale: body.preferredLocale,
          isActive: true,
        })
        .returning({
          id: adminUsers.id,
          email: adminUsers.email,
          fullName: adminUsers.fullName,
          role: adminUsers.role,
        });

      await db.insert(auditLogs).values({
        storeId: tenant.id,
        adminUserId: admin.id,
        actorEmail: admin.email,
        action: 'staff.created',
        entityType: 'admin_user',
        entityId: user.id,
        metadata: { targetEmail: user.email, role: user.role },
      });

      return user;
    });

    return NextResponse.json({ staffMember: created }, { status: 201 });
  } catch (err) {
    return errorResponse(err);
  }
}

export async function PATCH(req: NextRequest) {
  const csrfErr = assertSameOrigin(req);
  if (csrfErr) return csrfErr;

  try {
    const tenant = await getRequestTenant();
    const admin = await requireAdmin(tenant, 'staff.manage');
    const { id, isActive, role, permissions } = (await req.json()) as {
      id: string;
      isActive?: boolean;
      role?: 'ADMIN' | 'MANAGER' | 'CONFIRMATOR' | 'EDITOR';
      permissions?: string[];
    };

    if (id === admin.id && isActive === false) {
      return NextResponse.json({ error: 'Cannot deactivate your own account.' }, { status: 400 });
    }

    await withTenantDb(tenant, async (db) => {
      await db
        .update(adminUsers)
        .set({
          ...(isActive !== undefined ? { isActive } : {}),
          ...(role !== undefined ? { role } : {}),
          ...(permissions !== undefined ? { permissions } : {}),
          updatedAt: new Date(),
        })
        .where(and(eq(adminUsers.storeId, tenant.id), eq(adminUsers.id, id)));

      await db.insert(auditLogs).values({
        storeId: tenant.id,
        adminUserId: admin.id,
        actorEmail: admin.email,
        action: 'staff.updated',
        entityType: 'admin_user',
        entityId: id,
      });
    });

    return NextResponse.json({ ok: true });
  } catch (err) {
    return errorResponse(err);
  }
}

