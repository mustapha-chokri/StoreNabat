import crypto from 'node:crypto';
import { and, eq, inArray, sql } from 'drizzle-orm';
import {
  auditLogs,
  carts,
  cartItems,
  coupons,
  customers,
  landingPages,
  orderItems,
  orders,
  orderStatusHistory,
  productBundleItems,
  productMedia,
  products,
  productVariants,
  storeSettings,
  whatsappConfigs,
} from '@/db/schema/tenant';
import type { TenantDb } from '@/db/pools';
import type { OrderStatus, PaymentMethod, PaymentStatus } from '@/db/schema/types';
import { validateAndNormalizePhone } from '@/core/security/morocco';
import { computeEffectivePrice } from '@/services/catalog/pricing';
import { calculateShippingQuote } from '@/services/shipping';
import { deductOrderStock, restoreOrderStock } from '@/services/inventory';
import { provisionDigitalDownloadsForOrder } from '@/services/digital';
import { createTenantNotification } from '@/services/notifications';
import { initiateOrderPayment, type PaymentCheckoutResult } from '@/services/payments';
import {
  buildClickToChatUrl,
  DEFAULT_WHATSAPP_TEMPLATES,
  renderWhatsAppTemplate,
} from '@/services/whatsapp';
import { enqueueJob } from '@/core/jobs/queue';

export interface OrderLineInput {
  productId: string;
  variantId?: string | null;
  quantity: number;
}

export interface CreateOrderInput {
  storeId: string;
  checkoutType: 'QUICK_ORDER' | 'CART' | 'LANDING_PAGE';
  landingPageId?: string | null;
  cartToken?: string | null;
  authenticatedCustomerId?: string | null;
  locale: string;
  customerName: string;
  customerEmail?: string | null;
  phone: string;
  whatsappNumber?: string | null;
  cityId?: string | null;
  cityName?: string;
  shippingAddress: string;
  customerNotes?: string | null;
  customFields?: Record<string, unknown>;
  couponCode?: string | null;
  paymentMethod: PaymentMethod;
  items: OrderLineInput[];
  ipAddress?: string;
  userAgent?: string;
  baseUrl?: string;
  trackingEventId?: string;
}

export interface CreateOrderOutput {
  order: typeof orders.$inferSelect;
  items: Array<typeof orderItems.$inferSelect>;
  paymentAction: PaymentCheckoutResult;
  whatsappConfirmUrl: string | null;
}

async function generateOrderNumber(db: TenantDb, storeId: string): Promise<string> {
  const year = new Date().getFullYear();
  const suffix = crypto.randomBytes(3).toString('hex').toUpperCase();
  const res = await db.execute(
    sql`SELECT COUNT(*)::int AS cnt FROM orders WHERE store_id = ${storeId}`
  );
  const count = Number((res.rows[0] as { cnt: number })?.cnt || 0) + 1;
  return `NA-${year}-${String(count).padStart(5, '0')}-${suffix.slice(0, 4)}`;
}

/**
 * Creates a complete validated order inside the tenant's isolated transaction:
 * - Checks blacklist & validates Moroccan/international phone
 * - Computes authoritative prices, promos, coupons, and city-based shipping/COD fees
 * - Checks inventory availability and enforces overselling protection
 * - Upserts CRM customer & duplicate phone tag
 * - Initiates payment gateway checkout (COD / Stripe / PayPal / CMI)
 * - Emits real-time SSE notification & optional background jobs (CAPI, WhatsApp)
 */
export async function createTenantOrder(
  db: TenantDb,
  input: CreateOrderInput
): Promise<CreateOrderOutput> {
  if (!input.items || input.items.length === 0) {
    throw new Error('ORDER_EMPTY_ITEMS');
  }

  const settingsRows = await db
    .select()
    .from(storeSettings)
    .where(eq(storeSettings.storeId, input.storeId))
    .limit(1);

  const settings = settingsRows[0];
  const phoneMode = settings?.checkoutConfig?.phoneValidationMode || 'MOROCCO_SMART';
  const phoneCheck = validateAndNormalizePhone(input.phone, phoneMode);
  if (!phoneCheck.valid) {
    throw new Error('INVALID_PHONE_NUMBER');
  }

  const whatsappCheck = input.whatsappNumber
    ? validateAndNormalizePhone(input.whatsappNumber, phoneMode)
    : phoneCheck;

  // Check blacklist by normalized phone or authenticated customerId
  const existingCustomerRows = await db
    .select()
    .from(customers)
    .where(
      and(
        eq(customers.storeId, input.storeId),
        eq(customers.normalizedPhone, phoneCheck.normalized)
      )
    )
    .limit(1);

  if (existingCustomerRows.length > 0 && existingCustomerRows[0].isBlacklisted) {
    throw new Error('CUSTOMER_BLACKLISTED');
  }

  // Load products & variants from DB (never trust client-sent prices)
  const productIds = Array.from(new Set(input.items.map((i) => i.productId)));
  const productRows = await db
    .select()
    .from(products)
    .where(
      and(
        eq(products.storeId, input.storeId),
        inArray(products.id, productIds),
        eq(products.isPublished, true)
      )
    );
  const productMap = new Map(productRows.map((p) => [p.id, p]));

  const variantIds = input.items
    .map((i) => i.variantId)
    .filter((id): id is string => Boolean(id));
  const variantRows =
    variantIds.length > 0
      ? await db
          .select()
          .from(productVariants)
          .where(
            and(
              eq(productVariants.storeId, input.storeId),
              inArray(productVariants.id, variantIds),
              eq(productVariants.isActive, true)
            )
          )
      : [];
  const variantMap = new Map(variantRows.map((v) => [v.id, v]));

  const mediaRows = await db
    .select()
    .from(productMedia)
    .where(
      and(
        eq(productMedia.storeId, input.storeId),
        inArray(productMedia.productId, productIds)
      )
    );
  const firstImageMap = new Map<string, string>();
  for (const m of mediaRows.sort((a, b) => a.sortOrder - b.sortOrder)) {
    if (m.mediaType === 'IMAGE' && !firstImageMap.has(m.productId)) {
      firstImageMap.set(m.productId, m.url);
    }
  }

  let subtotal = 0;
  let requiresShipping = false;
  let extraShippingFee = 0;
  let allFreeShipping = true;

  const preparedItems: Array<{
    productId: string;
    variantId: string | null;
    productType: string;
    productTitle: string;
    variantTitle: string | null;
    sku: string | null;
    imageUrl: string | null;
    unitPrice: number;
    quantity: number;
    lineTotal: number;
  }> = [];

  for (const line of input.items) {
    if (!Number.isInteger(line.quantity) || line.quantity <= 0 || line.quantity > 500) {
      throw new Error('INVALID_QUANTITY');
    }

    const prod = productMap.get(line.productId);
    if (!prod) {
      throw new Error('PRODUCT_NOT_FOUND');
    }

    const variant = line.variantId ? variantMap.get(line.variantId) : undefined;
    if (line.variantId && (!variant || variant.productId !== prod.id)) {
      throw new Error('VARIANT_NOT_FOUND');
    }

    // Validate stock availability upfront even if deduction happens on confirmation (skip digital & services)
    const shouldCheckStock =
      prod.productType !== 'DIGITAL' &&
      prod.productType !== 'SERVICE' &&
      prod.trackInventory &&
      !prod.allowBackorders;

    if (shouldCheckStock) {
      if (prod.productType === 'BUNDLE') {
        const bItems = await db
          .select()
          .from(productBundleItems)
          .where(
            and(
              eq(productBundleItems.storeId, input.storeId),
              eq(productBundleItems.bundleProductId, prod.id)
            )
          );
        for (const bi of bItems) {
          const needed = bi.quantity * line.quantity;
          if (bi.itemVariantId) {
            const [bv] = await db
              .select({ stockQuantity: productVariants.stockQuantity })
              .from(productVariants)
              .where(
                and(
                  eq(productVariants.storeId, input.storeId),
                  eq(productVariants.id, bi.itemVariantId)
                )
              )
              .limit(1);
            if (bv && bv.stockQuantity < needed) {
              throw new Error(`INSUFFICIENT_STOCK:${prod.titleI18n[input.locale] || prod.titleI18n.ar || ''}`);
            }
          } else {
            const [bp] = await db
              .select({ stockQuantity: products.stockQuantity, trackInventory: products.trackInventory })
              .from(products)
              .where(and(eq(products.storeId, input.storeId), eq(products.id, bi.itemProductId)))
              .limit(1);
            if (bp && bp.trackInventory && bp.stockQuantity < needed) {
              throw new Error(`INSUFFICIENT_STOCK:${prod.titleI18n[input.locale] || prod.titleI18n.ar || ''}`);
            }
          }
        }
      } else {
        const available = variant ? variant.stockQuantity : prod.stockQuantity;
        if (available < line.quantity) {
          throw new Error(
            `INSUFFICIENT_STOCK:${prod.titleI18n[input.locale] || prod.titleI18n.ar || ''}`
          );
        }
      }
    }

    const priceRes = variant
      ? computeEffectivePrice({
          regularPrice: variant.regularPrice,
          salePrice: variant.salePrice ?? null,
          promoStartsAt: prod.promoStartsAt,
          promoEndsAt: prod.promoEndsAt,
        })
      : computeEffectivePrice({
          regularPrice: prod.regularPrice,
          salePrice: prod.salePrice,
          discountType: prod.discountType,
          discountValue: prod.discountValue,
          promoStartsAt: prod.promoStartsAt,
          promoEndsAt: prod.promoEndsAt,
        });

    const lineTotal = Number((priceRes.effectivePrice * line.quantity).toFixed(2));
    subtotal += lineTotal;

    if (prod.requiresShipping && prod.productType !== 'DIGITAL' && prod.productType !== 'SERVICE') {
      requiresShipping = true;
      if (!prod.shippingConfig?.freeShipping) {
        allFreeShipping = false;
      }
      if (prod.shippingConfig?.extraShippingFee) {
        extraShippingFee += Number(prod.shippingConfig.extraShippingFee) * line.quantity;
      }
    }

    const title =
      prod.titleI18n[input.locale] || prod.titleI18n.ar || prod.titleI18n.fr || prod.slug;
    const varTitle = variant
      ? variant.titleI18n[input.locale] || variant.titleI18n.ar || variant.titleI18n.fr || null
      : null;

    preparedItems.push({
      productId: prod.id,
      variantId: variant?.id || null,
      productType: prod.productType,
      productTitle: title,
      variantTitle: varTitle,
      sku: variant?.sku || prod.sku || null,
      imageUrl: variant?.imageUrl || firstImageMap.get(prod.id) || null,
      unitPrice: priceRes.effectivePrice,
      quantity: line.quantity,
      lineTotal,
    });
  }

  subtotal = Number(subtotal.toFixed(2));

  // Coupon validation
  let discountAmount = 0;
  let appliedCouponCode: string | null = null;
  let couponFreeShipping = false;

  if (input.couponCode && input.couponCode.trim()) {
    const cleanCode = input.couponCode.trim().toUpperCase();
    const couponRows = await db
      .select()
      .from(coupons)
      .where(
        and(
          eq(coupons.storeId, input.storeId),
          eq(coupons.code, cleanCode),
          eq(coupons.isActive, true)
        )
      )
      .limit(1);

    const coupon = couponRows[0];
    if (!coupon) throw new Error('INVALID_COUPON');
    const now = new Date();
    if (coupon.startsAt && now < coupon.startsAt) throw new Error('COUPON_NOT_STARTED');
    if (coupon.endsAt && now > coupon.endsAt) throw new Error('COUPON_EXPIRED');
    if (coupon.maxUses !== null && coupon.usedCount >= coupon.maxUses) {
      throw new Error('COUPON_USAGE_LIMIT');
    }
    if (coupon.minOrderAmount && subtotal < Number(coupon.minOrderAmount)) {
      throw new Error('COUPON_MIN_ORDER');
    }

    appliedCouponCode = cleanCode;
    if (coupon.discountType === 'PERCENT') {
      discountAmount = Number(((subtotal * Number(coupon.discountValue)) / 100).toFixed(2));
    } else if (coupon.discountType === 'FIXED') {
      discountAmount = Math.min(subtotal, Number(coupon.discountValue));
    } else if (coupon.discountType === 'FREE_SHIPPING') {
      couponFreeShipping = true;
    }

    await db
      .update(coupons)
      .set({ usedCount: sql`${coupons.usedCount} + 1` })
      .where(and(eq(coupons.storeId, input.storeId), eq(coupons.id, coupon.id)));
  }

  const subtotalAfterDiscount = Math.max(0, Number((subtotal - discountAmount).toFixed(2)));

  // Shipping & COD Fee
  const shippingQuote = await calculateShippingQuote(db, {
    storeId: input.storeId,
    cityId: input.cityId,
    cityName: input.cityName,
    subtotalAfterDiscount,
    requiresShipping,
    locale: input.locale,
    forceFreeShippingCoupon: couponFreeShipping,
    extraProductShippingFee: extraShippingFee,
    productAllowsFreeShipping: requiresShipping && allFreeShipping,
  });

  if (input.paymentMethod === 'COD' && requiresShipping && !shippingQuote.codAllowed) {
    throw new Error('COD_NOT_AVAILABLE_FOR_CITY');
  }

  const shippingFee = shippingQuote.deliveryFee;
  const codFee = input.paymentMethod === 'COD' ? shippingQuote.codFee : 0;

  // Tax computation (TTC inclusive vs exclusive)
  const taxEnabled = settings?.taxEnabled ?? true;
  const taxInclusive = settings?.taxInclusive ?? true;
  const taxRate = taxEnabled ? Number(settings?.taxRatePercent || 20) : 0;
  let taxAmount = 0;
  let totalAmount = Number((subtotalAfterDiscount + shippingFee + codFee).toFixed(2));

  if (taxEnabled && taxRate > 0) {
    if (taxInclusive) {
      // Extract informational VAT portion from TTC total
      taxAmount = Number((totalAmount - totalAmount / (1 + taxRate / 100)).toFixed(2));
    } else {
      taxAmount = Number(((subtotalAfterDiscount * taxRate) / 100).toFixed(2));
      totalAmount = Number((totalAmount + taxAmount).toFixed(2));
    }
  }

  // Upsert CRM Customer & detect duplicate phone numbers
  let customerId: string;
  if (existingCustomerRows.length > 0) {
    const existing = existingCustomerRows[0];
    customerId = existing.id;
    const tags = new Set(existing.segmentTags || []);
    tags.add('REPEAT_PHONE');
    await db
      .update(customers)
      .set({
        fullName: input.customerName,
        email: input.customerEmail || existing.email,
        whatsappNumber: whatsappCheck.normalized,
        ordersCount: sql`${customers.ordersCount} + 1`,
        totalSpent: sql`${customers.totalSpent} + ${totalAmount}`,
        lastOrderAt: new Date(),
        segmentTags: Array.from(tags),
        updatedAt: new Date(),
      })
      .where(and(eq(customers.storeId, input.storeId), eq(customers.id, existing.id)));
  } else {
    const [createdCustomer] = await db
      .insert(customers)
      .values({
        storeId: input.storeId,
        fullName: input.customerName,
        email: input.customerEmail || null,
        phone: input.phone,
        normalizedPhone: phoneCheck.normalized,
        whatsappNumber: whatsappCheck.normalized,
        isGuest: !input.authenticatedCustomerId,
        ordersCount: 1,
        totalSpent: totalAmount.toFixed(2),
        lastOrderAt: new Date(),
      })
      .returning();
    customerId = createdCustomer.id;

    await createTenantNotification(db, {
      storeId: input.storeId,
      type: 'NEW_CUSTOMER',
      titleI18n: { ar: 'زبون جديد', fr: 'Nouveau client', en: 'New Customer' },
      messageI18n: {
        ar: `${input.customerName} (${input.phone})`,
        fr: `${input.customerName} (${input.phone})`,
        en: `${input.customerName} (${input.phone})`,
      },
      linkUrl: `/admin/customers`,
      entityType: 'customer',
      entityId: customerId,
    });
  }

  const orderNumber = await generateOrderNumber(db, input.storeId);
  const initialStatus: OrderStatus =
    input.paymentMethod === 'COD' ? 'PENDING_WHATSAPP_CONFIRMATION' : 'NEW';

  const [createdOrder] = await db
    .insert(orders)
    .values({
      storeId: input.storeId,
      orderNumber,
      customerId: input.authenticatedCustomerId || customerId,
      checkoutType: input.checkoutType,
      landingPageId: input.landingPageId || null,
      locale: input.locale,
      customerName: input.customerName,
      customerEmail: input.customerEmail || null,
      phone: input.phone,
      normalizedPhone: phoneCheck.normalized,
      whatsappNumber: whatsappCheck.normalized,
      cityId: shippingQuote.cityId,
      cityName: shippingQuote.cityName || input.cityName || '',
      regionName: shippingQuote.regionName,
      shippingAddress: input.shippingAddress,
      customFields: input.customFields || {},
      customerNotes: input.customerNotes || null,
      currency: settings?.defaultCurrency || 'MAD',
      subtotal: subtotal.toFixed(2),
      discountAmount: discountAmount.toFixed(2),
      couponCode: appliedCouponCode,
      shippingFee: shippingFee.toFixed(2),
      codFee: codFee.toFixed(2),
      taxAmount: taxAmount.toFixed(2),
      totalAmount: totalAmount.toFixed(2),
      paymentMethod: input.paymentMethod,
      paymentStatus: 'PENDING',
      orderStatus: initialStatus,
      ipAddress: input.ipAddress,
      userAgent: input.userAgent,
    })
    .returning();

  const insertedItems = await db
    .insert(orderItems)
    .values(
      preparedItems.map((item) => ({
        storeId: input.storeId,
        orderId: createdOrder.id,
        productId: item.productId,
        variantId: item.variantId,
        productType: item.productType,
        productTitle: item.productTitle,
        variantTitle: item.variantTitle,
        sku: item.sku,
        imageUrl: item.imageUrl,
        unitPrice: item.unitPrice.toFixed(2),
        quantity: item.quantity,
        lineTotal: item.lineTotal.toFixed(2),
      }))
    )
    .returning();

  await db.insert(orderStatusHistory).values({
    storeId: input.storeId,
    orderId: createdOrder.id,
    fromStatus: null,
    toStatus: initialStatus,
    note: `Order created via ${input.checkoutType} (${input.paymentMethod})`,
    changedBy: 'customer',
  });

  // Update product sales counts & landing page conversion counter
  for (const item of preparedItems) {
    await db
      .update(products)
      .set({ salesCount: sql`${products.salesCount} + ${item.quantity}` })
      .where(and(eq(products.storeId, input.storeId), eq(products.id, item.productId)));
  }

  if (input.landingPageId) {
    await db
      .update(landingPages)
      .set({ ordersCount: sql`${landingPages.ordersCount} + 1` })
      .where(and(eq(landingPages.storeId, input.storeId), eq(landingPages.id, input.landingPageId)));
  }

  // Deduct stock immediately if store inventory rule is ON_ORDER_CREATED
  const deductMode = settings?.inventoryConfig?.deductOnStatus || 'ON_CONFIRMED';
  if (deductMode === 'ON_ORDER_CREATED') {
    await deductOrderStock(db, {
      storeId: input.storeId,
      orderId: createdOrder.id,
      reason: 'ORDER_CREATED',
      actorEmail: 'checkout',
    });
  }

  // Clear shopping cart if ordered via Cart
  if (input.checkoutType === 'CART' && input.cartToken) {
    const cartRows = await db
      .select({ id: carts.id })
      .from(carts)
      .where(and(eq(carts.storeId, input.storeId), eq(carts.cartToken, input.cartToken)))
      .limit(1);
    if (cartRows.length > 0) {
      await db
        .delete(cartItems)
        .where(and(eq(cartItems.storeId, input.storeId), eq(cartItems.cartId, cartRows[0].id)));
      await db
        .update(carts)
        .set({ couponCode: null, updatedAt: new Date() })
        .where(and(eq(carts.storeId, input.storeId), eq(carts.id, cartRows[0].id)));
    }
  }

  // Initiate Payment Gateway Checkout
  const paymentAction = await initiateOrderPayment(db, {
    storeId: input.storeId,
    orderId: createdOrder.id,
    orderNumber: createdOrder.orderNumber,
    gatewayCode: input.paymentMethod,
    baseAmountMad: totalAmount,
    customerName: input.customerName,
    customerEmail: input.customerEmail,
    phone: input.phone,
    locale: input.locale,
    baseUrl: input.baseUrl,
  });

  // Build WhatsApp Click-to-Chat link for Thank You confirmation
  const [waCfg] = await db
    .select()
    .from(whatsappConfigs)
    .where(eq(whatsappConfigs.storeId, input.storeId))
    .limit(1);

  let whatsappConfirmUrl: string | null = null;
  const targetStoreWa = waCfg?.defaultPhone || settings?.whatsappNumber;
  if (targetStoreWa && (waCfg?.clickToChatEnabled ?? true)) {
    const langKey = input.locale === 'fr' ? 'fr' : input.locale === 'en' ? 'en' : 'ar';
    const tpl =
      waCfg?.templates?.[langKey]?.customer_order_confirmation ||
      DEFAULT_WHATSAPP_TEMPLATES[langKey].customer_order_confirmation;
    const storeName =
      settings?.storeNameI18n?.[langKey] ||
      settings?.storeNameI18n?.ar ||
      'Nabat Al Atlas';
    const itemsText = insertedItems
      .map((i) => `- ${i.productTitle}${i.variantTitle ? ` (${i.variantTitle})` : ''} x${i.quantity}`)
      .join('\n');

    const renderedMsg = renderWhatsAppTemplate(tpl, {
      order_number: createdOrder.orderNumber,
      store_name: storeName,
      customer_name: createdOrder.customerName,
      city: createdOrder.cityName,
      total: createdOrder.totalAmount,
      currency: settings?.currencySymbols?.[langKey] || createdOrder.currency,
      items: itemsText,
    });
    whatsappConfirmUrl = buildClickToChatUrl(targetStoreWa, renderedMsg);
  }

  // Real-time SSE Admin Notification
  await createTenantNotification(db, {
    storeId: input.storeId,
    type: 'NEW_ORDER',
    titleI18n: {
      ar: `طلب جديد #${createdOrder.orderNumber}`,
      fr: `Nouvelle commande #${createdOrder.orderNumber}`,
      en: `New Order #${createdOrder.orderNumber}`,
    },
    messageI18n: {
      ar: `${createdOrder.customerName} — ${createdOrder.cityName} — ${createdOrder.totalAmount} د.م.`,
      fr: `${createdOrder.customerName} — ${createdOrder.cityName} — ${createdOrder.totalAmount} DH`,
      en: `${createdOrder.customerName} — ${createdOrder.cityName} — ${createdOrder.totalAmount} MAD`,
    },
    linkUrl: `/admin/orders?order=${createdOrder.id}`,
    entityType: 'order',
    entityId: createdOrder.id,
  });

  // Fire Purchase CAPI immediately only for COD (online gateways fire CAPI upon verified webhook payment!)
  if (input.paymentMethod === 'COD' && input.trackingEventId) {
    void enqueueJob({
      name: 'send-meta-capi',
      tenantId: input.storeId,
      eventName: 'Purchase',
      eventId: input.trackingEventId,
      clientIp: input.ipAddress,
      userAgent: input.userAgent,
      email: input.customerEmail,
      phone: phoneCheck.normalized,
      value: totalAmount,
      currency: 'MAD',
      orderNumber: createdOrder.orderNumber,
      contentIds: productIds,
    });
  }

  return {
    order: createdOrder,
    items: insertedItems,
    paymentAction,
    whatsappConfirmUrl,
  };
}

/**
 * Transitions an order status across the 11 supported lifecycle statuses,
 * handling automatic stock deduction/restoration, digital download provisioning,
 * audit logs, and status history.
 */
export async function updateOrderStatus(
  db: TenantDb,
  params: {
    storeId: string;
    orderId: string;
    newStatus: OrderStatus;
    paymentStatus?: PaymentStatus;
    trackingNumber?: string | null;
    internalNotes?: string | null;
    note?: string;
    actorEmail: string;
  }
): Promise<typeof orders.$inferSelect> {
  const { storeId, orderId, newStatus, actorEmail } = params;

  const existingRows = await db
    .select()
    .from(orders)
    .where(and(eq(orders.storeId, storeId), eq(orders.id, orderId)))
    .limit(1);

  if (existingRows.length === 0) {
    throw new Error('ORDER_NOT_FOUND');
  }
  const existing = existingRows[0];

  const [settings] = await db
    .select()
    .from(storeSettings)
    .where(eq(storeSettings.storeId, storeId))
    .limit(1);

  const deductOnStatus = settings?.inventoryConfig?.deductOnStatus || 'ON_CONFIRMED';
  const restoreOnCancel = settings?.inventoryConfig?.restoreOnCancel ?? true;

  // Deduct stock when entering active fulfillment states
  const fulfillmentStates: OrderStatus[] = [
    'CONFIRMED',
    'PROCESSING',
    'READY_FOR_SHIPPING',
    'SHIPPED',
    'OUT_FOR_DELIVERY',
    'DELIVERED',
  ];

  if (
    !existing.stockDeducted &&
    fulfillmentStates.includes(newStatus) &&
    deductOnStatus === 'ON_CONFIRMED'
  ) {
    await deductOrderStock(db, {
      storeId,
      orderId,
      reason: 'ORDER_CONFIRMATION',
      actorEmail,
    });
  }

  // Restore stock if cancelled/returned
  if (
    existing.stockDeducted &&
    restoreOnCancel &&
    (newStatus === 'CANCELLED' || newStatus === 'RETURNED' || newStatus === 'REFUNDED')
  ) {
    await restoreOrderStock(db, {
      storeId,
      orderId,
      reason: newStatus === 'RETURNED' ? 'ORDER_RETURN' : 'ORDER_CANCELLATION',
      actorEmail,
    });
  }

  const nextPaymentStatus = params.paymentStatus || existing.paymentStatus;
  const now = new Date();

  const [updated] = await db
    .update(orders)
    .set({
      orderStatus: newStatus,
      paymentStatus: nextPaymentStatus,
      trackingNumber:
        params.trackingNumber !== undefined ? params.trackingNumber : existing.trackingNumber,
      internalNotes:
        params.internalNotes !== undefined ? params.internalNotes : existing.internalNotes,
      shippedAt: newStatus === 'SHIPPED' && !existing.shippedAt ? now : existing.shippedAt,
      deliveredAt: newStatus === 'DELIVERED' && !existing.deliveredAt ? now : existing.deliveredAt,
      cancelledAt: newStatus === 'CANCELLED' && !existing.cancelledAt ? now : existing.cancelledAt,
      updatedAt: now,
    })
    .where(and(eq(orders.storeId, storeId), eq(orders.id, orderId)))
    .returning();

  if (existing.orderStatus !== newStatus) {
    await db.insert(orderStatusHistory).values({
      storeId,
      orderId,
      fromStatus: existing.orderStatus,
      toStatus: newStatus,
      note: params.note || null,
      changedBy: actorEmail,
    });

    if (newStatus === 'CANCELLED') {
      await createTenantNotification(db, {
        storeId,
        type: 'ORDER_CANCELLED',
        titleI18n: {
          ar: `إلغاء الطلب #${existing.orderNumber}`,
          fr: `Commande annulée #${existing.orderNumber}`,
          en: `Order Cancelled #${existing.orderNumber}`,
        },
        messageI18n: {
          ar: `تم إلغاء الطلب بواسطة ${actorEmail}`,
          fr: `Annulée par ${actorEmail}`,
          en: `Cancelled by ${actorEmail}`,
        },
        linkUrl: `/admin/orders?order=${orderId}`,
        entityType: 'order',
        entityId: orderId,
      });
    }
  }

  // Provision digital downloads upon payment confirmation ONLY
  if (nextPaymentStatus === 'PAID') {
    await provisionDigitalDownloadsForOrder(db, {
      storeId,
      orderId,
      customerId: existing.customerId,
    });
  }

  await db.insert(auditLogs).values({
    storeId,
    actorEmail,
    action: 'order.status_updated',
    entityType: 'order',
    entityId: orderId,
    metadata: {
      fromStatus: existing.orderStatus,
      toStatus: newStatus,
      paymentStatus: nextPaymentStatus,
    },
  });

  return updated;
}
