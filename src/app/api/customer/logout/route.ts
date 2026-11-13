import { NextRequest, NextResponse } from 'next/server';
import { getRequestTenant } from '@/core/tenancy/context';
import { destroyCustomerSession } from '@/core/auth/customer-session';
import { assertSameOrigin } from '@/core/http/api';

export async function POST(req: NextRequest) {
  const csrfErr = assertSameOrigin(req);
  if (csrfErr) return csrfErr;
  const tenant = await getRequestTenant();
  await destroyCustomerSession(tenant);
  return NextResponse.json({ ok: true });
}

