import { eq } from 'drizzle-orm';
import { whatsappConfigs, whatsappLogs } from '@/db/schema/tenant';
import { withTenantIdDb } from '@/core/tenancy/context';
import { decryptSecret } from '@/core/crypto';
import { validateAndNormalizePhone } from '@/core/security/morocco';

export const DEFAULT_WHATSAPP_TEMPLATES: Record<string, Record<string, string>> = {
  ar: {
    customer_order_confirmation:
      'مرحباً، أود تأكيد طلبي رقم {{order_number}} من متجر {{store_name}}.\nالاسم: {{customer_name}}\nالمدينة: {{city}}\nالمبلغ الإجمالي: {{total}} {{currency}}\nالمنتجات:\n{{items}}',
    admin_order_confirmed:
      'مرحباً {{customer_name}}، تم تأكيد طلبك رقم {{order_number}} بنجاح لدى {{store_name}}. المبلغ: {{total}} {{currency}}.',
    admin_order_shipped:
      'مرحباً {{customer_name}}، تم شحن طلبك رقم {{order_number}}. رقم التتبع: {{tracking_number}}.',
    admin_order_delivered:
      'مرحباً {{customer_name}}، تم تسليم طلبك رقم {{order_number}}. شكراً لثقتك في {{store_name}}!',
  },
  fr: {
    customer_order_confirmation:
      'Bonjour, je souhaite confirmer ma commande N° {{order_number}} chez {{store_name}}.\nNom: {{customer_name}}\nVille: {{city}}\nTotal: {{total}} {{currency}}\nArticles:\n{{items}}',
    admin_order_confirmed:
      'Bonjour {{customer_name}}, votre commande N° {{order_number}} chez {{store_name}} est confirmée. Total: {{total}} {{currency}}.',
    admin_order_shipped:
      'Bonjour {{customer_name}}, votre commande N° {{order_number}} a été expédiée. Numéro de suivi: {{tracking_number}}.',
    admin_order_delivered:
      'Bonjour {{customer_name}}, votre commande N° {{order_number}} a été livrée. Merci pour votre confiance chez {{store_name}} !',
  },
  en: {
    customer_order_confirmation:
      'Hello, I would like to confirm my order #{{order_number}} at {{store_name}}.\nName: {{customer_name}}\nCity: {{city}}\nTotal: {{total}} {{currency}}\nItems:\n{{items}}',
    admin_order_confirmed:
      'Hello {{customer_name}}, your order #{{order_number}} at {{store_name}} is confirmed. Total: {{total}} {{currency}}.',
    admin_order_shipped:
      'Hello {{customer_name}}, your order #{{order_number}} has been shipped. Tracking: {{tracking_number}}.',
    admin_order_delivered:
      'Hello {{customer_name}}, your order #{{order_number}} has been delivered. Thank you for shopping at {{store_name}}!',
  },
};

export function renderWhatsAppTemplate(
  template: string,
  variables: Record<string, string>
): string {
  let out = template;
  for (const [key, val] of Object.entries(variables)) {
    out = out.replaceAll(`{{${key}}}`, val);
  }
  return out;
}

/**
 * Generates an official WhatsApp Click-to-Chat (`wa.me`) URL without claiming
 * automatic server-side delivery.
 */
export function buildClickToChatUrl(rawPhone: string, message: string): string {
  const parsed = validateAndNormalizePhone(rawPhone, 'MOROCCO_SMART');
  const target = parsed.valid ? parsed.formattedWhatsApp : rawPhone.replace(/\D/g, '');
  return `https://wa.me/${target}?text=${encodeURIComponent(message)}`;
}

/**
 * Sends an automated template message via Meta's official WhatsApp Business Cloud API
 * ONLY when configured and enabled by the tenant. Records full delivery logs.
 */
export async function sendWhatsAppCloudTemplate(params: {
  tenantId: string;
  orderId?: string;
  recipientPhone: string;
  templateKey: string;
  templateName: string;
  languageCode: string;
  bodyParams: string[];
  fallbackText: string;
}): Promise<{ sent: boolean; providerMessageId?: string; error?: string }> {
  return withTenantIdDb(params.tenantId, async (db) => {
    const configs = await db
      .select()
      .from(whatsappConfigs)
      .where(eq(whatsappConfigs.storeId, params.tenantId))
      .limit(1);

    const cfg = configs[0];
    if (!cfg || !cfg.cloudApiEnabled || !cfg.cloudPhoneNumberId || !cfg.encryptedCloudAccessToken) {
      await db.insert(whatsappLogs).values({
        storeId: params.tenantId,
        orderId: params.orderId || null,
        channel: 'CLOUD_API',
        recipientPhone: params.recipientPhone,
        templateKey: params.templateKey,
        messageContent: params.fallbackText,
        status: 'FAILED',
        errorMessage: 'WhatsApp Business Cloud API is not configured or disabled for this store.',
      });
      return { sent: false, error: 'WhatsApp Business Cloud API is not configured.' };
    }

    const accessToken = decryptSecret(cfg.encryptedCloudAccessToken);
    const parsedPhone = validateAndNormalizePhone(params.recipientPhone, 'MOROCCO_SMART');
    const toPhone = parsedPhone.valid
      ? parsedPhone.formattedWhatsApp
      : params.recipientPhone.replace(/\D/g, '');

    try {
      const response = await fetch(
        `https://graph.facebook.com/v21.0/${cfg.cloudPhoneNumberId}/messages`,
        {
          method: 'POST',
          headers: {
            Authorization: `Bearer ${accessToken}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            messaging_product: 'whatsapp',
            to: toPhone,
            type: 'template',
            template: {
              name: params.templateName,
              language: { code: params.languageCode },
              components:
                params.bodyParams.length > 0
                  ? [
                      {
                        type: 'body',
                        parameters: params.bodyParams.map((text) => ({
                          type: 'text',
                          text,
                        })),
                      },
                    ]
                  : undefined,
            },
          }),
        }
      );

      const json = (await response.json()) as {
        messages?: Array<{ id: string }>;
        error?: { message?: string };
      };

      if (!response.ok || !json.messages?.[0]?.id) {
        const errMsg = json.error?.message || `HTTP ${response.status}`;
        await db.insert(whatsappLogs).values({
          storeId: params.tenantId,
          orderId: params.orderId || null,
          channel: 'CLOUD_API',
          recipientPhone: toPhone,
          templateKey: params.templateKey,
          messageContent: params.fallbackText,
          status: 'FAILED',
          errorMessage: errMsg,
        });
        return { sent: false, error: errMsg };
      }

      const providerMessageId = json.messages[0].id;
      await db.insert(whatsappLogs).values({
        storeId: params.tenantId,
        orderId: params.orderId || null,
        channel: 'CLOUD_API',
        recipientPhone: toPhone,
        templateKey: params.templateKey,
        messageContent: params.fallbackText,
        status: 'SENT',
        providerMessageId,
      });

      return { sent: true, providerMessageId };
    } catch (err) {
      const errMsg = err instanceof Error ? err.message : 'Network error';
      await db.insert(whatsappLogs).values({
        storeId: params.tenantId,
        orderId: params.orderId || null,
        channel: 'CLOUD_API',
        recipientPhone: toPhone,
        templateKey: params.templateKey,
        messageContent: params.fallbackText,
        status: 'FAILED',
        errorMessage: errMsg,
      });
      return { sent: false, error: errMsg };
    }
  });
}

