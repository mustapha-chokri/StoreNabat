import { NextRequest, NextResponse } from 'next/server';
import { and, eq } from 'drizzle-orm';
import { z } from 'zod';
import { customers } from '@/db/schema/tenant';
import { getRequestTenant, withTenantDb } from '@/core/tenancy/context';
import { createCustomerSession } from '@/core/auth/customer-session';
import { verifyPassword } from '@/core/crypto';
import { assertSameOrigin, errorResponse } from '@/core/http/api';
import { checkRateLimit } from '@/core/security/rate-limit';
import { getClientIp } from '@/core/security/csrf';

const LoginSchema = z.object({
  email: z.string().trim().email(),
  password: z.string().min(1),
});

export async function POST(req: NextRequest) {
  const csrfErr = assertSameOrigin(req);
  if (csrfErr) return csrfErr;

  try {
    const ip = getClientIp(req);
    const rl = await checkRateLimit({ key: `cust-login:${ip}`, limit: 15, windowSeconds: 300 });
    if (!rl.allowed) {
      return NextResponse.json({ error: 'Too many login attempts' }, { status: 429 });
    }

    const body = LoginSchema.parse(await req.json());
    const tenant = await getRequestTenant();

    const customer = await withTenantDb(tenant, async (db) => {
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

      if (rows.length === 0 || !rows[0].passwordHash) {
        return null;
      }
      const ok = await verifyPassword(body.password, rows[0].passwordHash);
      if (!ok) return null;
      if (rows[0].isBlacklisted) throw new Error('CUSTOMER_BLACKLISTED');
      return rows[0];
    });

    if (!customer) {
      return NextResponse.json({ error: 'البريد الإلكتروني أو كلمة المرور غير صحيحة.' }, { status: 401 });
    }

    await createCustomerSession(tenant, customer.id);
    return NextResponse.json({
      customer: {
        id: customer.id,
        fullName: customer.fullName,
        email: customer.email,
        phone: customer.phone,
      },
    });
  } catch (err) {
    return errorResponse(err);
  }
}

