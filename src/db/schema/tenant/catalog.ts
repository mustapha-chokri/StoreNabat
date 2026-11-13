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
  I18nMap,
  ProductSpecificationItem,
  ProductType,
  VariantOptionDefinition,
} from '../types';

export const categories = pgTable(
  'categories',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    storeId: uuid('store_id').notNull(),
    parentId: uuid('parent_id'),
    slug: varchar('slug', { length: 160 }).notNull(),
    nameI18n: jsonb('name_i18n').$type<I18nMap>().notNull(),
    descriptionI18n: jsonb('description_i18n').$type<I18nMap>().notNull().default({}),
    imageUrl: text('image_url'),
    isFeatured: boolean('is_featured').notNull().default(false),
    sortOrder: integer('sort_order').notNull().default(0),
    isActive: boolean('is_active').notNull().default(true),
    seoI18n: jsonb('seo_i18n').$type<Record<string, { title?: string; description?: string }>>().notNull().default({}),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    uniqueIndex('uq_categories_store_slug').on(table.storeId, table.slug),
    index('idx_categories_store_parent').on(table.storeId, table.parentId),
  ]
);

export const products = pgTable(
  'products',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    storeId: uuid('store_id').notNull(),
    categoryId: uuid('category_id').references(() => categories.id, { onDelete: 'set null' }),
    productType: varchar('product_type', { length: 30 }).$type<ProductType>().notNull().default('PHYSICAL'),
    slug: varchar('slug', { length: 180 }).notNull(),
    titleI18n: jsonb('title_i18n').$type<I18nMap>().notNull(),
    shortDescriptionI18n: jsonb('short_description_i18n').$type<I18nMap>().notNull().default({}),
    descriptionI18n: jsonb('description_i18n').$type<I18nMap>().notNull().default({}),
    specificationsI18n: jsonb('specifications_i18n')
      .$type<Record<string, ProductSpecificationItem[]>>()
      .notNull()
      .default({}),
    regularPrice: numeric('regular_price', { precision: 12, scale: 2 }).notNull(),
    salePrice: numeric('sale_price', { precision: 12, scale: 2 }),
    discountType: varchar('discount_type', { length: 20 }),
    discountValue: numeric('discount_value', { precision: 12, scale: 2 }),
    promoStartsAt: timestamp('promo_starts_at', { withTimezone: true }),
    promoEndsAt: timestamp('promo_ends_at', { withTimezone: true }),
    sku: varchar('sku', { length: 100 }),
    barcode: varchar('barcode', { length: 100 }),
    trackInventory: boolean('track_inventory').notNull().default(true),
    stockQuantity: integer('stock_quantity').notNull().default(0),
    lowStockThreshold: integer('low_stock_threshold').notNull().default(5),
    allowBackorders: boolean('allow_backorders').notNull().default(false),
    hasVariants: boolean('has_variants').notNull().default(false),
    variantOptions: jsonb('variant_options').$type<VariantOptionDefinition[]>().notNull().default([]),
    requiresShipping: boolean('requires_shipping').notNull().default(true),
    shippingConfig: jsonb('shipping_config')
      .$type<{ weightKg?: number; freeShipping?: boolean; extraShippingFee?: number }>()
      .notNull()
      .default({}),
    subscriptionConfig: jsonb('subscription_config')
      .$type<{ interval?: 'MONTHLY' | 'QUARTERLY' | 'YEARLY'; durationLabelI18n?: I18nMap }>()
      .default({}),
    isPublished: boolean('is_published').notNull().default(true),
    isFeatured: boolean('is_featured').notNull().default(false),
    isBestSeller: boolean('is_best_seller').notNull().default(false),
    isNewArrival: boolean('is_new_arrival').notNull().default(false),
    badgeI18n: jsonb('badge_i18n').$type<I18nMap>(),
    salesCount: integer('sales_count').notNull().default(0),
    averageRating: numeric('average_rating', { precision: 3, scale: 2 }).notNull().default('0.00'),
    reviewsCount: integer('reviews_count').notNull().default(0),
    frequentlyBoughtTogetherIds: jsonb('frequently_bought_together_ids').$type<string[]>().notNull().default([]),
    relatedProductIds: jsonb('related_product_ids').$type<string[]>().notNull().default([]),
    seoI18n: jsonb('seo_i18n')
      .$type<Record<string, { metaTitle?: string; metaDescription?: string; ogImage?: string }>>()
      .notNull()
      .default({}),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    uniqueIndex('uq_products_store_slug').on(table.storeId, table.slug),
    index('idx_products_store_published').on(table.storeId, table.isPublished, table.categoryId),
    index('idx_products_store_flags').on(table.storeId, table.isFeatured, table.isBestSeller, table.isNewArrival),
  ]
);

export const productMedia = pgTable(
  'product_media',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    storeId: uuid('store_id').notNull(),
    productId: uuid('product_id')
      .notNull()
      .references(() => products.id, { onDelete: 'cascade' }),
    mediaType: varchar('media_type', { length: 20 }).notNull().default('IMAGE'),
    url: text('url').notNull(),
    altI18n: jsonb('alt_i18n').$type<I18nMap>().notNull().default({}),
    sortOrder: integer('sort_order').notNull().default(0),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [index('idx_product_media_store_product').on(table.storeId, table.productId, table.sortOrder)]
);

export const productVariants = pgTable(
  'product_variants',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    storeId: uuid('store_id').notNull(),
    productId: uuid('product_id')
      .notNull()
      .references(() => products.id, { onDelete: 'cascade' }),
    titleI18n: jsonb('title_i18n').$type<I18nMap>().notNull(),
    optionValues: jsonb('option_values').$type<Record<string, string>>().notNull().default({}),
    sku: varchar('sku', { length: 100 }),
    barcode: varchar('barcode', { length: 100 }),
    regularPrice: numeric('regular_price', { precision: 12, scale: 2 }).notNull(),
    salePrice: numeric('sale_price', { precision: 12, scale: 2 }),
    stockQuantity: integer('stock_quantity').notNull().default(0),
    imageUrl: text('image_url'),
    isDefault: boolean('is_default').notNull().default(false),
    isActive: boolean('is_active').notNull().default(true),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [index('idx_product_variants_store_product').on(table.storeId, table.productId)]
);

export const productBundleItems = pgTable(
  'product_bundle_items',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    storeId: uuid('store_id').notNull(),
    bundleProductId: uuid('bundle_product_id')
      .notNull()
      .references(() => products.id, { onDelete: 'cascade' }),
    itemProductId: uuid('item_product_id')
      .notNull()
      .references(() => products.id, { onDelete: 'cascade' }),
    itemVariantId: uuid('item_variant_id'),
    quantity: integer('quantity').notNull().default(1),
  },
  (table) => [index('idx_bundle_items_store_bundle').on(table.storeId, table.bundleProductId)]
);

export const digitalFiles = pgTable(
  'digital_files',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    storeId: uuid('store_id').notNull(),
    productId: uuid('product_id')
      .notNull()
      .references(() => products.id, { onDelete: 'cascade' }),
    fileName: varchar('file_name', { length: 255 }).notNull(),
    storageKey: text('storage_key').notNull(),
    mimeType: varchar('mime_type', { length: 120 }).notNull(),
    fileSizeBytes: integer('file_size_bytes').notNull(),
    maxDownloads: integer('max_downloads'),
    expiryDays: integer('expiry_days'),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [index('idx_digital_files_store_product').on(table.storeId, table.productId)]
);

export const digitalDownloads = pgTable(
  'digital_downloads',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    storeId: uuid('store_id').notNull(),
    orderId: uuid('order_id').notNull(),
    orderItemId: uuid('order_item_id').notNull(),
    digitalFileId: uuid('digital_file_id')
      .notNull()
      .references(() => digitalFiles.id, { onDelete: 'cascade' }),
    customerId: uuid('customer_id'),
    accessToken: varchar('access_token', { length: 128 }).notNull().unique(),
    downloadCount: integer('download_count').notNull().default(0),
    maxDownloads: integer('max_downloads'),
    expiresAt: timestamp('expires_at', { withTimezone: true }),
    isRevoked: boolean('is_revoked').notNull().default(false),
    lastDownloadedAt: timestamp('last_downloaded_at', { withTimezone: true }),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    index('idx_digital_downloads_store_order').on(table.storeId, table.orderId),
    index('idx_digital_downloads_store_customer').on(table.storeId, table.customerId),
  ]
);

export const productReviews = pgTable(
  'product_reviews',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    storeId: uuid('store_id').notNull(),
    productId: uuid('product_id')
      .notNull()
      .references(() => products.id, { onDelete: 'cascade' }),
    customerId: uuid('customer_id'),
    customerName: varchar('customer_name', { length: 160 }).notNull(),
    rating: integer('rating').notNull(),
    title: varchar('title', { length: 200 }),
    comment: text('comment').notNull(),
    isVerifiedPurchase: boolean('is_verified_purchase').notNull().default(false),
    status: varchar('status', { length: 20 }).notNull().default('PENDING'),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [index('idx_product_reviews_store_product').on(table.storeId, table.productId, table.status)]
);

export const inventoryMovements = pgTable(
  'inventory_movements',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    storeId: uuid('store_id').notNull(),
    productId: uuid('product_id')
      .notNull()
      .references(() => products.id, { onDelete: 'cascade' }),
    variantId: uuid('variant_id'),
    orderId: uuid('order_id'),
    changeAmount: integer('change_amount').notNull(),
    previousQuantity: integer('previous_quantity').notNull(),
    newQuantity: integer('new_quantity').notNull(),
    reason: varchar('reason', { length: 60 }).notNull(),
    note: text('note'),
    actorEmail: varchar('actor_email', { length: 255 }),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    index('idx_inventory_movements_store_product').on(table.storeId, table.productId, table.createdAt),
    index('idx_inventory_movements_store_order').on(table.storeId, table.orderId),
  ]
);

