import { NextRequest, NextResponse } from 'next/server';
import { and, desc, eq, sql } from 'drizzle-orm';
import { z } from 'zod';
import { auditLogs, customers, orders } from '@/db/schema/tenant';
import { getRequestTenant, withTenantDb } from '@/core/tenancy/context';
import { requireAdmin } from '@/core/auth/admin-session';
import { assertSameOrigin, errorResponse } from '@/core/http/api';

export async function GET(req: NextRequest) {
  try {
    const tenant = await getRequestTenant();
    await requireAdmin(tenant, 'customers.read');
    const q = (req.nextUrl.searchParams.get('q') || '').trim();
    const customerId = req.nextUrl.searchParams.get('id');

    const data = await withTenantDb(tenant, async (db) => {
      if (customerId) {
        const [customer] = await db
          .select()
          .from(customers)
          .where(and(eq(customers.storeId, tenant.id), eq(customers.id, customerId)))
          .limit(1);
        const customerOrders = customer
          ? await db
              .select()
              .from(orders)
              .where(and(eq(orders.storeId, tenant.id), eq(orders.customerId, customer.id)))
              .orderBy(desc(orders.createdAt))
          : [];
        return { customer: customer || null, orders: customerOrders };
      }

      const conds = [eq(customers.storeId, tenant.id)];
      if (q) {
        const pattern = `%${q}%`;
        conds.push(
          sql`(${customers.fullName} ILIKE ${pattern} OR ${customers.phone} ILIKE ${pattern} OR ${customers.email} ILIKE ${pattern})`
        );
      }

      const list = await db
        .select()
        .from(customers)
        .where(and(...conds))
        .orderBy(desc(customers.updatedAt))
        .limit(200);

      // Compute duplicate phone counts across orders
      const dupRes = await db.execute(
        sql`SELECT normalized_phone, COUNT(*)::int AS cnt FROM customers WHERE store_id = ${tenant.id} GROUP BY normalized_phone HAVING COUNT(*) > 1`
      );
      const duplicatePhones = new Set(
        dupRes.rows.map((r) => String((r as { normalized_phone: string }).normalized_phone))
      );

      return {
        customers: list.map((c) => ({
          ...c,
          passwordHash: undefined,
          hasDuplicatePhone: duplicatePhones.has(c.normalizedPhone),
        })),
      };
    });

    return NextResponse.json(data);
  } catch (err) {
    return errorResponse(err);
  }
}

const UpdateCustomerSchema = z.object({
  id: z.string().uuid(),
  isBlacklisted: z.boolean().optional(),
  blacklistReason: z.string().max(400).nullable().optional(),
  notes: z.string().max(2000).nullable().optional(),
  segmentTags: z.array(z.string()).optional(),
});

export async function PATCH(req: NextRequest) {
  const csrfErr = assertSameOrigin(req);
  if (csrfErr) return csrfErr;

  try {
    const tenant = await getRequestTenant();
    const admin = await requireAdmin(tenant, 'customers.write');
    const body = UpdateCustomerSchema.parse(await req.json());

    const updated = await withTenantDb(tenant, async (db) => {
      const [row] = await db
        .update(customers)
        .set({
          ...(body.isBlacklisted !== undefined ? { isBlacklisted: body.isBlacklisted } : {}),
          ...(body.blacklistReason !== undefined ? { blacklistReason: body.blacklistReason } : {}),
          ...(body.notes !== undefined ? { notes: body.notes } : {}),
          ...(body.segmentTags !== undefined ? { segmentTags: body.segmentTags } : {}),
          updatedAt: new Date(),
        })
        .where(and(eq(customers.storeId, tenant.id), eq(customers.id, body.id)))
        .returning();

      await db.insert(auditLogs).values({
        storeId: tenant.id,
        adminUserId: admin.id,
        actorEmail: admin.email,
        action: body.isBlacklisted !== undefined ? 'customer.blacklist_updated' : 'customer.updated',
        entityType: 'customer',
        entityId: body.id,
        metadata: { isBlacklisted: body.isBlacklisted },
      });

      return row;
    });

    return NextResponse.json({ customer: updated });
  } catch (err) {
    return errorResponse(err);
  }
}

