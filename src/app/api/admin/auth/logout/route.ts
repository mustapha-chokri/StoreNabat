import { NextRequest, NextResponse } from 'next/server';
import { getRequestTenant } from '@/core/tenancy/context';
import { destroyAdminSession } from '@/core/auth/admin-session';
import { assertSameOrigin } from '@/core/http/api';

export async function POST(req: NextRequest) {
  const csrfErr = assertSameOrigin(req);
  if (csrfErr) return csrfErr;

  const tenant = await getRequestTenant();
  await destroyAdminSession(tenant);
  return NextResponse.json({ ok: true });
}

