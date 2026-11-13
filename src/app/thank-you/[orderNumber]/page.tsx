import React from 'react';
import { notFound } from 'next/navigation';
import { and, desc, eq, inArray } from 'drizzle-orm';
import {
  digitalDownloads,
  digitalFiles,
  orderItems,
  orders,
  productMedia,
  products,
  storeSettings,
  thankYouRules,
  whatsappConfigs,
} from '@/db/schema/tenant';
import { getRequestTenant, withTenantDb } from '@/core/tenancy/context';
import { getActiveLocale } from '@/core/i18n/server';
import { pickI18n } from '@/core/i18n/dictionaries';
import { sanitizeRichHtml } from '@/core/security/sanitize';
import {
  buildClickToChatUrl,
  DEFAULT_WHATSAPP_TEMPLATES,
  renderWhatsAppTemplate,
} from '@/services/whatsapp';
import { StorefrontShell } from '@/components/storefront/StorefrontShell';
import {
  ThankYouClient,
  type ThankYouOrderData,
  type ThankYouRuleView,
} from '@/components/storefront/ThankYouClient';

export const dynamic = 'force-dynamic';

export default async function ThankYouPage({
  params,
  searchParams,
}: {
  params: Promise<{ orderNumber: string }>;
  searchParams: Promise<{ token?: string; cancelled?: string }>;
}) {
  const { orderNumber } = await params;
  const sp = await searchParams;
  const locale = await getActiveLocale();

  const tenant = await getRequestTenant().catch(() => null);
  if (!tenant) notFound();

  const data = await withTenantDb(tenant, async (db) => {
    const [order] = await db
      .select()
      .from(orders)
      .where(and(eq(orders.storeId, tenant.id), eq(orders.orderNumber, orderNumber)))
      .limit(1);

    if (!order) return null;

    const items = await db
      .select()
      .from(orderItems)
      .where(and(eq(orderItems.storeId, tenant.id), eq(orderItems.orderId, order.id)));

    const downloads =
      order.paymentStatus === 'PAID'
        ? await db
            .select({
              accessToken: digitalDownloads.accessToken,
              downloadCount: digitalDownloads.downloadCount,
              maxDownloads: digitalDownloads.maxDownloads,
              fileName: digitalFiles.fileName,
            })
            .from(digitalDownloads)
            .innerJoin(digitalFiles, eq(digitalDownloads.digitalFileId, digitalFiles.id))
            .where(and(eq(digitalDownloads.storeId, tenant.id), eq(digitalDownloads.orderId, order.id)))
        : [];

    const digitalPendingPayment =
      order.paymentStatus !== 'PAID' && items.some((i) => i.productType === 'DIGITAL');

    const rules = await db
      .select()
      .from(thankYouRules)
      .where(and(eq(thankYouRules.storeId, tenant.id), eq(thankYouRules.isActive, true)))
      .orderBy(desc(thankYouRules.priority));

    const matchedRule =
      rules.find(
        (r) =>
          (r.paymentMethodFilter === 'ALL' || r.paymentMethodFilter === order.paymentMethod) &&
          (r.orderStatusFilter === 'ALL' || r.orderStatusFilter === order.orderStatus)
      ) || null;

    const upsellIds = matchedRule?.upsellProductIds || [];
    const upsells =
      upsellIds.length > 0
        ? await db
            .select()
            .from(products)
            .where(
              and(
                eq(products.storeId, tenant.id),
                inArray(products.id, upsellIds),
                eq(products.isPublished, true)
              )
            )
        : [];
    const upsellMedia =
      upsellIds.length > 0
        ? await db
            .select()
            .from(productMedia)
            .where(
              and(
                eq(productMedia.storeId, tenant.id),
                inArray(productMedia.productId, upsellIds)
              )
            )
        : [];

    const [settings] = await db
      .select()
      .from(storeSettings)
      .where(eq(storeSettings.storeId, tenant.id))
      .limit(1);

    const [waCfg] = await db
      .select()
      .from(whatsappConfigs)
      .where(eq(whatsappConfigs.storeId, tenant.id))
      .limit(1);

    const targetPhone = waCfg?.defaultPhone || settings?.whatsappNumber || '';
    let whatsappConfirmUrl: string | null = null;
    if (targetPhone && (waCfg?.clickToChatEnabled ?? true)) {
      const storeName = pickI18n(settings?.storeNameI18n, locale, tenant.name);
      const tmplMap = waCfg?.templates?.[locale] || DEFAULT_WHATSAPP_TEMPLATES[locale] || DEFAULT_WHATSAPP_TEMPLATES.ar;
      const tmpl =
        tmplMap.customer_order_confirmation ||
        DEFAULT_WHATSAPP_TEMPLATES.ar.customer_order_confirmation;
      const itemsText = items
        .map((i) => `- ${i.productTitle}${i.variantTitle ? ` (${i.variantTitle})` : ''} × ${i.quantity}`)
        .join('\n');
      const msg = renderWhatsAppTemplate(tmpl, {
        order_number: order.orderNumber,
        store_name: storeName,
        customer_name: order.customerName,
        city: order.cityName,
        total: order.totalAmount,
        currency: order.currency,
        items: itemsText,
      });
      whatsappConfirmUrl = buildClickToChatUrl(targetPhone, msg);
    }

    return {
      order,
      items,
      downloads,
      digitalPendingPayment,
      matchedRule,
      upsells: upsells.map((p) => ({
        ...p,
        promoStartsAt: p.promoStartsAt ? p.promoStartsAt.toISOString() : null,
        promoEndsAt: p.promoEndsAt ? p.promoEndsAt.toISOString() : null,
        media: upsellMedia
          .filter((m) => m.productId === p.id)
          .sort((a, b) => a.sortOrder - b.sortOrder),
      })),
      whatsappConfirmUrl,
    };
  }).catch(() => null);

  if (!data) notFound();

  const orderData: ThankYouOrderData = {
    orderNumber: data.order.orderNumber,
    orderStatus: data.order.orderStatus,
    paymentMethod: data.order.paymentMethod,
    paymentStatus: data.order.paymentStatus,
    customerName: data.order.customerName,
    cityName: data.order.cityName,
    subtotal: data.order.subtotal,
    discountAmount: data.order.discountAmount,
    shippingFee: data.order.shippingFee,
    codFee: data.order.codFee,
    totalAmount: data.order.totalAmount,
    currency: data.order.currency,
    items: data.items,
    downloads: data.downloads,
    digitalPendingPayment: data.digitalPendingPayment,
  };

  const ruleView: ThankYouRuleView | null = data.matchedRule
    ? {
        titleI18n: data.matchedRule.titleI18n,
        messageI18n: data.matchedRule.messageI18n,
        mediaUrl: data.matchedRule.mediaUrl,
        mediaType: data.matchedRule.mediaType,
        showOrderSummary: data.matchedRule.showOrderSummary,
        showWhatsappButton: data.matchedRule.showWhatsappButton,
        showTrackingLink: data.matchedRule.showTrackingLink,
        showSocialLinks: data.matchedRule.showSocialLinks,
        sanitizedCustomHtml: data.matchedRule.customHtml
          ? sanitizeRichHtml(data.matchedRule.customHtml)
          : null,
      }
    : null;

  return (
    <StorefrontShell>
      <ThankYouClient
        order={orderData}
        rule={ruleView}
        whatsappConfirmUrl={data.whatsappConfirmUrl}
        upsells={data.upsells}
        paypalToken={sp.token}
        cancelled={sp.cancelled === '1'}
      />
    </StorefrontShell>
  );
}

