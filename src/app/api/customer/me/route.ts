import { NextResponse } from 'next/server';
import { desc, eq } from 'drizzle-orm';
import {
  customerAddresses,
  digitalDownloads,
  digitalFiles,
  orders,
} from '@/db/schema/tenant';
import { getRequestTenant, withTenantDb } from '@/core/tenancy/context';
import { getAuthenticatedCustomer } from '@/core/auth/customer-session';

export async function GET() {
  try {
    const tenant = await getRequestTenant();
    const customer = await getAuthenticatedCustomer(tenant);
    if (!customer) {
      return NextResponse.json({ customer: null }, { status: 200 });
    }

    const details = await withTenantDb(tenant, async (db) => {
      const addresses = await db
        .select()
        .from(customerAddresses)
        .where(eq(customerAddresses.customerId, customer.id));

      const customerOrders = await db
        .select()
        .from(orders)
        .where(eq(orders.customerId, customer.id))
        .orderBy(desc(orders.createdAt))
        .limit(50);

      const downloads = await db
        .select({
          id: digitalDownloads.id,
          accessToken: digitalDownloads.accessToken,
          downloadCount: digitalDownloads.downloadCount,
          maxDownloads: digitalDownloads.maxDownloads,
          expiresAt: digitalDownloads.expiresAt,
          isRevoked: digitalDownloads.isRevoked,
          fileName: digitalFiles.fileName,
          fileSizeBytes: digitalFiles.fileSizeBytes,
          orderId: digitalDownloads.orderId,
          orderNumber: orders.orderNumber,
          orderPaymentStatus: orders.paymentStatus,
        })
        .from(digitalDownloads)
        .innerJoin(digitalFiles, eq(digitalDownloads.digitalFileId, digitalFiles.id))
        .innerJoin(orders, eq(digitalDownloads.orderId, orders.id))
        .where(eq(digitalDownloads.customerId, customer.id));

      return { addresses, orders: customerOrders, downloads };
    });

    return NextResponse.json({ customer, ...details });
  } catch {
    return NextResponse.json({ error: 'Failed to load profile' }, { status: 500 });
  }
}

