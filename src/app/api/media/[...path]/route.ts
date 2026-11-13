import path from 'node:path';
import { NextRequest, NextResponse } from 'next/server';
import { getStorageProvider } from '@/core/storage';

const MIME_BY_EXT: Record<string, string> = {
  '.webp': 'image/webp',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.gif': 'image/gif',
  '.mp4': 'video/mp4',
  '.webm': 'video/webm',
};

export async function GET(
  _req: NextRequest,
  context: { params: Promise<{ path: string[] }> }
) {
  try {
    const segments = (await context.params).path;
    if (!segments || segments.length === 0) {
      return NextResponse.json({ error: 'Not found' }, { status: 404 });
    }
    const storageKey = segments.join('/');
    if (storageKey.includes('..')) {
      return NextResponse.json({ error: 'Invalid path' }, { status: 400 });
    }

    const storage = getStorageProvider();
    const buffer = await storage.readPublicFile(storageKey);
    const ext = path.extname(storageKey).toLowerCase();
    const contentType = MIME_BY_EXT[ext] || 'application/octet-stream';

    return new NextResponse(new Uint8Array(buffer), {
      status: 200,
      headers: {
        'Content-Type': contentType,
        'Cache-Control': 'public, max-age=31536000, immutable',
      },
    });
  } catch {
    return NextResponse.json({ error: 'Media not found' }, { status: 404 });
  }
}

