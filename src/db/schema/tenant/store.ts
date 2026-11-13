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
import type {
  AnnouncementBarConfig,
  CheckoutConfiguration,
  I18nMap,
  InventoryConfiguration,
  MenuItemConfig,
  SocialLinksConfig,
} from '../types';

export const storeSettings = pgTable(
  'store_settings',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    storeId: uuid('store_id').notNull(),
    storeNameI18n: jsonb('store_name_i18n').$type<I18nMap>().notNull(),
    storeDescriptionI18n: jsonb('store_description_i18n').$type<I18nMap>().notNull().default({}),
    logoUrl: text('logo_url'),
    faviconUrl: text('favicon_url'),
    email: varchar('email', { length: 255 }),
    phone: varchar('phone', { length: 50 }),
    whatsappNumber: varchar('whatsapp_number', { length: 50 }),
    addressI18n: jsonb('address_i18n').$type<I18nMap>().notNull().default({}),
    defaultLanguage: varchar('default_language', { length: 10 }).notNull().default('ar'),
    supportedLanguages: jsonb('supported_languages').$type<string[]>().notNull().default(['ar', 'fr', 'en']),
    defaultCurrency: varchar('default_currency', { length: 10 }).notNull().default('MAD'),
    currencySymbols: jsonb('currency_symbols')
      .$type<Record<string, string>>()
      .notNull()
      .default({ ar: 'د.م.', fr: 'DH', en: 'MAD' }),
    currencyPosition: varchar('currency_position', { length: 10 }).notNull().default('after'),
    timezone: varchar('timezone', { length: 80 }).notNull().default('Africa/Casablanca'),
    taxEnabled: boolean('tax_enabled').notNull().default(true),
    taxInclusive: boolean('tax_inclusive').notNull().default(true),
    taxRatePercent: numeric('tax_rate_percent', { precision: 5, scale: 2 }).notNull().default('20.00'),
    taxLabelI18n: jsonb('tax_label_i18n')
      .$type<I18nMap>()
      .notNull()
      .default({ ar: 'الضريبة (شاملة)', fr: 'TVA incluse', en: 'VAT included' }),
    checkoutConfig: jsonb('checkout_config').$type<CheckoutConfiguration>().notNull(),
    inventoryConfig: jsonb('inventory_config').$type<InventoryConfiguration>().notNull(),
    socialLinks: jsonb('social_links').$type<SocialLinksConfig>().notNull().default({}),
    announcementBar: jsonb('announcement_bar').$type<AnnouncementBarConfig>().notNull(),
    seoDefaults: jsonb('seo_defaults').$type<Record<string, unknown>>().notNull().default({}),
    encryptedSmtpConfig: text('encrypted_smtp_config'),
    updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [uniqueIndex('uq_store_settings_store_id').on(table.storeId)]
);

export const storeThemes = pgTable(
  'store_themes',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    storeId: uuid('store_id').notNull(),
    presetName: varchar('preset_name', { length: 80 }).notNull().default('botanical-luxury'),
    primaryColor: varchar('primary_color', { length: 30 }).notNull().default('#14532D'),
    secondaryColor: varchar('secondary_color', { length: 30 }).notNull().default('#D97706'),
    backgroundColor: varchar('background_color', { length: 30 }).notNull().default('#FAF9F6'),
    surfaceColor: varchar('surface_color', { length: 30 }).notNull().default('#FFFFFF'),
    textColor: varchar('text_color', { length: 30 }).notNull().default('#1C1917'),
    headingFontAr: varchar('heading_font_ar', { length: 120 }).notNull().default('IBM Plex Sans Arabic'),
    headingFontLatin: varchar('heading_font_latin', { length: 120 }).notNull().default('Plus Jakarta Sans'),
    buttonStyle: varchar('button_style', { length: 30 }).notNull().default('rounded-xl'),
    headerStyle: varchar('header_style', { length: 30 }).notNull().default('sticky-centered'),
    footerStyle: varchar('footer_style', { length: 30 }).notNull().default('multi-column'),
    darkModeEnabled: boolean('dark_mode_enabled').notNull().default(false),
    layoutConfig: jsonb('layout_config').$type<Record<string, unknown>>().notNull().default({}),
    customCss: text('custom_css'),
    updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [uniqueIndex('uq_store_themes_store_id').on(table.storeId)]
);

export const storeTranslations = pgTable(
  'store_translations',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    storeId: uuid('store_id').notNull(),
    locale: varchar('locale', { length: 10 }).notNull(),
    localeName: varchar('locale_name', { length: 60 }).notNull(),
    direction: varchar('direction', { length: 3 }).notNull().default('ltr'),
    isActive: boolean('is_active').notNull().default(true),
    overrides: jsonb('overrides').$type<Record<string, string>>().notNull().default({}),
    updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    uniqueIndex('uq_store_translations_store_locale').on(table.storeId, table.locale),
    index('idx_store_translations_store_id').on(table.storeId),
  ]
);

export const storeMenus = pgTable(
  'store_menus',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    storeId: uuid('store_id').notNull(),
    location: varchar('location', { length: 40 }).notNull(),
    items: jsonb('items').$type<MenuItemConfig[]>().notNull().default([]),
    updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    uniqueIndex('uq_store_menus_store_location').on(table.storeId, table.location),
    index('idx_store_menus_store_id').on(table.storeId),
  ]
);

export const heroSliders = pgTable(
  'hero_sliders',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    storeId: uuid('store_id').notNull(),
    titleI18n: jsonb('title_i18n').$type<I18nMap>().notNull().default({}),
    subtitleI18n: jsonb('subtitle_i18n').$type<I18nMap>().notNull().default({}),
    badgeI18n: jsonb('badge_i18n').$type<I18nMap>().notNull().default({}),
    ctaTextI18n: jsonb('cta_text_i18n').$type<I18nMap>().notNull().default({}),
    ctaUrl: text('cta_url').notNull().default('/shop'),
    desktopImageUrl: text('desktop_image_url').notNull(),
    mobileImageUrl: text('mobile_image_url'),
    sortOrder: integer('sort_order').notNull().default(0),
    isActive: boolean('is_active').notNull().default(true),
    startsAt: timestamp('starts_at', { withTimezone: true }),
    endsAt: timestamp('ends_at', { withTimezone: true }),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [index('idx_hero_sliders_store_order').on(table.storeId, table.sortOrder)]
);

export const homepageSections = pgTable(
  'homepage_sections',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    storeId: uuid('store_id').notNull(),
    sectionType: varchar('section_type', { length: 50 }).notNull(),
    titleI18n: jsonb('title_i18n').$type<I18nMap>().notNull().default({}),
    subtitleI18n: jsonb('subtitle_i18n').$type<I18nMap>().notNull().default({}),
    config: jsonb('config').$type<Record<string, unknown>>().notNull().default({}),
    sortOrder: integer('sort_order').notNull().default(0),
    isEnabled: boolean('is_enabled').notNull().default(true),
    startsAt: timestamp('starts_at', { withTimezone: true }),
    endsAt: timestamp('ends_at', { withTimezone: true }),
    updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [index('idx_homepage_sections_store_order').on(table.storeId, table.sortOrder)]
);

