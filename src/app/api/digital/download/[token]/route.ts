import { NextRequest, NextResponse } from 'next/server';
import { and, eq, sql } from 'drizzle-orm';
import { digitalDownloads, digitalFiles, orders } from '@/db/schema/tenant';
import { withRequestTenantDb } from '@/core/tenancy/context';
import { getStorageProvider } from '@/core/storage';

export async function GET(
  _req: NextRequest,
  context: { params: Promise<{ token: string }> }
) {
  try {
    const { token } = await context.params;
    if (!token || token.length < 16) {
      return NextResponse.json({ error: 'Invalid download token' }, { status: 400 });
    }

    const record = await withRequestTenantDb(async (db, tenant) => {
      const rows = await db
        .select({
          download: digitalDownloads,
          file: digitalFiles,
          order: orders,
        })
        .from(digitalDownloads)
        .innerJoin(digitalFiles, eq(digitalDownloads.digitalFileId, digitalFiles.id))
        .innerJoin(orders, eq(digitalDownloads.orderId, orders.id))
        .where(
          and(
            eq(digitalDownloads.storeId, tenant.id),
            eq(digitalDownloads.accessToken, token)
          )
        )
        .limit(1);

      if (rows.length === 0) return { error: 'Download link not found', status: 404 as const };

      const { download, file, order } = rows[0];

      if (order.paymentStatus !== 'PAID') {
        return {
          error: 'التحميل غير متاح حالياً. سيتم تفعيل رابط التحميل فور تأكيد واستلام الدفع بنجاح.',
          status: 402 as const,
        };
      }

      if (download.isRevoked) {
        return { error: 'Download permission has been revoked.', status: 403 as const };
      }
      if (download.expiresAt && new Date() > download.expiresAt) {
        return { error: 'Download link has expired.', status: 410 as const };
      }
      if (
        download.maxDownloads !== null &&
        download.downloadCount >= download.maxDownloads
      ) {
        return { error: 'Maximum download limit reached.', status: 403 as const };
      }

      await db
        .update(digitalDownloads)
        .set({
          downloadCount: sql`${digitalDownloads.downloadCount} + 1`,
          lastDownloadedAt: new Date(),
        })
        .where(and(eq(digitalDownloads.storeId, tenant.id), eq(digitalDownloads.id, download.id)));

      return { file, status: 200 as const };
    });

    if ('error' in record) {
      return NextResponse.json({ error: record.error }, { status: record.status });
    }

    const buffer = await getStorageProvider().readPrivateFile(record.file.storageKey);

    return new NextResponse(new Uint8Array(buffer), {
      status: 200,
      headers: {
        'Content-Type': record.file.mimeType,
        'Content-Disposition': `attachment; filename="${encodeURIComponent(record.file.fileName)}"`,
        'Cache-Control': 'private, no-store',
      },
    });
  } catch {
    return NextResponse.json({ error: 'Failed to stream digital file' }, { status: 500 });
  }
}

