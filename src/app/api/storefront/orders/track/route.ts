import { NextRequest, NextResponse } from 'next/server';
import { and, desc, eq } from 'drizzle-orm';
import { digitalDownloads, digitalFiles, orderItems, orders, orderStatusHistory } from '@/db/schema/tenant';
import { withRequestTenantDb } from '@/core/tenancy/context';
import { validateAndNormalizePhone } from '@/core/security/morocco';

export async function GET(req: NextRequest) {
  try {
    const orderNumber = (req.nextUrl.searchParams.get('orderNumber') || '').trim();
    const phone = (req.nextUrl.searchParams.get('phone') || '').trim();

    if (!orderNumber) {
      return NextResponse.json({ error: 'orderNumber is required' }, { status: 400 });
    }

    const phoneParsed = phone ? validateAndNormalizePhone(phone, 'MOROCCO_SMART') : null;

    const data = await withRequestTenantDb(async (db, tenant) => {
      const rows = await db
        .select()
        .from(orders)
        .where(and(eq(orders.storeId, tenant.id), eq(orders.orderNumber, orderNumber)))
        .limit(1);

      if (rows.length === 0) return null;
      const order = rows[0];

      // Require matching normalized phone if provided via public lookup
      if (phoneParsed && phoneParsed.valid && order.normalizedPhone !== phoneParsed.normalized) {
        return null;
      }

      const items = await db
        .select()
        .from(orderItems)
        .where(and(eq(orderItems.storeId, tenant.id), eq(orderItems.orderId, order.id)));

      const history = await db
        .select()
        .from(orderStatusHistory)
        .where(
          and(eq(orderStatusHistory.storeId, tenant.id), eq(orderStatusHistory.orderId, order.id))
        )
        .orderBy(desc(orderStatusHistory.createdAt));

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

      const isPaid = order.paymentStatus === 'PAID';
      const hasDigitalItems = items.some((i) => i.productType === 'DIGITAL');

      return {
        order: {
          orderNumber: order.orderNumber,
          orderStatus: order.orderStatus,
          paymentMethod: order.paymentMethod,
          paymentStatus: order.paymentStatus,
          customerName: order.customerName,
          cityName: order.cityName,
          subtotal: order.subtotal,
          discountAmount: order.discountAmount,
          shippingFee: order.shippingFee,
          codFee: order.codFee,
          totalAmount: order.totalAmount,
          currency: order.currency,
          trackingNumber: order.trackingNumber,
          createdAt: order.createdAt,
        },
        items,
        history,
        downloads: phone && isPaid ? downloads : [],
        digitalPendingPayment: !isPaid && hasDigitalItems,
      };
    });

    if (!data) {
      return NextResponse.json({ error: 'Order not found' }, { status: 404 });
    }
    return NextResponse.json(data);
  } catch {
    return NextResponse.json({ error: 'Tracking lookup failed' }, { status: 500 });
  }
}

