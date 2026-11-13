import crypto from 'node:crypto';
import { eq } from 'drizzle-orm';
import { trackingConfigs } from '@/db/schema/tenant';
import { withTenantIdDb } from '@/core/tenancy/context';
import { decryptSecret } from '@/core/crypto';

function sha256Normalized(value: string): string {
  return crypto.createHash('sha256').update(value.trim().toLowerCase()).digest('hex');
}

/**
 * Dispatches server-side conversion events to Meta Conversions API (CAPI)
 * using the exact `eventId` generated for browser Pixel deduplication.
 */
export async function sendMetaCapiEvent(params: {
  tenantId: string;
  eventName: 'ViewContent' | 'AddToCart' | 'InitiateCheckout' | 'Purchase' | 'Lead';
  eventId: string;
  eventSourceUrl?: string;
  clientIp?: string;
  userAgent?: string;
  email?: string | null;
  phone?: string | null;
  value?: number;
  currency?: string;
  orderNumber?: string;
  contentIds?: string[];
}): Promise<{ sent: boolean; reason?: string }> {
  return withTenantIdDb(params.tenantId, async (db) => {
    const rows = await db
      .select()
      .from(trackingConfigs)
      .where(eq(trackingConfigs.storeId, params.tenantId))
      .limit(1);

    const cfg = rows[0];
    if (
      !cfg ||
      !cfg.metaCapiEnabled ||
      !cfg.metaPixelId ||
      !cfg.encryptedMetaCapiToken
    ) {
      return { sent: false, reason: 'Meta CAPI not enabled or configured' };
    }

    const accessToken = decryptSecret(cfg.encryptedMetaCapiToken);

    const userData: Record<string, unknown> = {
      client_ip_address: params.clientIp || undefined,
      client_user_agent: params.userAgent || undefined,
    };
    if (params.email) {
      userData.em = [sha256Normalized(params.email)];
    }
    if (params.phone) {
      userData.ph = [sha256Normalized(params.phone.replace(/\D/g, ''))];
    }

    const payload: Record<string, unknown> = {
      data: [
        {
          event_name: params.eventName,
          event_time: Math.floor(Date.now() / 1000),
          event_id: params.eventId,
          action_source: 'website',
          event_source_url: params.eventSourceUrl,
          user_data: userData,
          custom_data: {
            currency: params.currency || 'MAD',
            value: params.value,
            order_id: params.orderNumber,
            content_ids: params.contentIds,
            content_type: 'product',
          },
        },
      ],
    };

    if (cfg.metaTestEventCode) {
      payload.test_event_code = cfg.metaTestEventCode;
    }

    const res = await fetch(
      `https://graph.facebook.com/v21.0/${cfg.metaPixelId}/events?access_token=${encodeURIComponent(accessToken)}`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      }
    );

    if (!res.ok) {
      const errText = await res.text();
      return { sent: false, reason: `HTTP ${res.status}: ${errText}` };
    }

    return { sent: true };
  });
}

