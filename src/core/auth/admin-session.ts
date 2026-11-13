import { cookies } from 'next/headers';
import { and, eq, gt } from 'drizzle-orm';
import { adminSessions, adminUsers } from '@/db/schema/tenant';
import { withTenantDb } from '@/core/tenancy/context';
import type { ResolvedTenant } from '@/core/tenancy/types';
import {
  generateSecureToken,
  hashToken,
  signHmac,
  verifyHmac,
} from '@/core/crypto';
import { getEnv } from '@/core/env';
import type { AdminRole } from '@/db/schema/types';
import { hasPermission, type Permission } from './rbac';

export const ADMIN_SESSION_COOKIE = 'nabat_admin_session';
const SESSION_TTL_MS = 7 * 24 * 60 * 60 * 1000; // 7 days

export interface AuthenticatedAdmin {
  id: string;
  storeId: string;
  email: string;
  fullName: string;
  role: AdminRole;
  permissions: string[];
  preferredLocale: string;
  sessionId: string;
}

function packSessionCookie(tenantId: string, rawToken: string): string {
  const payload = `${tenantId}.${rawToken}`;
  const sig = signHmac(payload);
  return `${payload}.${sig}`;
}

function unpackSessionCookie(cookieVal: string): { tenantId: string; rawToken: string } | null {
  const parts = cookieVal.split('.');
  if (parts.length !== 3) return null;
  const [tenantId, rawToken, sig] = parts;
  if (!tenantId || !rawToken || !sig) return null;
  if (!verifyHmac(`${tenantId}.${rawToken}`, sig)) return null;
  return { tenantId, rawToken };
}

export async function createAdminSession(params: {
  tenant: ResolvedTenant;
  adminUserId: string;
  ipAddress?: string;
  userAgent?: string;
}): Promise<string> {
  const rawToken = generateSecureToken(32);
  const tokenHash = hashToken(rawToken);
  const expiresAt = new Date(Date.now() + SESSION_TTL_MS);

  await withTenantDb(params.tenant, async (db) => {
    await db.insert(adminSessions).values({
      storeId: params.tenant.id,
      adminUserId: params.adminUserId,
      tokenHash,
      ipAddress: params.ipAddress,
      userAgent: params.userAgent,
      expiresAt,
    });
    await db
      .update(adminUsers)
      .set({ lastLoginAt: new Date() })
      .where(and(eq(adminUsers.storeId, params.tenant.id), eq(adminUsers.id, params.adminUserId)));
  });

  const cookieValue = packSessionCookie(params.tenant.id, rawToken);
  const cookieStore = await cookies();
  cookieStore.set(ADMIN_SESSION_COOKIE, cookieValue, {
    httpOnly: true,
    sameSite: 'lax',
    secure: getEnv().nodeEnv === 'production' && getEnv().appUrl.startsWith('https://'),
    path: '/',
    expires: expiresAt,
  });

  return cookieValue;
}

export async function getAuthenticatedAdmin(
  tenant: ResolvedTenant
): Promise<AuthenticatedAdmin | null> {
  const cookieStore = await cookies();
  const cookieVal = cookieStore.get(ADMIN_SESSION_COOKIE)?.value;
  if (!cookieVal) return null;

  const parsed = unpackSessionCookie(cookieVal);
  if (!parsed || parsed.tenantId !== tenant.id) return null;

  const tokenHash = hashToken(parsed.rawToken);
  const now = new Date();

  return withTenantDb(tenant, async (db) => {
    const rows = await db
      .select({
        sessionId: adminSessions.id,
        user: adminUsers,
      })
      .from(adminSessions)
      .innerJoin(adminUsers, eq(adminSessions.adminUserId, adminUsers.id))
      .where(
        and(
          eq(adminSessions.storeId, tenant.id),
          eq(adminSessions.tokenHash, tokenHash),
          gt(adminSessions.expiresAt, now),
          eq(adminUsers.isActive, true)
        )
      )
      .limit(1);

    if (rows.length === 0) return null;
    const { sessionId, user } = rows[0];
    return {
      id: user.id,
      storeId: user.storeId,
      email: user.email,
      fullName: user.fullName,
      role: user.role,
      permissions: user.permissions,
      preferredLocale: user.preferredLocale,
      sessionId,
    };
  });
}

export async function requireAdmin(
  tenant: ResolvedTenant,
  requiredPermission?: Permission
): Promise<AuthenticatedAdmin> {
  const admin = await getAuthenticatedAdmin(tenant);
  if (!admin) {
    throw new AdminAuthError('Unauthorized', 401);
  }
  if (requiredPermission && !hasPermission(admin.role, admin.permissions, requiredPermission)) {
    throw new AdminAuthError('Forbidden: insufficient permissions', 403);
  }
  return admin;
}

export async function destroyAdminSession(tenant: ResolvedTenant): Promise<void> {
  const cookieStore = await cookies();
  const cookieVal = cookieStore.get(ADMIN_SESSION_COOKIE)?.value;
  if (cookieVal) {
    const parsed = unpackSessionCookie(cookieVal);
    if (parsed && parsed.tenantId === tenant.id) {
      const tokenHash = hashToken(parsed.rawToken);
      await withTenantDb(tenant, async (db) => {
        await db
          .delete(adminSessions)
          .where(and(eq(adminSessions.storeId, tenant.id), eq(adminSessions.tokenHash, tokenHash)));
      }).catch(() => undefined);
    }
  }
  cookieStore.delete(ADMIN_SESSION_COOKIE);
}

export class AdminAuthError extends Error {
  readonly statusCode: number;
  constructor(message: string, statusCode: number) {
    super(message);
    this.statusCode = statusCode;
  }
}

