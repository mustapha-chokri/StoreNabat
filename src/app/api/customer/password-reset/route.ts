import { NextRequest, NextResponse } from 'next/server';
import { and, eq, gt, isNull } from 'drizzle-orm';
import { z } from 'zod';
import { customers, passwordResetTokens } from '@/db/schema/tenant';
import { getRequestTenant, withTenantDb } from '@/core/tenancy/context';
import { generateSecureToken, hashPassword, hashToken } from '@/core/crypto';
import { enqueueJob } from '@/core/jobs/queue';
import { getEnv } from '@/core/env';
import { assertSameOrigin, errorResponse } from '@/core/http/api';

const RequestResetSchema = z.object({
  action: z.literal('REQUEST'),
  email: z.string().trim().email(),
});

const ConfirmResetSchema = z.object({
  action: z.literal('CONFIRM'),
  token: z.string().min(16),
  newPassword: z.string().min(8).max(128),
});

export async function POST(req: NextRequest) {
  const csrfErr = assertSameOrigin(req);
  if (csrfErr) return csrfErr;

  try {
    const raw = await req.json();
    const tenant = await getRequestTenant();

    if (raw?.action === 'REQUEST') {
      const body = RequestResetSchema.parse(raw);
      await withTenantDb(tenant, async (db) => {
        const rows = await db
          .select()
          .from(customers)
          .where(
            and(
              eq(customers.storeId, tenant.id),
              eq(customers.email, body.email.toLowerCase()),
              eq(customers.isGuest, false)
            )
          )
          .limit(1);

        if (rows.length > 0) {
          const rawToken = generateSecureToken(24);
          await db.insert(passwordResetTokens).values({
            storeId: tenant.id,
            userType: 'CUSTOMER',
            userId: rows[0].id,
            tokenHash: hashToken(rawToken),
            expiresAt: new Date(Date.now() + 30 * 60 * 1000),
          });
          const resetUrl = `${getEnv().appUrl}/account?resetToken=${rawToken}`;
          await enqueueJob({
            name: 'send-email',
            tenantId: tenant.id,
            to: rows[0].email!,
            subject: 'استرجاع كلمة المرور | Réinitialisation du mot de passe',
            html: `<p>اضغط على الرابط لتعيين كلمة مرور جديدة:</p><p><a href="${resetUrl}">${resetUrl}</a></p>`,
          });
        }
      });

      return NextResponse.json({
        ok: true,
        message: 'إذا كان البريد مسجلاً، فقد تم إرسال رابط استرجاع كلمة المرور.',
      });
    }

    const body = ConfirmResetSchema.parse(raw);
    const tokenHash = hashToken(body.token);
    const newHash = await hashPassword(body.newPassword);

    const updated = await withTenantDb(tenant, async (db) => {
      const rows = await db
        .select()
        .from(passwordResetTokens)
        .where(
          and(
            eq(passwordResetTokens.storeId, tenant.id),
            eq(passwordResetTokens.userType, 'CUSTOMER'),
            eq(passwordResetTokens.tokenHash, tokenHash),
            gt(passwordResetTokens.expiresAt, new Date()),
            isNull(passwordResetTokens.usedAt)
          )
        )
        .limit(1);

      if (rows.length === 0) return false;
      const rec = rows[0];

      await db
        .update(customers)
        .set({ passwordHash: newHash, updatedAt: new Date() })
        .where(and(eq(customers.storeId, tenant.id), eq(customers.id, rec.userId)));

      await db
        .update(passwordResetTokens)
        .set({ usedAt: new Date() })
        .where(and(eq(passwordResetTokens.storeId, tenant.id), eq(passwordResetTokens.id, rec.id)));

      return true;
    });

    if (!updated) {
      return NextResponse.json({ error: 'الرابط غير صالح أو منتهي الصلاحية.' }, { status: 400 });
    }

    return NextResponse.json({ ok: true });
  } catch (err) {
    return errorResponse(err);
  }
}

