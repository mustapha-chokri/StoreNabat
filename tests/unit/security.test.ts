import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { describe, expect, it } from 'vitest';
import { sanitizeCustomCss, sanitizeRichHtml } from '@/core/security/sanitize';
import { computeCmiHash, verifyCmiCallbackHash } from '@/services/payments/cmi';
import {
  decryptJsonSecret,
  decryptSecret,
  encryptJsonSecret,
  encryptSecret,
  hashPassword,
  signHmac,
  verifyHmac,
  verifyPassword,
} from '@/core/crypto';
import { hasPermission } from '@/core/auth/rbac';
import { LocalStorageProvider } from '@/core/storage/local-storage';

describe('Security, Cryptography, Sanitization & RBAC', () => {
  it('strips XSS payloads while preserving safe Arabic/RTL rich HTML', () => {
    const dirty =
      '<div dir="rtl"><h2>شكراً لطلبكم</h2><p>توصيل سريع</p><script>alert(1)</script><img src="x" onerror="steal()" /><a href="javascript:alert(2)" rel="nofollow">click</a></div>';
    const clean = sanitizeRichHtml(dirty);

    expect(clean).toContain('<div dir="rtl">');
    expect(clean).toContain('شكراً لطلبكم');
    expect(clean).not.toContain('<script>');
    expect(clean).not.toContain('onerror');
    expect(clean).not.toContain('javascript:');
  });

  it('strips CSS injection vectors while keeping valid theme rules', () => {
    const dirtyCss = `
      :root { --primary: #14532D; }
      @import url('https://evil.example/leak.css');
      body { background: url('javascript:alert(1)'); behavior: url(xss.htc); -moz-binding: url(x); width: expression(alert(1)); }
      </style><script>alert(1)</script>
    `;
    const cleanCss = sanitizeCustomCss(dirtyCss);

    expect(cleanCss).toContain('--primary: #14532D');
    expect(cleanCss).not.toContain('@import');
    expect(cleanCss).not.toContain('expression(');
    expect(cleanCss).not.toContain('behavior:');
    expect(cleanCss).not.toContain('-moz-binding:');
    expect(cleanCss).not.toContain('</style>');
    expect(cleanCss).not.toContain('javascript:');
  });

  it('verifies CMI SHA-512 callback signatures strictly and rejects tampering', () => {
    const storeKey = 'My_Cmi|Secret\\Key';
    const payload: Record<string, string> = {
      oid: 'NA-2026-0099',
      amount: '590.00',
      ProcReturnCode: '00',
      Response: 'Approved',
    };
    payload.HASH = computeCmiHash(payload, storeKey);

    expect(verifyCmiCallbackHash(payload, storeKey)).toBe(true);
    expect(verifyCmiCallbackHash({ ...payload, amount: '1.00' }, storeKey)).toBe(false);
    expect(verifyCmiCallbackHash(payload, 'WrongKey')).toBe(false);
  });

  it('performs authenticated AES-256-GCM encryption/decryption and fails on tampering', () => {
    const masterKey = 'test-master-key-with-plenty-of-entropy-for-aes-256-gcm-tests';
    const secretObj = { secretKey: 'sk_test_123', webhookSecret: 'whsec_456' };

    const c1 = encryptJsonSecret(secretObj, masterKey);
    const c2 = encryptJsonSecret(secretObj, masterKey);
    expect(c1).not.toBe(c2); // Unique random 12-byte IV every time

    expect(decryptJsonSecret<typeof secretObj>(c1, masterKey)).toEqual(secretObj);

    const parts = c1.split(':');
    const tampered = `${parts[0]}:${parts[1]}:${'ff'.repeat(parts[2].length / 2)}`;
    expect(() => decryptSecret(tampered, masterKey)).toThrow();
  });

  it('hashes and verifies passwords via Argon2id and signs HMAC-SHA256 cookies safely', async () => {
    const hash = await hashPassword('AtlasBotanical#2026');
    expect(hash.startsWith('$argon2id$')).toBe(true);
    expect(await verifyPassword('AtlasBotanical#2026', hash)).toBe(true);
    expect(await verifyPassword('WrongPass', hash)).toBe(false);

    const payload = 'tenant-uuid.token-value';
    const sig = signHmac(payload, 'hmac-secret-key-32-chars-minimum-1234');
    expect(verifyHmac(payload, sig, 'hmac-secret-key-32-chars-minimum-1234')).toBe(true);
    expect(verifyHmac(`${payload}x`, sig, 'hmac-secret-key-32-chars-minimum-1234')).toBe(false);
  });

  it('enforces RBAC permissions accurately per admin role', () => {
    expect(hasPermission('OWNER', [], 'staff.manage')).toBe(true);
    expect(hasPermission('ADMIN', [], 'settings.write')).toBe(true);

    expect(hasPermission('CONFIRMATOR', [], 'orders.write')).toBe(true);
    expect(hasPermission('CONFIRMATOR', [], 'whatsapp.send')).toBe(true);
    expect(hasPermission('CONFIRMATOR', [], 'settings.write')).toBe(false);
    expect(hasPermission('CONFIRMATOR', [], 'staff.manage')).toBe(false);

    // Custom permission override granted explicitly to confirmator
    expect(hasPermission('CONFIRMATOR', ['orders.export'], 'orders.export')).toBe(true);
  });

  it('rejects spoofed MIME uploads and isolates digital files in LocalStorageProvider', async () => {
    const tmpRoot = await fs.mkdtemp(path.join(os.tmpdir(), 'nabat-storage-test-'));
    const prevRoot = process.env.STORAGE_LOCAL_ROOT;
    process.env.STORAGE_LOCAL_ROOT = tmpRoot;

    try {
      const storage = new LocalStorageProvider();
      // Fake JPEG header (actually PHP/text script)
      await expect(
        storage.savePublicMedia({
          tenantId: 'tenant-a',
          buffer: Buffer.from('<?php system($_GET["c"]); ?>'),
          originalName: 'shell.jpg',
          mimeType: 'image/jpeg',
        })
      ).rejects.toThrow(/Unsupported or invalid media file signature/);

      // Valid PDF magic signature
      const pdfBytes = Buffer.from('%PDF-1.4\n1 0 obj\n<<>>\nendobj\n%%EOF');
      const stored = await storage.savePrivateDigitalFile({
        tenantId: 'tenant-a',
        buffer: pdfBytes,
        originalName: '../../evil-path.pdf',
        mimeType: 'application/pdf',
      });

      expect(stored.mimeType).toBe('application/pdf');
      expect(stored.storageKey.startsWith('tenant-a/')).toBe(true);
      const readBack = await storage.readPrivateFile(stored.storageKey);
      expect(readBack.equals(pdfBytes)).toBe(true);
    } finally {
      if (prevRoot === undefined) {
        delete process.env.STORAGE_LOCAL_ROOT;
      } else {
        process.env.STORAGE_LOCAL_ROOT = prevRoot;
      }
      await fs.rm(tmpRoot, { recursive: true, force: true });
    }
  });
});

