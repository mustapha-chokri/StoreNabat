import {
  pgTable,
  uuid,
  varchar,
  text,
  boolean,
  integer,
  jsonb,
  timestamp,
  index,
  uniqueIndex,
} from 'drizzle-orm/pg-core';
import type { I18nMap, LandingPageSection } from '../types';

export const landingPages = pgTable(
  'landing_pages',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    storeId: uuid('store_id').notNull(),
    productId: uuid('product_id'),
    slug: varchar('slug', { length: 160 }).notNull(),
    titleI18n: jsonb('title_i18n').$type<I18nMap>().notNull(),
    isPublished: boolean('is_published').notNull().default(false),
    showHeader: boolean('show_header').notNull().default(false),
    showFooter: boolean('show_footer').notNull().default(false),
    sections: jsonb('sections').$type<LandingPageSection[]>().notNull().default([]),
    seoI18n: jsonb('seo_i18n')
      .$type<Record<string, { metaTitle?: string; metaDescription?: string; ogImage?: string }>>()
      .notNull()
      .default({}),
    customPixels: jsonb('custom_pixels')
      .$type<{
        metaPixelId?: string;
        tiktokPixelId?: string;
        ga4MeasurementId?: string;
        gtmContainerId?: string;
        customHeadHtml?: string;
      }>()
      .notNull()
      .default({}),
    viewsCount: integer('views_count').notNull().default(0),
    ordersCount: integer('orders_count').notNull().default(0),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    uniqueIndex('uq_landing_pages_store_slug').on(table.storeId, table.slug),
    index('idx_landing_pages_store_product').on(table.storeId, table.productId),
  ]
);

export const thankYouRules = pgTable(
  'thank_you_rules',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    storeId: uuid('store_id').notNull(),
    name: varchar('name', { length: 120 }).notNull(),
    paymentMethodFilter: varchar('payment_method_filter', { length: 30 }).notNull().default('ALL'),
    orderStatusFilter: varchar('order_status_filter', { length: 40 }).notNull().default('ALL'),
    titleI18n: jsonb('title_i18n').$type<I18nMap>().notNull(),
    messageI18n: jsonb('message_i18n').$type<I18nMap>().notNull(),
    mediaUrl: text('media_url'),
    mediaType: varchar('media_type', { length: 20 }),
    showOrderSummary: boolean('show_order_summary').notNull().default(true),
    showWhatsappButton: boolean('show_whatsapp_button').notNull().default(true),
    showTrackingLink: boolean('show_tracking_link').notNull().default(true),
    showSocialLinks: boolean('show_social_links').notNull().default(true),
    upsellProductIds: jsonb('upsell_product_ids').$type<string[]>().notNull().default([]),
    customHtml: text('custom_html'),
    priority: integer('priority').notNull().default(0),
    isActive: boolean('is_active').notNull().default(true),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [index('idx_thank_you_rules_store_priority').on(table.storeId, table.priority)]
);

export const trackingConfigs = pgTable(
  'tracking_configs',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    storeId: uuid('store_id').notNull(),
    metaPixelId: varchar('meta_pixel_id', { length: 80 }),
    metaCapiEnabled: boolean('meta_capi_enabled').notNull().default(false),
    encryptedMetaCapiToken: text('encrypted_meta_capi_token'),
    metaTestEventCode: varchar('meta_test_event_code', { length: 80 }),
    tiktokPixelId: varchar('tiktok_pixel_id', { length: 80 }),
    ga4MeasurementId: varchar('ga4_measurement_id', { length: 80 }),
    gtmContainerId: varchar('gtm_container_id', { length: 80 }),
    googleAdsId: varchar('google_ads_id', { length: 80 }),
    googleAdsConversionLabel: varchar('google_ads_conversion_label', { length: 120 }),
    customScriptsHead: text('custom_scripts_head'),
    customScriptsBody: text('custom_scripts_body'),
    requireConsent: boolean('require_consent').notNull().default(false),
    updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [uniqueIndex('uq_tracking_configs_store_id').on(table.storeId)]
);

export const whatsappConfigs = pgTable(
  'whatsapp_configs',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    storeId: uuid('store_id').notNull(),
    defaultPhone: varchar('default_phone', { length: 40 }),
    clickToChatEnabled: boolean('click_to_chat_enabled').notNull().default(true),
    templates: jsonb('templates')
      .$type<Record<string, Record<string, string>>>()
      .notNull()
      .default({}),
    cloudApiEnabled: boolean('cloud_api_enabled').notNull().default(false),
    cloudPhoneNumberId: varchar('cloud_phone_number_id', { length: 120 }),
    cloudWabaId: varchar('cloud_waba_id', { length: 120 }),
    encryptedCloudAccessToken: text('encrypted_cloud_access_token'),
    updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [uniqueIndex('uq_whatsapp_configs_store_id').on(table.storeId)]
);

export const whatsappLogs = pgTable(
  'whatsapp_logs',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    storeId: uuid('store_id').notNull(),
    orderId: uuid('order_id'),
    channel: varchar('channel', { length: 30 }).notNull(),
    recipientPhone: varchar('recipient_phone', { length: 40 }).notNull(),
    templateKey: varchar('template_key', { length: 80 }),
    messageContent: text('message_content').notNull(),
    status: varchar('status', { length: 30 }).notNull().default('GENERATED'),
    providerMessageId: varchar('provider_message_id', { length: 150 }),
    errorMessage: text('error_message'),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [index('idx_whatsapp_logs_store_order').on(table.storeId, table.orderId, table.createdAt)]
);

