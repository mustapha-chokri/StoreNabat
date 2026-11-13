import { cookies } from 'next/headers';
import { and, eq, gt } from 'drizzle-orm';
import { customers, customerSessions } from '@/db/schema/tenant';
import { withTenantDb } from '@/core/tenancy/context';
import type { ResolvedTenant } from '@/core/tenancy/types';
import { generateSecureToken, hashToken, signHmac, verifyHmac } from '@/core/crypto';
import { getEnv } from '@/core/env';

export const CUSTOMER_SESSION_COOKIE = 'nabat_customer_session';
export const CART_TOKEN_COOKIE = 'nabat_cart_token';
const CUSTOMER_TTL_MS = 30 * 24 * 60 * 60 * 1000;

export interface AuthenticatedCustomer {
  id: string;
  storeId: string;
  fullName: string;
  email: string | null;
  phone: string;
  whatsappNumber: string | null;
}

function packCustomerCookie(tenantId: string, rawToken: string): string {
  const payload = `${tenantId}.${rawToken}`;
  return `${payload}.${signHmac(payload)}`;
}

function unpackCustomerCookie(cookieVal: string): { tenantId: string; rawToken: string } | null {
  const parts = cookieVal.split('.');
  if (parts.length !== 3) return null;
  const [tenantId, rawToken, sig] = parts;
  if (!tenantId || !rawToken || !sig) return null;
  if (!verifyHmac(`${tenantId}.${rawToken}`, sig)) return null;
  return { tenantId, rawToken };
}

export async function createCustomerSession(
  tenant: ResolvedTenant,
  customerId: string
): Promise<void> {
  const rawToken = generateSecureToken(32);
  const tokenHash = hashToken(rawToken);
  const expiresAt = new Date(Date.now() + CUSTOMER_TTL_MS);

  await withTenantDb(tenant, async (db) => {
    await db.insert(customerSessions).values({
      storeId: tenant.id,
      customerId,
      tokenHash,
      expiresAt,
    });
  });

  const cookieStore = await cookies();
  cookieStore.set(CUSTOMER_SESSION_COOKIE, packCustomerCookie(tenant.id, rawToken), {
    httpOnly: true,
    sameSite: 'lax',
    secure: getEnv().nodeEnv === 'production' && getEnv().appUrl.startsWith('https://'),
    path: '/',
    expires: expiresAt,
  });
}

export async function getAuthenticatedCustomer(
  tenant: ResolvedTenant
): Promise<AuthenticatedCustomer | null> {
  const cookieStore = await cookies();
  const val = cookieStore.get(CUSTOMER_SESSION_COOKIE)?.value;
  if (!val) return null;

  const parsed = unpackCustomerCookie(val);
  if (!parsed || parsed.tenantId !== tenant.id) return null;

  const tokenHash = hashToken(parsed.rawToken);
  return withTenantDb(tenant, async (db) => {
    const rows = await db
      .select({ customer: customers })
      .from(customerSessions)
      .innerJoin(customers, eq(customerSessions.customerId, customers.id))
      .where(
        and(
          eq(customerSessions.storeId, tenant.id),
          eq(customerSessions.tokenHash, tokenHash),
          gt(customerSessions.expiresAt, new Date()),
          eq(customers.isBlacklisted, false)
        )
      )
      .limit(1);

    if (rows.length === 0) return null;
    const c = rows[0].customer;
    return {
      id: c.id,
      storeId: c.storeId,
      fullName: c.fullName,
      email: c.email,
      phone: c.phone,
      whatsappNumber: c.whatsappNumber,
    };
  });
}

export async function destroyCustomerSession(tenant: ResolvedTenant): Promise<void> {
  const cookieStore = await cookies();
  const val = cookieStore.get(CUSTOMER_SESSION_COOKIE)?.value;
  if (val) {
    const parsed = unpackCustomerCookie(val);
    if (parsed && parsed.tenantId === tenant.id) {
      const tokenHash = hashToken(parsed.rawToken);
      await withTenantDb(tenant, async (db) => {
        await db
          .delete(customerSessions)
          .where(
            and(eq(customerSessions.storeId, tenant.id), eq(customerSessions.tokenHash, tokenHash))
          );
      }).catch(() => undefined);
    }
  }
  cookieStore.delete(CUSTOMER_SESSION_COOKIE);
}

export async function getOrCreateCartToken(): Promise<string> {
  const cookieStore = await cookies();
  const existing = cookieStore.get(CART_TOKEN_COOKIE)?.value;
  if (existing && existing.length >= 16) {
    return existing;
  }
  const fresh = generateSecureToken(24);
  cookieStore.set(CART_TOKEN_COOKIE, fresh, {
    httpOnly: true,
    sameSite: 'lax',
    secure: getEnv().nodeEnv === 'production' && getEnv().appUrl.startsWith('https://'),
    path: '/',
    maxAge: 60 * 60 * 24 * 30,
  });
  return fresh;
}

