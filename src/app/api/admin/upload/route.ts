import { NextRequest, NextResponse } from 'next/server';
import { getRequestTenant } from '@/core/tenancy/context';
import { requireAdmin } from '@/core/auth/admin-session';
import { getStorageProvider } from '@/core/storage';
import { assertSameOrigin, errorResponse } from '@/core/http/api';

export async function POST(req: NextRequest) {
  const csrfErr = assertSameOrigin(req);
  if (csrfErr) return csrfErr;

  try {
    const tenant = await getRequestTenant();
    await requireAdmin(tenant, 'products.write');

    const formData = await req.formData();
    const file = formData.get('file') as File | null;
    const visibility = (formData.get('visibility') as string) === 'private' ? 'private' : 'public';

    if (!file) {
      return NextResponse.json({ error: 'No file uploaded' }, { status: 400 });
    }

    const maxBytes = visibility === 'private' ? 50 * 1024 * 1024 : 15 * 1024 * 1024;
    if (file.size > maxBytes) {
      return NextResponse.json({ error: 'File exceeds allowed size limit.' }, { status: 400 });
    }

    const buffer = Buffer.from(await file.arrayBuffer());
    const storage = getStorageProvider();

    const stored =
      visibility === 'private'
        ? await storage.savePrivateDigitalFile({
            tenantId: tenant.id,
            buffer,
            originalName: file.name,
            mimeType: file.type,
          })
        : await storage.savePublicMedia({
            tenantId: tenant.id,
            buffer,
            originalName: file.name,
            mimeType: file.type,
          });

    const result = {
      ...stored,
      url: stored.url || stored.publicUrl || `/api/media/${stored.storageKey}`,
      publicUrl: stored.publicUrl || stored.url || `/api/media/${stored.storageKey}`,
      key: stored.key || stored.storageKey,
      storageKey: stored.storageKey || stored.key,
    };

    return NextResponse.json(result, { status: 201 });
  } catch (err) {
    return errorResponse(err);
  }
}

