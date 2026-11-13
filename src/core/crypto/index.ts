import crypto from 'node:crypto';
import { hash as argon2Hash, verify as argon2Verify } from '@node-rs/argon2';
import { getEnv } from '@/core/env';

const AES_ALGORITHM = 'aes-256-gcm';
const IV_LENGTH = 12;

function deriveAesKey(rawKey?: string): Buffer {
  const keySource = rawKey || getEnv().tenantEncryptionKey;
  return crypto.createHash('sha256').update(keySource).digest();
}

/**
 * Encrypts sensitive configuration (DB URLs, payment secrets, WhatsApp tokens)
 * using AES-256-GCM authenticated encryption.
 */
export function encryptSecret(plaintext: string, masterKey?: string): string {
  const key = deriveAesKey(masterKey);
  const iv = crypto.randomBytes(IV_LENGTH);
  const cipher = crypto.createCipheriv(AES_ALGORITHM, key, iv);

  const encrypted = Buffer.concat([cipher.update(plaintext, 'utf8'), cipher.final()]);
  const authTag = cipher.getAuthTag();

  return `${iv.toString('hex')}:${authTag.toString('hex')}:${encrypted.toString('hex')}`;
}

/**
 * Decrypts AES-256-GCM ciphertext produced by encryptSecret.
 */
export function decryptSecret(ciphertext: string, masterKey?: string): string {
  const parts = ciphertext.split(':');
  if (parts.length !== 3) {
    throw new Error('Invalid encrypted payload format.');
  }
  const [ivHex, authTagHex, encryptedHex] = parts;
  const key = deriveAesKey(masterKey);
  const iv = Buffer.from(ivHex, 'hex');
  const authTag = Buffer.from(authTagHex, 'hex');
  const encrypted = Buffer.from(encryptedHex, 'hex');

  const decipher = crypto.createDecipheriv(AES_ALGORITHM, key, iv);
  decipher.setAuthTag(authTag);

  const decrypted = Buffer.concat([decipher.update(encrypted), decipher.final()]);
  return decrypted.toString('utf8');
}

/**
 * Encrypts a JSON-serializable secret object safely.
 */
export function encryptJsonSecret<T>(data: T, masterKey?: string): string {
  return encryptSecret(JSON.stringify(data), masterKey);
}

/**
 * Decrypts a JSON secret object safely; returns null if missing.
 */
export function decryptJsonSecret<T>(ciphertext: string | null | undefined, masterKey?: string): T | null {
  if (!ciphertext) return null;
  const plain = decryptSecret(ciphertext, masterKey);
  return JSON.parse(plain) as T;
}

/**
 * Hashes user passwords using Argon2id.
 */
export async function hashPassword(password: string): Promise<string> {
  return argon2Hash(password, {
    memoryCost: 19456,
    timeCost: 2,
    parallelism: 1,
  });
}

/**
 * Verifies a plaintext password against an Argon2id hash.
 */
export async function verifyPassword(password: string, passwordHash: string): Promise<boolean> {
  try {
    return await argon2Verify(passwordHash, password);
  } catch {
    return false;
  }
}

/**
 * Generates a cryptographically secure random token (hex).
 */
export function generateSecureToken(byteLength = 32): string {
  return crypto.randomBytes(byteLength).toString('hex');
}

/**
 * Deterministic SHA-256 token digest for database storage of session/reset tokens.
 */
export function hashToken(token: string): string {
  return crypto.createHash('sha256').update(token).digest('hex');
}

/**
 * Timing-safe HMAC-SHA256 signature generation for cookies and internal tokens.
 */
export function signHmac(payload: string, secret?: string): string {
  const key = secret || getEnv().sessionSecret;
  return crypto.createHmac('sha256', key).update(payload).digest('hex');
}

export function verifyHmac(payload: string, signatureHex: string, secret?: string): boolean {
  const expected = signHmac(payload, secret);
  const a = Buffer.from(expected, 'hex');
  const b = Buffer.from(signatureHex, 'hex');
  if (a.length !== b.length) return false;
  return crypto.timingSafeEqual(a, b);
}

