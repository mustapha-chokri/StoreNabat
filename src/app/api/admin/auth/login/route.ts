import { NextRequest, NextResponse } from 'next/server';
import { and, eq } from 'drizzle-orm';
import { z } from 'zod';
import { adminUsers, auditLogs } from '@/db/schema/tenant';
import { getRequestTenant, withTenantDb } from '@/core/tenancy/context';
import { createAdminSession } from '@/core/auth/admin-session';
import { verifyPassword } from '@/core/crypto';
import { assertSameOrigin, errorResponse } from '@/core/http/api';
import { checkRateLimit } from '@/core/security/rate-limit';
import { getClientIp } from '@/core/security/csrf';

const LoginSchema = z.object({
  email: z.string().trim().email().optional().or(z.literal('')),
  password: z.string().min(1, 'كلمة المرور مطلوبة'),
});

export async function POST(req: NextRequest) {
  const csrfErr = assertSameOrigin(req);
  if (csrfErr) return csrfErr;

  try {
    const ip = getClientIp(req);
    const rl = await checkRateLimit({ key: `admin-login:${ip}`, limit: 10, windowSeconds: 300 });
    if (!rl.allowed) {
      return NextResponse.json(
        { error: 'تم تجاوز عدد المحاولات المسموح بها. يرجى المحاولة بعد دقائق.' },
        { status: 429 }
      );
    }

    const body = LoginSchema.parse(await req.json());
    const tenant = await getRequestTenant();

    const user = await withTenantDb(tenant, async (db) => {
      const emailQuery = body.email && body.email.trim() ? body.email.trim().toLowerCase() : null;
      const conds = [eq(adminUsers.storeId, tenant.id), eq(adminUsers.isActive, true)];
      if (emailQuery) {
        conds.push(eq(adminUsers.email, emailQuery));
      } else {
        conds.push(eq(adminUsers.role, 'OWNER'));
      }

      const rows = await db
        .select()
        .from(adminUsers)
        .where(and(...conds))
        .limit(1);

      if (rows.length === 0) return null;
      const valid = await verifyPassword(body.password, rows[0].passwordHash);
      if (!valid) return null;

      await db.insert(auditLogs).values({
        storeId: tenant.id,
        adminUserId: rows[0].id,
        actorEmail: rows[0].email,
        action: 'admin.login',
        ipAddress: ip,
      });

      return rows[0];
    });

    if (!user) {
      return NextResponse.json(
        { error: 'البريد الإلكتروني أو كلمة المرور غير صحيحة.' },
        { status: 401 }
      );
    }

    await createAdminSession({
      tenant,
      adminUserId: user.id,
      ipAddress: ip,
      userAgent: req.headers.get('user-agent') || undefined,
    });

    return NextResponse.json({
      admin: {
        id: user.id,
        email: user.email,
        fullName: user.fullName,
        role: user.role,
        permissions: user.permissions,
        preferredLocale: user.preferredLocale,
      },
    });
  } catch (err) {
    return errorResponse(err);
  }
}

