import { NextRequest, NextResponse } from 'next/server';
import { and, eq } from 'drizzle-orm';
import { z } from 'zod';
import { customers } from '@/db/schema/tenant';
import { getRequestTenant, withTenantDb } from '@/core/tenancy/context';
import { createCustomerSession } from '@/core/auth/customer-session';
import { hashPassword } from '@/core/crypto';
import { validateAndNormalizePhone } from '@/core/security/morocco';
import { assertSameOrigin, errorResponse } from '@/core/http/api';
import { checkRateLimit } from '@/core/security/rate-limit';
import { getClientIp } from '@/core/security/csrf';

const RegisterSchema = z.object({
  fullName: z.string().trim().min(2).max(160),
  email: z.string().trim().email(),
  phone: z.string().trim().min(8).max(40),
  password: z.string().min(8).max(128),
});

export async function POST(req: NextRequest) {
  const csrfErr = assertSameOrigin(req);
  if (csrfErr) return csrfErr;

  try {
    const ip = getClientIp(req);
    const rl = await checkRateLimit({ key: `cust-reg:${ip}`, limit: 10, windowSeconds: 600 });
    if (!rl.allowed) {
      return NextResponse.json({ error: 'Too many attempts' }, { status: 429 });
    }

    const body = RegisterSchema.parse(await req.json());
    const phoneCheck = validateAndNormalizePhone(body.phone, 'MOROCCO_SMART');
    if (!phoneCheck.valid) throw new Error('INVALID_PHONE_NUMBER');

    const tenant = await getRequestTenant();
    const passwordHash = await hashPassword(body.password);

    const customer = await withTenantDb(tenant, async (db) => {
      const emailLower = body.email.toLowerCase();
      const existingEmail = await db
        .select()
        .from(customers)
        .where(and(eq(customers.storeId, tenant.id), eq(customers.email, emailLower)))
        .limit(1);

      if (existingEmail.length > 0 && !existingEmail[0].isGuest) {
        throw new Error('البريد الإلكتروني مسجل مسبقاً.');
      }

      if (existingEmail.length > 0) {
        const [updated] = await db
          .update(customers)
          .set({
            fullName: body.fullName,
            phone: body.phone,
            normalizedPhone: phoneCheck.normalized,
            passwordHash,
            isGuest: false,
            updatedAt: new Date(),
          })
          .where(and(eq(customers.storeId, tenant.id), eq(customers.id, existingEmail[0].id)))
          .returning();
        return updated;
      }

      const [created] = await db
        .insert(customers)
        .values({
          storeId: tenant.id,
          fullName: body.fullName,
          email: emailLower,
          phone: body.phone,
          normalizedPhone: phoneCheck.normalized,
          whatsappNumber: phoneCheck.normalized,
          passwordHash,
          isGuest: false,
        })
        .returning();
      return created;
    });

    await createCustomerSession(tenant, customer.id);
    return NextResponse.json(
      {
        customer: {
          id: customer.id,
          fullName: customer.fullName,
          email: customer.email,
          phone: customer.phone,
        },
      },
      { status: 201 }
    );
  } catch (err) {
    return errorResponse(err);
  }
}

