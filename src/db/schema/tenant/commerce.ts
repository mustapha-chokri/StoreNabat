import {
  pgTable,
  uuid,
  varchar,
  text,
  boolean,
  integer,
  numeric,
  jsonb,
  timestamp,
  index,
  uniqueIndex,
} from 'drizzle-orm/pg-core';
import type { I18nMap, OrderStatus, PaymentMethod, PaymentStatus } from '../types';

export const shippingZones = pgTable(
  'shipping_zones',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    storeId: uuid('store_id').notNull(),
    nameI18n: jsonb('name_i18n').$type<I18nMap>().notNull(),
    defaultFee: numeric('default_fee', { precision: 10, scale: 2 }).notNull().default('35.00'),
    codFee: numeric('cod_fee', { precision: 10, scale: 2 }).notNull().default('0.00'),
    freeShippingThreshold: numeric('free_shipping_threshold', { precision: 10, scale: 2 }),
    estimatedDaysI18n: jsonb('estimated_days_i18n')
      .$type<I18nMap>()
      .notNull()
      .default({ ar: '24 - 48 ساعة', fr: '24 - 48h', en: '24 - 48h' }),
    codEnabled: boolean('cod_enabled').notNull().default(true),
    isActive: boolean('is_active').notNull().default(true),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [index('idx_shipping_zones_store_id').on(table.storeId)]
);

export const shippingCities = pgTable(
  'shipping_cities',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    storeId: uuid('store_id').notNull(),
    zoneId: uuid('zone_id').references(() => shippingZones.id, { onDelete: 'set null' }),
    regionCode: varchar('region_code', { length: 50 }).notNull(),
    regionNameI18n: jsonb('region_name_i18n').$type<I18nMap>().notNull(),
    cityNameI18n: jsonb('city_name_i18n').$type<I18nMap>().notNull(),
    deliveryFee: numeric('delivery_fee', { precision: 10, scale: 2 }).notNull().default('35.00'),
    codFee: numeric('cod_fee', { precision: 10, scale: 2 }).notNull().default('0.00'),
    codEnabled: boolean('cod_enabled').notNull().default(true),
    freeShippingMinOrder: numeric('free_shipping_min_order', { precision: 10, scale: 2 }),
    estimatedDaysI18n: jsonb('estimated_days_i18n')
      .$type<I18nMap>()
      .notNull()
      .default({ ar: '24 - 48 ساعة', fr: '24 - 48h', en: '24 - 48h' }),
    isActive: boolean('is_active').notNull().default(true),
    sortOrder: integer('sort_order').notNull().default(0),
  },
  (table) => [
    index('idx_shipping_cities_store_active').on(table.storeId, table.isActive, table.sortOrder),
    index('idx_shipping_cities_store_region').on(table.storeId, table.regionCode),
  ]
);

export const shippingProviders = pgTable(
  'shipping_providers',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    storeId: uuid('store_id').notNull(),
    code: varchar('code', { length: 50 }).notNull(),
    name: varchar('name', { length: 120 }).notNull(),
    isEnabled: boolean('is_enabled').notNull().default(false),
    encryptedCredentials: text('encrypted_credentials'),
    config: jsonb('config').$type<Record<string, unknown>>().notNull().default({}),
    updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [uniqueIndex('uq_shipping_providers_store_code').on(table.storeId, table.code)]
);

export const customers = pgTable(
  'customers',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    storeId: uuid('store_id').notNull(),
    fullName: varchar('full_name', { length: 160 }).notNull(),
    email: varchar('email', { length: 255 }),
    phone: varchar('phone', { length: 40 }).notNull(),
    normalizedPhone: varchar('normalized_phone', { length: 30 }).notNull(),
    whatsappNumber: varchar('whatsapp_number', { length: 40 }),
    passwordHash: text('password_hash'),
    isGuest: boolean('is_guest').notNull().default(true),
    isBlacklisted: boolean('is_blacklisted').notNull().default(false),
    blacklistReason: text('blacklist_reason'),
    segmentTags: jsonb('segment_tags').$type<string[]>().notNull().default([]),
    notes: text('notes'),
    ordersCount: integer('orders_count').notNull().default(0),
    totalSpent: numeric('total_spent', { precision: 12, scale: 2 }).notNull().default('0.00'),
    lastOrderAt: timestamp('last_order_at', { withTimezone: true }),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    index('idx_customers_store_phone').on(table.storeId, table.normalizedPhone),
    index('idx_customers_store_email').on(table.storeId, table.email),
    index('idx_customers_store_blacklisted').on(table.storeId, table.isBlacklisted),
  ]
);

export const customerAddresses = pgTable(
  'customer_addresses',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    storeId: uuid('store_id').notNull(),
    customerId: uuid('customer_id')
      .notNull()
      .references(() => customers.id, { onDelete: 'cascade' }),
    label: varchar('label', { length: 80 }).notNull().default('Home'),
    cityId: uuid('city_id'),
    cityName: varchar('city_name', { length: 120 }).notNull(),
    regionName: varchar('region_name', { length: 120 }),
    addressLine: text('address_line').notNull(),
    postalCode: varchar('postal_code', { length: 20 }),
    isDefault: boolean('is_default').notNull().default(false),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [index('idx_customer_addresses_store_customer').on(table.storeId, table.customerId)]
);

export const customerSessions = pgTable(
  'customer_sessions',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    storeId: uuid('store_id').notNull(),
    customerId: uuid('customer_id')
      .notNull()
      .references(() => customers.id, { onDelete: 'cascade' }),
    tokenHash: varchar('token_hash', { length: 128 }).notNull().unique(),
    expiresAt: timestamp('expires_at', { withTimezone: true }).notNull(),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [index('idx_customer_sessions_store_customer').on(table.storeId, table.customerId)]
);

export const passwordResetTokens = pgTable(
  'password_reset_tokens',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    storeId: uuid('store_id').notNull(),
    userType: varchar('user_type', { length: 20 }).notNull(), // CUSTOMER | ADMIN
    userId: uuid('user_id').notNull(),
    tokenHash: varchar('token_hash', { length: 128 }).notNull().unique(),
    expiresAt: timestamp('expires_at', { withTimezone: true }).notNull(),
    usedAt: timestamp('used_at', { withTimezone: true }),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [index('idx_password_reset_store_user').on(table.storeId, table.userId)]
);

export const coupons = pgTable(
  'coupons',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    storeId: uuid('store_id').notNull(),
    code: varchar('code', { length: 60 }).notNull(),
    discountType: varchar('discount_type', { length: 20 }).notNull(), // PERCENT | FIXED | FREE_SHIPPING
    discountValue: numeric('discount_value', { precision: 10, scale: 2 }).notNull(),
    minOrderAmount: numeric('min_order_amount', { precision: 10, scale: 2 }),
    maxUses: integer('max_uses'),
    usedCount: integer('used_count').notNull().default(0),
    startsAt: timestamp('starts_at', { withTimezone: true }),
    endsAt: timestamp('ends_at', { withTimezone: true }),
    isActive: boolean('is_active').notNull().default(true),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [uniqueIndex('uq_coupons_store_code').on(table.storeId, table.code)]
);

export const carts = pgTable(
  'carts',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    storeId: uuid('store_id').notNull(),
    cartToken: varchar('cart_token', { length: 128 }).notNull(),
    customerId: uuid('customer_id'),
    couponCode: varchar('coupon_code', { length: 60 }),
    updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [uniqueIndex('uq_carts_store_token').on(table.storeId, table.cartToken)]
);

export const cartItems = pgTable(
  'cart_items',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    storeId: uuid('store_id').notNull(),
    cartId: uuid('cart_id')
      .notNull()
      .references(() => carts.id, { onDelete: 'cascade' }),
    productId: uuid('product_id').notNull(),
    variantId: uuid('variant_id'),
    quantity: integer('quantity').notNull().default(1),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [index('idx_cart_items_store_cart').on(table.storeId, table.cartId)]
);

export const orders = pgTable(
  'orders',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    storeId: uuid('store_id').notNull(),
    orderNumber: varchar('order_number', { length: 50 }).notNull(),
    customerId: uuid('customer_id').references(() => customers.id, { onDelete: 'set null' }),
    checkoutType: varchar('checkout_type', { length: 30 }).notNull().default('QUICK_ORDER'),
    landingPageId: uuid('landing_page_id'),
    locale: varchar('locale', { length: 10 }).notNull().default('ar'),
    customerName: varchar('customer_name', { length: 160 }).notNull(),
    customerEmail: varchar('customer_email', { length: 255 }),
    phone: varchar('phone', { length: 40 }).notNull(),
    normalizedPhone: varchar('normalized_phone', { length: 30 }).notNull(),
    whatsappNumber: varchar('whatsapp_number', { length: 40 }),
    cityId: uuid('city_id'),
    cityName: varchar('city_name', { length: 120 }).notNull(),
    regionName: varchar('region_name', { length: 120 }),
    shippingAddress: text('shipping_address').notNull(),
    customFields: jsonb('custom_fields').$type<Record<string, unknown>>().notNull().default({}),
    customerNotes: text('customer_notes'),
    internalNotes: text('internal_notes'),
    currency: varchar('currency', { length: 10 }).notNull().default('MAD'),
    subtotal: numeric('subtotal', { precision: 12, scale: 2 }).notNull(),
    discountAmount: numeric('discount_amount', { precision: 12, scale: 2 }).notNull().default('0.00'),
    couponCode: varchar('coupon_code', { length: 60 }),
    shippingFee: numeric('shipping_fee', { precision: 12, scale: 2 }).notNull().default('0.00'),
    codFee: numeric('cod_fee', { precision: 12, scale: 2 }).notNull().default('0.00'),
    taxAmount: numeric('tax_amount', { precision: 12, scale: 2 }).notNull().default('0.00'),
    totalAmount: numeric('total_amount', { precision: 12, scale: 2 }).notNull(),
    paymentMethod: varchar('payment_method', { length: 30 }).$type<PaymentMethod>().notNull().default('COD'),
    paymentStatus: varchar('payment_status', { length: 30 }).$type<PaymentStatus>().notNull().default('PENDING'),
    orderStatus: varchar('order_status', { length: 40 }).$type<OrderStatus>().notNull().default('NEW'),
    whatsappConfirmationStatus: varchar('whatsapp_confirmation_status', { length: 40 })
      .notNull()
      .default('NOT_SENT'),
    whatsappConfirmedAt: timestamp('whatsapp_confirmed_at', { withTimezone: true }),
    stockDeducted: boolean('stock_deducted').notNull().default(false),
    trackingNumber: varchar('tracking_number', { length: 120 }),
    shippingProviderCode: varchar('shipping_provider_code', { length: 50 }).notNull().default('MANUAL'),
    shippedAt: timestamp('shipped_at', { withTimezone: true }),
    deliveredAt: timestamp('delivered_at', { withTimezone: true }),
    cancelledAt: timestamp('cancelled_at', { withTimezone: true }),
    ipAddress: varchar('ip_address', { length: 64 }),
    userAgent: text('user_agent'),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    uniqueIndex('uq_orders_store_number').on(table.storeId, table.orderNumber),
    index('idx_orders_store_status').on(table.storeId, table.orderStatus, table.createdAt),
    index('idx_orders_store_phone').on(table.storeId, table.normalizedPhone),
    index('idx_orders_store_customer').on(table.storeId, table.customerId),
  ]
);

export const orderItems = pgTable(
  'order_items',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    storeId: uuid('store_id').notNull(),
    orderId: uuid('order_id')
      .notNull()
      .references(() => orders.id, { onDelete: 'cascade' }),
    productId: uuid('product_id'),
    variantId: uuid('variant_id'),
    productType: varchar('product_type', { length: 30 }).notNull(),
    productTitle: varchar('product_title', { length: 255 }).notNull(),
    variantTitle: varchar('variant_title', { length: 255 }),
    sku: varchar('sku', { length: 100 }),
    imageUrl: text('image_url'),
    unitPrice: numeric('unit_price', { precision: 12, scale: 2 }).notNull(),
    quantity: integer('quantity').notNull(),
    lineTotal: numeric('line_total', { precision: 12, scale: 2 }).notNull(),
  },
  (table) => [index('idx_order_items_store_order').on(table.storeId, table.orderId)]
);

export const orderStatusHistory = pgTable(
  'order_status_history',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    storeId: uuid('store_id').notNull(),
    orderId: uuid('order_id')
      .notNull()
      .references(() => orders.id, { onDelete: 'cascade' }),
    fromStatus: varchar('from_status', { length: 40 }),
    toStatus: varchar('to_status', { length: 40 }).notNull(),
    note: text('note'),
    changedBy: varchar('changed_by', { length: 150 }).notNull().default('system'),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [index('idx_order_history_store_order').on(table.storeId, table.orderId, table.createdAt)]
);

export const paymentGatewayConfigs = pgTable(
  'payment_gateway_configs',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    storeId: uuid('store_id').notNull(),
    gatewayCode: varchar('gateway_code', { length: 30 }).notNull(),
    isEnabled: boolean('is_enabled').notNull().default(false),
    mode: varchar('mode', { length: 20 }).notNull().default('TEST'),
    displayNameI18n: jsonb('display_name_i18n').$type<I18nMap>().notNull().default({}),
    instructionsI18n: jsonb('instructions_i18n').$type<I18nMap>().notNull().default({}),
    publicConfig: jsonb('public_config').$type<Record<string, unknown>>().notNull().default({}),
    encryptedSecrets: text('encrypted_secrets'),
    updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [uniqueIndex('uq_payment_gateway_store_code').on(table.storeId, table.gatewayCode)]
);

export const paymentTransactions = pgTable(
  'payment_transactions',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    storeId: uuid('store_id').notNull(),
    orderId: uuid('order_id')
      .notNull()
      .references(() => orders.id, { onDelete: 'cascade' }),
    gatewayCode: varchar('gateway_code', { length: 30 }).notNull(),
    externalTransactionId: varchar('external_transaction_id', { length: 200 }).unique(),
    idempotencyKey: varchar('idempotency_key', { length: 120 }).notNull().unique(),
    status: varchar('status', { length: 30 }).notNull().default('INITIATED'),
    baseCurrency: varchar('base_currency', { length: 10 }).notNull().default('MAD'),
    baseAmount: numeric('base_amount', { precision: 12, scale: 2 }).notNull(),
    chargeCurrency: varchar('charge_currency', { length: 10 }).notNull().default('MAD'),
    chargeAmount: numeric('charge_amount', { precision: 12, scale: 2 }).notNull(),
    exchangeRateUsed: numeric('exchange_rate_used', { precision: 12, scale: 6 }).notNull().default('1.000000'),
    rawResponse: jsonb('raw_response').$type<Record<string, unknown>>().notNull().default({}),
    failureReason: text('failure_reason'),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    index('idx_payment_tx_store_order').on(table.storeId, table.orderId),
    index('idx_payment_tx_store_status').on(table.storeId, table.status),
  ]
);

export const webhookLogs = pgTable(
  'webhook_logs',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    storeId: uuid('store_id').notNull(),
    provider: varchar('provider', { length: 40 }).notNull(),
    eventId: varchar('event_id', { length: 200 }),
    eventType: varchar('event_type', { length: 120 }),
    signatureValid: boolean('signature_valid').notNull().default(false),
    payload: jsonb('payload').$type<Record<string, unknown>>().notNull().default({}),
    processingStatus: varchar('processing_status', { length: 30 }).notNull().default('RECEIVED'),
    errorMessage: text('error_message'),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [index('idx_webhook_logs_store_provider').on(table.storeId, table.provider, table.createdAt)]
);
