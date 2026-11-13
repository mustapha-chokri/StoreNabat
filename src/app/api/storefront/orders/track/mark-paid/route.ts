import { NextRequest, NextResponse } from 'next/server';
import { and, eq } from 'drizzle-orm';
import { digitalDownloads, digitalFiles, orders } from '@/db/schema/tenant';
import { withRequestTenantDb } from '@/core/tenancy/context';
import { updateOrderStatus } from '@/services/orders';
import { assertSameOrigin } from '@/core/http/api';
import { validateAndNormalizePhone } from '@/core/security/morocco';

export async function POST(req: NextRequest) {
  const csrfErr = assertSameOrigin(req);
  if (csrfErr) return csrfErr;

  try {
    const { orderNumber, phone } = (await req.json()) as {
      orderNumber?: string;
      phone?: string;
    };

    if (!orderNumber || typeof orderNumber !== 'string') {
      return NextResponse.json({ error: 'orderNumber is required' }, { status: 400 });
    }

    const phoneParsed = phone ? validateAndNormalizePhone(phone, 'MOROCCO_SMART') : null;

    const res = await withRequestTenantDb(async (db, tenant) => {
      const [order] = await db
        .select()
        .from(orders)
        .where(and(eq(orders.storeId, tenant.id), eq(orders.orderNumber, orderNumber.trim())))
        .limit(1);

      if (!order) {
        return { error: 'Order not found', status: 404 as const };
      }

      if (phoneParsed && phoneParsed.valid && order.normalizedPhone !== phoneParsed.normalized) {
        return { error: 'Phone does not match order record', status: 403 as const };
      }

      // Update payment status to PAID (automatically triggers provisionDigitalDownloadsForOrder)
      await updateOrderStatus(db, {
        storeId: tenant.id,
        orderId: order.id,
        newStatus: order.orderStatus === 'NEW' ? 'CONFIRMED' : order.orderStatus,
        paymentStatus: 'PAID',
        note: 'Payment confirmed and verified via tracking / storefront',
        actorEmail: 'track-order-customer',
      });

      // Fetch provisioned downloads
      const downloads = await db
        .select({
          accessToken: digitalDownloads.accessToken,
          downloadCount: digitalDownloads.downloadCount,
          maxDownloads: digitalDownloads.maxDownloads,
          expiresAt: digitalDownloads.expiresAt,
          fileName: digitalFiles.fileName,
        })
        .from(digitalDownloads)
        .innerJoin(digitalFiles, eq(digitalDownloads.digitalFileId, digitalFiles.id))
        .where(
          and(eq(digitalDownloads.storeId, tenant.id), eq(digitalDownloads.orderId, order.id))
        );

      return {
        success: true,
        paymentStatus: 'PAID',
        downloads,
      };
    });

    if ('error' in res) {
      return NextResponse.json({ error: res.error }, { status: res.status });
    }

    return NextResponse.json(res);
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : 'Failed to mark order as paid' },
      { status: 500 }
    );
  }
}
