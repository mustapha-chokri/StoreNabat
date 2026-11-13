import nodemailer from 'nodemailer';
import { eq } from 'drizzle-orm';
import { storeSettings } from '@/db/schema/tenant';
import { withTenantIdDb } from '@/core/tenancy/context';
import { decryptJsonSecret } from '@/core/crypto';

export interface SmtpSettings {
  host: string;
  port: number;
  secure: boolean;
  user: string;
  pass: string;
  from: string;
}

function getEnvSmtpFallback(): SmtpSettings | null {
  const host = process.env.SMTP_HOST;
  const user = process.env.SMTP_USER;
  const pass = process.env.SMTP_PASS;
  if (!host) return null;
  return {
    host,
    port: Number(process.env.SMTP_PORT || 587),
    secure: process.env.SMTP_SECURE === 'true',
    user: user || '',
    pass: pass || '',
    from: process.env.SMTP_FROM || 'Nabat Al Atlas <no-reply@nabatalatlas.ma>',
  };
}

/**
 * Sends a transactional email using the tenant's encrypted SMTP configuration
 * (or environment SMTP fallback). In unconfigured local development, logs safely
 * without fabricating external delivery.
 */
export async function sendTenantEmail(params: {
  tenantId: string;
  to: string;
  subject: string;
  html: string;
  text?: string;
}): Promise<{ delivered: boolean; mode: 'smtp' | 'dev-log'; messageId?: string }> {
  const storeSmtp = await withTenantIdDb(params.tenantId, async (db) => {
    const rows = await db
      .select({ encryptedSmtpConfig: storeSettings.encryptedSmtpConfig })
      .from(storeSettings)
      .where(eq(storeSettings.storeId, params.tenantId))
      .limit(1);
    if (rows.length === 0 || !rows[0].encryptedSmtpConfig) return null;
    return decryptJsonSecret<SmtpSettings>(rows[0].encryptedSmtpConfig);
  });

  const smtp = storeSmtp?.host ? storeSmtp : getEnvSmtpFallback();
  if (!smtp || !smtp.host) {
    console.info(
      `[email:dev-log] tenant=${params.tenantId} to=${params.to} subject="${params.subject}"`
    );
    return { delivered: false, mode: 'dev-log' };
  }

  const transporter = nodemailer.createTransport({
    host: smtp.host,
    port: smtp.port,
    secure: smtp.secure,
    auth: smtp.user ? { user: smtp.user, pass: smtp.pass } : undefined,
  });

  const info = await transporter.sendMail({
    from: smtp.from,
    to: params.to,
    subject: params.subject,
    html: params.html,
    text: params.text,
  });

  return { delivered: true, mode: 'smtp', messageId: info.messageId };
}

