import { NextResponse } from 'next/server';
import { getRequestTenant } from '@/core/tenancy/context';
import { getAuthenticatedAdmin } from '@/core/auth/admin-session';

export async function GET() {
  try {
    const tenant = await getRequestTenant();
    const admin = await getAuthenticatedAdmin(tenant);
    if (!admin) {
      return NextResponse.json({ admin: null }, { status: 401 });
    }
    return NextResponse.json({ admin });
  } catch {
    return NextResponse.json({ admin: null }, { status: 401 });
  }
}

