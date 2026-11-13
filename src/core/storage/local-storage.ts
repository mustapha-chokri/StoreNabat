import crypto from 'node:crypto';
import fs from 'node:fs/promises';
import path from 'node:path';
import sharp from 'sharp';
import { getEnv } from '@/core/env';
import type { StorageProvider, StoredFileResult } from './types';

const ALLOWED_IMAGE_MIMES = new Set([
  'image/jpeg',
  'image/png',
  'image/webp',
  'image/gif',
]);

const ALLOWED_VIDEO_MIMES = new Set(['video/mp4', 'video/webm']);

const ALLOWED_DIGITAL_MIMES = new Set([
  'application/pdf',
  'application/zip',
  'application/x-zip-compressed',
  'audio/mpeg',
  'video/mp4',
  'image/png',
  'image/jpeg',
  'text/plain',
]);

function detectMagicMime(buf: Buffer, declaredMime: string): string | null {
  if (buf.length < 4) return null;
  // JPEG
  if (buf[0] === 0xff && buf[1] === 0xd8 && buf[2] === 0xff) return 'image/jpeg';
  // PNG
  if (buf[0] === 0x89 && buf[1] === 0x50 && buf[2] === 0x4e && buf[3] === 0x47) return 'image/png';
  // GIF
  if (buf.subarray(0, 3).toString('ascii') === 'GIF') return 'image/gif';
  // WEBP (RIFF....WEBP)
  if (
    buf.length >= 12 &&
    buf.subarray(0, 4).toString('ascii') === 'RIFF' &&
    buf.subarray(8, 12).toString('ascii') === 'WEBP'
  ) {
    return 'image/webp';
  }
  // PDF
  if (buf.subarray(0, 4).toString('ascii') === '%PDF') return 'application/pdf';
  // ZIP
  if (buf[0] === 0x50 && buf[1] === 0x4b && (buf[2] === 0x03 || buf[2] === 0x05)) {
    return 'application/zip';
  }
  // MP4 / ftyp
  if (buf.length >= 8 && buf.subarray(4, 8).toString('ascii') === 'ftyp') return 'video/mp4';
  // WebM (EBML)
  if (buf[0] === 0x1a && buf[1] === 0x45 && buf[2] === 0xdf && buf[3] === 0xa3) return 'video/webm';
  // MP3 (ID3 or frame sync)
  if (
    buf.subarray(0, 3).toString('ascii') === 'ID3' ||
    (buf[0] === 0xff && (buf[1] & 0xe0) === 0xe0)
  ) {
    return 'audio/mpeg';
  }
  if (declaredMime === 'text/plain') return 'text/plain';
  return null;
}

function safeResolve(rootDir: string, relativeKey: string): string {
  const normalized = path.normalize(relativeKey).replace(/^(\.\.(\/|\\|$))+/, '');
  const full = path.resolve(rootDir, normalized);
  if (!full.startsWith(path.resolve(rootDir))) {
    throw new Error('Unsafe storage path detected.');
  }
  return full;
}

export class LocalStorageProvider implements StorageProvider {
  private readonly publicRoot: string;
  private readonly privateRoot: string;

  constructor() {
    const root = path.resolve(process.cwd(), getEnv().storageLocalRoot);
    this.publicRoot = path.join(root, 'uploads');
    this.privateRoot = path.join(root, 'private-digital');
  }

  async savePublicMedia(params: {
    tenantId: string;
    buffer: Buffer;
    originalName: string;
    mimeType: string;
    optimizeImage?: boolean;
  }): Promise<StoredFileResult> {
    const detected = detectMagicMime(params.buffer, params.mimeType);
    if (!detected || (!ALLOWED_IMAGE_MIMES.has(detected) && !ALLOWED_VIDEO_MIMES.has(detected))) {
      throw new Error('Unsupported or invalid media file signature.');
    }

    let finalBuffer = params.buffer;
    let finalMime = detected;
    let ext = detected.split('/')[1] || 'bin';

    if (ALLOWED_IMAGE_MIMES.has(detected) && detected !== 'image/gif' && params.optimizeImage !== false) {
      finalBuffer = await sharp(params.buffer)
        .rotate()
        .resize({ width: 1600, height: 1600, fit: 'inside', withoutEnlargement: true })
        .webp({ quality: 84 })
        .toBuffer();
      finalMime = 'image/webp';
      ext = 'webp';
    }

    const storageKey = path.posix.join(
      params.tenantId,
      `${Date.now()}-${crypto.randomBytes(8).toString('hex')}.${ext}`
    );
    const targetPath = safeResolve(this.publicRoot, storageKey);
    await fs.mkdir(path.dirname(targetPath), { recursive: true });
    await fs.writeFile(targetPath, finalBuffer);

    return {
      storageKey,
      key: storageKey,
      publicUrl: `/api/media/${storageKey}`,
      url: `/api/media/${storageKey}`,
      mimeType: finalMime,
      sizeBytes: finalBuffer.byteLength,
      originalName: params.originalName,
    };
  }

  async savePrivateDigitalFile(params: {
    tenantId: string;
    buffer: Buffer;
    originalName: string;
    mimeType: string;
  }): Promise<StoredFileResult> {
    const detected = detectMagicMime(params.buffer, params.mimeType);
    if (!detected || !ALLOWED_DIGITAL_MIMES.has(detected)) {
      throw new Error('Unsupported or unsafe digital file format.');
    }

    const safeExt = path.extname(params.originalName).replace(/[^a-zA-Z0-9.]/g, '') || '.bin';
    const storageKey = path.posix.join(
      params.tenantId,
      `${Date.now()}-${crypto.randomBytes(12).toString('hex')}${safeExt}`
    );
    const targetPath = safeResolve(this.privateRoot, storageKey);
    await fs.mkdir(path.dirname(targetPath), { recursive: true });
    await fs.writeFile(targetPath, params.buffer);

    return {
      storageKey,
      key: storageKey,
      mimeType: detected,
      sizeBytes: params.buffer.byteLength,
      originalName: params.originalName,
    };
  }

  async readPrivateFile(storageKey: string): Promise<Buffer> {
    const targetPath = safeResolve(this.privateRoot, storageKey);
    return fs.readFile(targetPath);
  }

  async readPublicFile(storageKey: string): Promise<Buffer> {
    const targetPath = safeResolve(this.publicRoot, storageKey);
    return fs.readFile(targetPath);
  }

  async deleteFile(storageKey: string, isPrivate: boolean): Promise<void> {
    const root = isPrivate ? this.privateRoot : this.publicRoot;
    const targetPath = safeResolve(root, storageKey);
    await fs.unlink(targetPath).catch(() => undefined);
  }
}

