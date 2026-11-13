export type BackgroundJobPayload =
  | {
      name: 'send-email';
      tenantId: string;
      to: string;
      subject: string;
      html: string;
      text?: string;
    }
  | {
      name: 'send-whatsapp-cloud';
      tenantId: string;
      orderId?: string;
      recipientPhone: string;
      templateKey: string;
      templateName: string;
      languageCode: string;
      bodyParams: string[];
      fallbackText: string;
    }
  | {
      name: 'send-meta-capi';
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
    };

