import { NextRequest, NextResponse } from 'next/server';
import { desc, eq } from 'drizzle-orm';
import ExcelJS from 'exceljs';
import { orders } from '@/db/schema/tenant';
import { getRequestTenant, withTenantDb } from '@/core/tenancy/context';
import { requireAdmin } from '@/core/auth/admin-session';
import { errorResponse } from '@/core/http/api';

function csvCell(val: unknown): string {
  const s = String(val ?? '');
  return `"${s.replace(/"/g, '""')}"`;
}

export async function GET(req: NextRequest) {
  try {
    const tenant = await getRequestTenant();
    await requireAdmin(tenant, 'orders.export');

    const format = req.nextUrl.searchParams.get('format') === 'xlsx' ? 'xlsx' : 'csv';

    const list = await withTenantDb(tenant, async (db) =>
      db
        .select()
        .from(orders)
        .where(eq(orders.storeId, tenant.id))
        .orderBy(desc(orders.createdAt))
        .limit(5000)
    );

    if (format === 'xlsx') {
      const workbook = new ExcelJS.Workbook();
      const sheet = workbook.addWorksheet('Orders');
      sheet.columns = [
        { header: 'Order Number', key: 'orderNumber', width: 22 },
        { header: 'Date', key: 'createdAt', width: 22 },
        { header: 'Customer', key: 'customerName', width: 24 },
        { header: 'Phone', key: 'phone', width: 18 },
        { header: 'City', key: 'cityName', width: 18 },
        { header: 'Address', key: 'shippingAddress', width: 32 },
        { header: 'Payment Method', key: 'paymentMethod', width: 14 },
        { header: 'Payment Status', key: 'paymentStatus', width: 14 },
        { header: 'Order Status', key: 'orderStatus', width: 24 },
        { header: 'Total (MAD)', key: 'totalAmount', width: 14 },
        { header: 'Tracking Number', key: 'trackingNumber', width: 20 },
      ];

      for (const o of list) {
        sheet.addRow({
          orderNumber: o.orderNumber,
          createdAt: o.createdAt.toISOString(),
          customerName: o.customerName,
          phone: o.phone,
          cityName: o.cityName,
          shippingAddress: o.shippingAddress,
          paymentMethod: o.paymentMethod,
          paymentStatus: o.paymentStatus,
          orderStatus: o.orderStatus,
          totalAmount: Number(o.totalAmount),
          trackingNumber: o.trackingNumber || '',
        });
      }

      const buffer = await workbook.xlsx.writeBuffer();
      return new NextResponse(new Uint8Array(buffer), {
        status: 200,
        headers: {
          'Content-Type':
            'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
          'Content-Disposition': 'attachment; filename="orders-export.xlsx"',
        },
      });
    }

    const headers = [
      'Order Number',
      'Date',
      'Customer',
      'Phone',
      'City',
      'Address',
      'Payment Method',
      'Payment Status',
      'Order Status',
      'Total',
      'Currency',
      'Tracking Number',
    ];
    const lines = [headers.map(csvCell).join(',')];
    for (const o of list) {
      lines.push(
        [
          o.orderNumber,
          o.createdAt.toISOString(),
          o.customerName,
          o.phone,
          o.cityName,
          o.shippingAddress,
          o.paymentMethod,
          o.paymentStatus,
          o.orderStatus,
          o.totalAmount,
          o.currency,
          o.trackingNumber || '',
        ]
          .map(csvCell)
          .join(',')
      );
    }

    // UTF-8 BOM for clean Arabic Excel CSV opening
    const csvWithBom = `\uFEFF${lines.join('\r\n')}`;
    return new NextResponse(csvWithBom, {
      status: 200,
      headers: {
        'Content-Type': 'text/csv; charset=utf-8',
        'Content-Disposition': 'attachment; filename="orders-export.csv"',
      },
    });
  } catch (err) {
    return errorResponse(err);
  }
}

