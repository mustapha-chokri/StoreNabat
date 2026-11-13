import { NextRequest, NextResponse } from 'next/server';
import { and, desc, eq, gte, inArray, lte, sql } from 'drizzle-orm';
import { z } from 'zod';
import { orderItems, orders } from '@/db/schema/tenant';
import { getRequestTenant, withTenantDb } from '@/core/tenancy/context';
import { requireAdmin } from '@/core/auth/admin-session';
import { updateOrderStatus } from '@/services/orders';
import { assertSameOrigin, errorResponse } from '@/core/http/api';
import type { OrderStatus } from '@/db/schema/types';

export async function GET(req: NextRequest) {
  try {
    const tenant = await getRequestTenant();
    await requireAdmin(tenant, 'orders.read');

    const sp = req.nextUrl.searchParams;
    const q = (sp.get('q') || '').trim();
    const status = sp.get('status') || '';
    const paymentMethod = sp.get('paymentMethod') || '';
    const paymentStatus = sp.get('paymentStatus') || '';
    const from = sp.get('from');
    const to = sp.get('to');

    const data = await withTenantDb(tenant, async (db) => {
      const conds = [eq(orders.storeId, tenant.id)];
      if (status) conds.push(eq(orders.orderStatus, status as OrderStatus));
      if (paymentMethod) conds.push(eq(orders.paymentMethod, paymentMethod as never));
      if (paymentStatus) conds.push(eq(orders.paymentStatus, paymentStatus as never));
      if (from) conds.push(gte(orders.createdAt, new Date(from)));
      if (to) conds.push(lte(orders.createdAt, new Date(to)));
      if (q) {
        const pattern = `%${q}%`;
        conds.push(
          sql`(${orders.orderNumber} ILIKE ${pattern} OR ${orders.customerName} ILIKE ${pattern} OR ${orders.phone} ILIKE ${pattern} OR ${orders.cityName} ILIKE ${pattern})`
        );
      }

      const list = await db
        .select()
        .from(orders)
        .where(and(...conds))
        .orderBy(desc(orders.createdAt))
        .limit(200);

      const orderIds = list.map((o) => o.id);
      const items =
        orderIds.length > 0
          ? await db
              .select()
              .from(orderItems)
              .where(and(eq(orderItems.storeId, tenant.id), inArray(orderItems.orderId, orderIds)))
          : [];

      return list.map((o) => ({
        ...o,
        items: items.filter((i) => i.orderId === o.id),
      }));
    });

    return NextResponse.json({ orders: data });
  } catch (err) {
    return errorResponse(err);
  }
}

const BulkSchema = z.object({
  orderIds: z.array(z.string().uuid()).min(1),
  newStatus: z.enum([
    'NEW',
    'PENDING_WHATSAPP_CONFIRMATION',
    'CONFIRMED',
    'PROCESSING',
    'READY_FOR_SHIPPING',
    'SHIPPED',
    'OUT_FOR_DELIVERY',
    'DELIVERED',
    'CANCELLED',
    'RETURNED',
    'REFUNDED',
  ]),
  note: z.string().max(400).optional(),
});

export async function PATCH(req: NextRequest) {
  const csrfErr = assertSameOrigin(req);
  if (csrfErr) return csrfErr;

  try {
    const tenant = await getRequestTenant();
    const admin = await requireAdmin(tenant, 'orders.write');
    const body = BulkSchema.parse(await req.json());

    await withTenantDb(tenant, async (db) => {
      for (const orderId of body.orderIds) {
        await updateOrderStatus(db, {
          storeId: tenant.id,
          orderId,
          newStatus: body.newStatus,
          note: body.note || 'Bulk status update',
          actorEmail: admin.email,
        });
      }
    });

    return NextResponse.json({ ok: true, updatedCount: body.orderIds.length });
  } catch (err) {
    return errorResponse(err);
  }
}

