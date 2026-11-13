CREATE SCHEMA "control_plane";
--> statement-breakpoint
CREATE TABLE "control_plane"."platform_audit_logs" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"tenant_id" uuid,
	"actor" varchar(150) NOT NULL,
	"action" varchar(120) NOT NULL,
	"details" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"ip_address" varchar(64),
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "control_plane"."tenant_domains" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"tenant_id" uuid NOT NULL,
	"domain" varchar(255) NOT NULL,
	"is_primary" boolean DEFAULT false NOT NULL,
	"is_verified" boolean DEFAULT false NOT NULL,
	"ssl_status" varchar(30) DEFAULT 'PENDING' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "tenant_domains_domain_unique" UNIQUE("domain")
);
--> statement-breakpoint
CREATE TABLE "control_plane"."tenant_migrations_log" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"tenant_id" uuid NOT NULL,
	"direction" varchar(40) NOT NULL,
	"status" varchar(30) NOT NULL,
	"backup_path" text,
	"row_counts_source" jsonb,
	"row_counts_target" jsonb,
	"checksums" jsonb,
	"error_message" text,
	"started_by" varchar(150) DEFAULT 'system' NOT NULL,
	"started_at" timestamp with time zone DEFAULT now() NOT NULL,
	"completed_at" timestamp with time zone
);
--> statement-breakpoint
CREATE TABLE "control_plane"."tenants" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"slug" varchar(100) NOT NULL,
	"name" varchar(200) NOT NULL,
	"status" varchar(30) DEFAULT 'ACTIVE' NOT NULL,
	"isolation_mode" varchar(20) DEFAULT 'SHARED' NOT NULL,
	"encrypted_db_url" text,
	"db_name" varchar(120),
	"db_host" varchar(255),
	"db_port" integer,
	"db_provisioning_status" varchar(30) DEFAULT 'READY' NOT NULL,
	"migration_version" varchar(50) DEFAULT '0001' NOT NULL,
	"plan_tier" varchar(50) DEFAULT 'STANDALONE' NOT NULL,
	"feature_flags" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"usage_limits" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"is_default" boolean DEFAULT false NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "tenants_slug_unique" UNIQUE("slug")
);
--> statement-breakpoint
CREATE TABLE "hero_sliders" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"store_id" uuid NOT NULL,
	"title_i18n" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"subtitle_i18n" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"badge_i18n" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"cta_text_i18n" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"cta_url" text DEFAULT '/shop' NOT NULL,
	"desktop_image_url" text NOT NULL,
	"mobile_image_url" text,
	"sort_order" integer DEFAULT 0 NOT NULL,
	"is_active" boolean DEFAULT true NOT NULL,
	"starts_at" timestamp with time zone,
	"ends_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "homepage_sections" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"store_id" uuid NOT NULL,
	"section_type" varchar(50) NOT NULL,
	"title_i18n" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"subtitle_i18n" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"config" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"sort_order" integer DEFAULT 0 NOT NULL,
	"is_enabled" boolean DEFAULT true NOT NULL,
	"starts_at" timestamp with time zone,
	"ends_at" timestamp with time zone,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "store_menus" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"store_id" uuid NOT NULL,
	"location" varchar(40) NOT NULL,
	"items" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "store_settings" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"store_id" uuid NOT NULL,
	"store_name_i18n" jsonb NOT NULL,
	"store_description_i18n" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"logo_url" text,
	"favicon_url" text,
	"email" varchar(255),
	"phone" varchar(50),
	"whatsapp_number" varchar(50),
	"address_i18n" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"default_language" varchar(10) DEFAULT 'ar' NOT NULL,
	"supported_languages" jsonb DEFAULT '["ar","fr","en"]'::jsonb NOT NULL,
	"default_currency" varchar(10) DEFAULT 'MAD' NOT NULL,
	"currency_symbols" jsonb DEFAULT '{"ar":"د.م.","fr":"DH","en":"MAD"}'::jsonb NOT NULL,
	"currency_position" varchar(10) DEFAULT 'after' NOT NULL,
	"timezone" varchar(80) DEFAULT 'Africa/Casablanca' NOT NULL,
	"tax_enabled" boolean DEFAULT true NOT NULL,
	"tax_inclusive" boolean DEFAULT true NOT NULL,
	"tax_rate_percent" numeric(5, 2) DEFAULT '20.00' NOT NULL,
	"tax_label_i18n" jsonb DEFAULT '{"ar":"الضريبة (شاملة)","fr":"TVA incluse","en":"VAT included"}'::jsonb NOT NULL,
	"checkout_config" jsonb NOT NULL,
	"inventory_config" jsonb NOT NULL,
	"social_links" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"announcement_bar" jsonb NOT NULL,
	"seo_defaults" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"encrypted_smtp_config" text,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "store_themes" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"store_id" uuid NOT NULL,
	"preset_name" varchar(80) DEFAULT 'botanical-luxury' NOT NULL,
	"primary_color" varchar(30) DEFAULT '#14532D' NOT NULL,
	"secondary_color" varchar(30) DEFAULT '#D97706' NOT NULL,
	"background_color" varchar(30) DEFAULT '#FAF9F6' NOT NULL,
	"surface_color" varchar(30) DEFAULT '#FFFFFF' NOT NULL,
	"text_color" varchar(30) DEFAULT '#1C1917' NOT NULL,
	"heading_font_ar" varchar(120) DEFAULT 'IBM Plex Sans Arabic' NOT NULL,
	"heading_font_latin" varchar(120) DEFAULT 'Plus Jakarta Sans' NOT NULL,
	"button_style" varchar(30) DEFAULT 'rounded-xl' NOT NULL,
	"header_style" varchar(30) DEFAULT 'sticky-centered' NOT NULL,
	"footer_style" varchar(30) DEFAULT 'multi-column' NOT NULL,
	"dark_mode_enabled" boolean DEFAULT false NOT NULL,
	"layout_config" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"custom_css" text,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "store_translations" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"store_id" uuid NOT NULL,
	"locale" varchar(10) NOT NULL,
	"locale_name" varchar(60) NOT NULL,
	"direction" varchar(3) DEFAULT 'ltr' NOT NULL,
	"is_active" boolean DEFAULT true NOT NULL,
	"overrides" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "admin_sessions" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"store_id" uuid NOT NULL,
	"admin_user_id" uuid NOT NULL,
	"token_hash" varchar(128) NOT NULL,
	"ip_address" varchar(64),
	"user_agent" text,
	"expires_at" timestamp with time zone NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "admin_sessions_token_hash_unique" UNIQUE("token_hash")
);
--> statement-breakpoint
CREATE TABLE "admin_users" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"store_id" uuid NOT NULL,
	"email" varchar(255) NOT NULL,
	"password_hash" text NOT NULL,
	"full_name" varchar(160) NOT NULL,
	"role" varchar(40) DEFAULT 'EDITOR' NOT NULL,
	"permissions" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"preferred_locale" varchar(10) DEFAULT 'ar' NOT NULL,
	"is_active" boolean DEFAULT true NOT NULL,
	"last_login_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "audit_logs" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"store_id" uuid NOT NULL,
	"admin_user_id" uuid,
	"actor_email" varchar(255),
	"action" varchar(120) NOT NULL,
	"entity_type" varchar(60),
	"entity_id" varchar(100),
	"metadata" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"ip_address" varchar(64),
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "notifications" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"store_id" uuid NOT NULL,
	"type" varchar(50) NOT NULL,
	"title_i18n" jsonb NOT NULL,
	"message_i18n" jsonb NOT NULL,
	"link_url" text,
	"entity_type" varchar(50),
	"entity_id" varchar(100),
	"is_read" boolean DEFAULT false NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "categories" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"store_id" uuid NOT NULL,
	"parent_id" uuid,
	"slug" varchar(160) NOT NULL,
	"name_i18n" jsonb NOT NULL,
	"description_i18n" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"image_url" text,
	"is_featured" boolean DEFAULT false NOT NULL,
	"sort_order" integer DEFAULT 0 NOT NULL,
	"is_active" boolean DEFAULT true NOT NULL,
	"seo_i18n" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "digital_downloads" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"store_id" uuid NOT NULL,
	"order_id" uuid NOT NULL,
	"order_item_id" uuid NOT NULL,
	"digital_file_id" uuid NOT NULL,
	"customer_id" uuid,
	"access_token" varchar(128) NOT NULL,
	"download_count" integer DEFAULT 0 NOT NULL,
	"max_downloads" integer,
	"expires_at" timestamp with time zone,
	"is_revoked" boolean DEFAULT false NOT NULL,
	"last_downloaded_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "digital_downloads_access_token_unique" UNIQUE("access_token")
);
--> statement-breakpoint
CREATE TABLE "digital_files" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"store_id" uuid NOT NULL,
	"product_id" uuid NOT NULL,
	"file_name" varchar(255) NOT NULL,
	"storage_key" text NOT NULL,
	"mime_type" varchar(120) NOT NULL,
	"file_size_bytes" integer NOT NULL,
	"max_downloads" integer,
	"expiry_days" integer,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "inventory_movements" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"store_id" uuid NOT NULL,
	"product_id" uuid NOT NULL,
	"variant_id" uuid,
	"order_id" uuid,
	"change_amount" integer NOT NULL,
	"previous_quantity" integer NOT NULL,
	"new_quantity" integer NOT NULL,
	"reason" varchar(60) NOT NULL,
	"note" text,
	"actor_email" varchar(255),
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "product_bundle_items" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"store_id" uuid NOT NULL,
	"bundle_product_id" uuid NOT NULL,
	"item_product_id" uuid NOT NULL,
	"item_variant_id" uuid,
	"quantity" integer DEFAULT 1 NOT NULL
);
--> statement-breakpoint
CREATE TABLE "product_media" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"store_id" uuid NOT NULL,
	"product_id" uuid NOT NULL,
	"media_type" varchar(20) DEFAULT 'IMAGE' NOT NULL,
	"url" text NOT NULL,
	"alt_i18n" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"sort_order" integer DEFAULT 0 NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "product_reviews" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"store_id" uuid NOT NULL,
	"product_id" uuid NOT NULL,
	"customer_id" uuid,
	"customer_name" varchar(160) NOT NULL,
	"rating" integer NOT NULL,
	"title" varchar(200),
	"comment" text NOT NULL,
	"is_verified_purchase" boolean DEFAULT false NOT NULL,
	"status" varchar(20) DEFAULT 'PENDING' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "product_variants" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"store_id" uuid NOT NULL,
	"product_id" uuid NOT NULL,
	"title_i18n" jsonb NOT NULL,
	"option_values" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"sku" varchar(100),
	"barcode" varchar(100),
	"regular_price" numeric(12, 2) NOT NULL,
	"sale_price" numeric(12, 2),
	"stock_quantity" integer DEFAULT 0 NOT NULL,
	"image_url" text,
	"is_default" boolean DEFAULT false NOT NULL,
	"is_active" boolean DEFAULT true NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "products" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"store_id" uuid NOT NULL,
	"category_id" uuid,
	"product_type" varchar(30) DEFAULT 'PHYSICAL' NOT NULL,
	"slug" varchar(180) NOT NULL,
	"title_i18n" jsonb NOT NULL,
	"short_description_i18n" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"description_i18n" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"specifications_i18n" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"regular_price" numeric(12, 2) NOT NULL,
	"sale_price" numeric(12, 2),
	"discount_type" varchar(20),
	"discount_value" numeric(12, 2),
	"promo_starts_at" timestamp with time zone,
	"promo_ends_at" timestamp with time zone,
	"sku" varchar(100),
	"barcode" varchar(100),
	"track_inventory" boolean DEFAULT true NOT NULL,
	"stock_quantity" integer DEFAULT 0 NOT NULL,
	"low_stock_threshold" integer DEFAULT 5 NOT NULL,
	"allow_backorders" boolean DEFAULT false NOT NULL,
	"has_variants" boolean DEFAULT false NOT NULL,
	"variant_options" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"requires_shipping" boolean DEFAULT true NOT NULL,
	"shipping_config" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"subscription_config" jsonb DEFAULT '{}'::jsonb,
	"is_published" boolean DEFAULT true NOT NULL,
	"is_featured" boolean DEFAULT false NOT NULL,
	"is_best_seller" boolean DEFAULT false NOT NULL,
	"is_new_arrival" boolean DEFAULT false NOT NULL,
	"badge_i18n" jsonb,
	"sales_count" integer DEFAULT 0 NOT NULL,
	"average_rating" numeric(3, 2) DEFAULT '0.00' NOT NULL,
	"reviews_count" integer DEFAULT 0 NOT NULL,
	"frequently_bought_together_ids" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"related_product_ids" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"seo_i18n" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "cart_items" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"store_id" uuid NOT NULL,
	"cart_id" uuid NOT NULL,
	"product_id" uuid NOT NULL,
	"variant_id" uuid,
	"quantity" integer DEFAULT 1 NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "carts" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"store_id" uuid NOT NULL,
	"cart_token" varchar(128) NOT NULL,
	"customer_id" uuid,
	"coupon_code" varchar(60),
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "coupons" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"store_id" uuid NOT NULL,
	"code" varchar(60) NOT NULL,
	"discount_type" varchar(20) NOT NULL,
	"discount_value" numeric(10, 2) NOT NULL,
	"min_order_amount" numeric(10, 2),
	"max_uses" integer,
	"used_count" integer DEFAULT 0 NOT NULL,
	"starts_at" timestamp with time zone,
	"ends_at" timestamp with time zone,
	"is_active" boolean DEFAULT true NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "customer_addresses" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"store_id" uuid NOT NULL,
	"customer_id" uuid NOT NULL,
	"label" varchar(80) DEFAULT 'Home' NOT NULL,
	"city_id" uuid,
	"city_name" varchar(120) NOT NULL,
	"region_name" varchar(120),
	"address_line" text NOT NULL,
	"postal_code" varchar(20),
	"is_default" boolean DEFAULT false NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "customer_sessions" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"store_id" uuid NOT NULL,
	"customer_id" uuid NOT NULL,
	"token_hash" varchar(128) NOT NULL,
	"expires_at" timestamp with time zone NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "customer_sessions_token_hash_unique" UNIQUE("token_hash")
);
--> statement-breakpoint
CREATE TABLE "customers" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"store_id" uuid NOT NULL,
	"full_name" varchar(160) NOT NULL,
	"email" varchar(255),
	"phone" varchar(40) NOT NULL,
	"normalized_phone" varchar(30) NOT NULL,
	"whatsapp_number" varchar(40),
	"password_hash" text,
	"is_guest" boolean DEFAULT true NOT NULL,
	"is_blacklisted" boolean DEFAULT false NOT NULL,
	"blacklist_reason" text,
	"segment_tags" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"notes" text,
	"orders_count" integer DEFAULT 0 NOT NULL,
	"total_spent" numeric(12, 2) DEFAULT '0.00' NOT NULL,
	"last_order_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "order_items" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"store_id" uuid NOT NULL,
	"order_id" uuid NOT NULL,
	"product_id" uuid,
	"variant_id" uuid,
	"product_type" varchar(30) NOT NULL,
	"product_title" varchar(255) NOT NULL,
	"variant_title" varchar(255),
	"sku" varchar(100),
	"image_url" text,
	"unit_price" numeric(12, 2) NOT NULL,
	"quantity" integer NOT NULL,
	"line_total" numeric(12, 2) NOT NULL
);
--> statement-breakpoint
CREATE TABLE "order_status_history" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"store_id" uuid NOT NULL,
	"order_id" uuid NOT NULL,
	"from_status" varchar(40),
	"to_status" varchar(40) NOT NULL,
	"note" text,
	"changed_by" varchar(150) DEFAULT 'system' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "orders" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"store_id" uuid NOT NULL,
	"order_number" varchar(50) NOT NULL,
	"customer_id" uuid,
	"checkout_type" varchar(30) DEFAULT 'QUICK_ORDER' NOT NULL,
	"landing_page_id" uuid,
	"locale" varchar(10) DEFAULT 'ar' NOT NULL,
	"customer_name" varchar(160) NOT NULL,
	"customer_email" varchar(255),
	"phone" varchar(40) NOT NULL,
	"normalized_phone" varchar(30) NOT NULL,
	"whatsapp_number" varchar(40),
	"city_id" uuid,
	"city_name" varchar(120) NOT NULL,
	"region_name" varchar(120),
	"shipping_address" text NOT NULL,
	"custom_fields" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"customer_notes" text,
	"internal_notes" text,
	"currency" varchar(10) DEFAULT 'MAD' NOT NULL,
	"subtotal" numeric(12, 2) NOT NULL,
	"discount_amount" numeric(12, 2) DEFAULT '0.00' NOT NULL,
	"coupon_code" varchar(60),
	"shipping_fee" numeric(12, 2) DEFAULT '0.00' NOT NULL,
	"cod_fee" numeric(12, 2) DEFAULT '0.00' NOT NULL,
	"tax_amount" numeric(12, 2) DEFAULT '0.00' NOT NULL,
	"total_amount" numeric(12, 2) NOT NULL,
	"payment_method" varchar(30) DEFAULT 'COD' NOT NULL,
	"payment_status" varchar(30) DEFAULT 'PENDING' NOT NULL,
	"order_status" varchar(40) DEFAULT 'NEW' NOT NULL,
	"whatsapp_confirmation_status" varchar(40) DEFAULT 'NOT_SENT' NOT NULL,
	"whatsapp_confirmed_at" timestamp with time zone,
	"stock_deducted" boolean DEFAULT false NOT NULL,
	"tracking_number" varchar(120),
	"shipping_provider_code" varchar(50) DEFAULT 'MANUAL' NOT NULL,
	"shipped_at" timestamp with time zone,
	"delivered_at" timestamp with time zone,
	"cancelled_at" timestamp with time zone,
	"ip_address" varchar(64),
	"user_agent" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "password_reset_tokens" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"store_id" uuid NOT NULL,
	"user_type" varchar(20) NOT NULL,
	"user_id" uuid NOT NULL,
	"token_hash" varchar(128) NOT NULL,
	"expires_at" timestamp with time zone NOT NULL,
	"used_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "password_reset_tokens_token_hash_unique" UNIQUE("token_hash")
);
--> statement-breakpoint
CREATE TABLE "payment_gateway_configs" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"store_id" uuid NOT NULL,
	"gateway_code" varchar(30) NOT NULL,
	"is_enabled" boolean DEFAULT false NOT NULL,
	"mode" varchar(20) DEFAULT 'TEST' NOT NULL,
	"display_name_i18n" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"instructions_i18n" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"public_config" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"encrypted_secrets" text,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "payment_transactions" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"store_id" uuid NOT NULL,
	"order_id" uuid NOT NULL,
	"gateway_code" varchar(30) NOT NULL,
	"external_transaction_id" varchar(200),
	"idempotency_key" varchar(120) NOT NULL,
	"status" varchar(30) DEFAULT 'INITIATED' NOT NULL,
	"base_currency" varchar(10) DEFAULT 'MAD' NOT NULL,
	"base_amount" numeric(12, 2) NOT NULL,
	"charge_currency" varchar(10) DEFAULT 'MAD' NOT NULL,
	"charge_amount" numeric(12, 2) NOT NULL,
	"exchange_rate_used" numeric(12, 6) DEFAULT '1.000000' NOT NULL,
	"raw_response" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"failure_reason" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "payment_transactions_external_transaction_id_unique" UNIQUE("external_transaction_id"),
	CONSTRAINT "payment_transactions_idempotency_key_unique" UNIQUE("idempotency_key")
);
--> statement-breakpoint
CREATE TABLE "shipping_cities" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"store_id" uuid NOT NULL,
	"zone_id" uuid,
	"region_code" varchar(50) NOT NULL,
	"region_name_i18n" jsonb NOT NULL,
	"city_name_i18n" jsonb NOT NULL,
	"delivery_fee" numeric(10, 2) DEFAULT '35.00' NOT NULL,
	"cod_fee" numeric(10, 2) DEFAULT '0.00' NOT NULL,
	"cod_enabled" boolean DEFAULT true NOT NULL,
	"free_shipping_min_order" numeric(10, 2),
	"estimated_days_i18n" jsonb DEFAULT '{"ar":"24 - 48 ساعة","fr":"24 - 48h","en":"24 - 48h"}'::jsonb NOT NULL,
	"is_active" boolean DEFAULT true NOT NULL,
	"sort_order" integer DEFAULT 0 NOT NULL
);
--> statement-breakpoint
CREATE TABLE "shipping_providers" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"store_id" uuid NOT NULL,
	"code" varchar(50) NOT NULL,
	"name" varchar(120) NOT NULL,
	"is_enabled" boolean DEFAULT false NOT NULL,
	"encrypted_credentials" text,
	"config" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "shipping_zones" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"store_id" uuid NOT NULL,
	"name_i18n" jsonb NOT NULL,
	"default_fee" numeric(10, 2) DEFAULT '35.00' NOT NULL,
	"cod_fee" numeric(10, 2) DEFAULT '0.00' NOT NULL,
	"free_shipping_threshold" numeric(10, 2),
	"estimated_days_i18n" jsonb DEFAULT '{"ar":"24 - 48 ساعة","fr":"24 - 48h","en":"24 - 48h"}'::jsonb NOT NULL,
	"cod_enabled" boolean DEFAULT true NOT NULL,
	"is_active" boolean DEFAULT true NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "webhook_logs" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"store_id" uuid NOT NULL,
	"provider" varchar(40) NOT NULL,
	"event_id" varchar(200),
	"event_type" varchar(120),
	"signature_valid" boolean DEFAULT false NOT NULL,
	"payload" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"processing_status" varchar(30) DEFAULT 'RECEIVED' NOT NULL,
	"error_message" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "landing_pages" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"store_id" uuid NOT NULL,
	"product_id" uuid,
	"slug" varchar(160) NOT NULL,
	"title_i18n" jsonb NOT NULL,
	"is_published" boolean DEFAULT false NOT NULL,
	"show_header" boolean DEFAULT false NOT NULL,
	"show_footer" boolean DEFAULT false NOT NULL,
	"sections" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"seo_i18n" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"custom_pixels" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"views_count" integer DEFAULT 0 NOT NULL,
	"orders_count" integer DEFAULT 0 NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "thank_you_rules" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"store_id" uuid NOT NULL,
	"name" varchar(120) NOT NULL,
	"payment_method_filter" varchar(30) DEFAULT 'ALL' NOT NULL,
	"order_status_filter" varchar(40) DEFAULT 'ALL' NOT NULL,
	"title_i18n" jsonb NOT NULL,
	"message_i18n" jsonb NOT NULL,
	"media_url" text,
	"media_type" varchar(20),
	"show_order_summary" boolean DEFAULT true NOT NULL,
	"show_whatsapp_button" boolean DEFAULT true NOT NULL,
	"show_tracking_link" boolean DEFAULT true NOT NULL,
	"show_social_links" boolean DEFAULT true NOT NULL,
	"upsell_product_ids" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"custom_html" text,
	"priority" integer DEFAULT 0 NOT NULL,
	"is_active" boolean DEFAULT true NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "tracking_configs" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"store_id" uuid NOT NULL,
	"meta_pixel_id" varchar(80),
	"meta_capi_enabled" boolean DEFAULT false NOT NULL,
	"encrypted_meta_capi_token" text,
	"meta_test_event_code" varchar(80),
	"tiktok_pixel_id" varchar(80),
	"ga4_measurement_id" varchar(80),
	"gtm_container_id" varchar(80),
	"google_ads_id" varchar(80),
	"google_ads_conversion_label" varchar(120),
	"custom_scripts_head" text,
	"custom_scripts_body" text,
	"require_consent" boolean DEFAULT false NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "whatsapp_configs" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"store_id" uuid NOT NULL,
	"default_phone" varchar(40),
	"click_to_chat_enabled" boolean DEFAULT true NOT NULL,
	"templates" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"cloud_api_enabled" boolean DEFAULT false NOT NULL,
	"cloud_phone_number_id" varchar(120),
	"cloud_waba_id" varchar(120),
	"encrypted_cloud_access_token" text,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "whatsapp_logs" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"store_id" uuid NOT NULL,
	"order_id" uuid,
	"channel" varchar(30) NOT NULL,
	"recipient_phone" varchar(40) NOT NULL,
	"template_key" varchar(80),
	"message_content" text NOT NULL,
	"status" varchar(30) DEFAULT 'GENERATED' NOT NULL,
	"provider_message_id" varchar(150),
	"error_message" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "control_plane"."tenant_domains" ADD CONSTRAINT "tenant_domains_tenant_id_tenants_id_fk" FOREIGN KEY ("tenant_id") REFERENCES "control_plane"."tenants"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "control_plane"."tenant_migrations_log" ADD CONSTRAINT "tenant_migrations_log_tenant_id_tenants_id_fk" FOREIGN KEY ("tenant_id") REFERENCES "control_plane"."tenants"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "admin_sessions" ADD CONSTRAINT "admin_sessions_admin_user_id_admin_users_id_fk" FOREIGN KEY ("admin_user_id") REFERENCES "public"."admin_users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "digital_downloads" ADD CONSTRAINT "digital_downloads_digital_file_id_digital_files_id_fk" FOREIGN KEY ("digital_file_id") REFERENCES "public"."digital_files"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "digital_files" ADD CONSTRAINT "digital_files_product_id_products_id_fk" FOREIGN KEY ("product_id") REFERENCES "public"."products"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "inventory_movements" ADD CONSTRAINT "inventory_movements_product_id_products_id_fk" FOREIGN KEY ("product_id") REFERENCES "public"."products"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "product_bundle_items" ADD CONSTRAINT "product_bundle_items_bundle_product_id_products_id_fk" FOREIGN KEY ("bundle_product_id") REFERENCES "public"."products"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "product_bundle_items" ADD CONSTRAINT "product_bundle_items_item_product_id_products_id_fk" FOREIGN KEY ("item_product_id") REFERENCES "public"."products"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "product_media" ADD CONSTRAINT "product_media_product_id_products_id_fk" FOREIGN KEY ("product_id") REFERENCES "public"."products"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "product_reviews" ADD CONSTRAINT "product_reviews_product_id_products_id_fk" FOREIGN KEY ("product_id") REFERENCES "public"."products"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "product_variants" ADD CONSTRAINT "product_variants_product_id_products_id_fk" FOREIGN KEY ("product_id") REFERENCES "public"."products"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "products" ADD CONSTRAINT "products_category_id_categories_id_fk" FOREIGN KEY ("category_id") REFERENCES "public"."categories"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "cart_items" ADD CONSTRAINT "cart_items_cart_id_carts_id_fk" FOREIGN KEY ("cart_id") REFERENCES "public"."carts"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "customer_addresses" ADD CONSTRAINT "customer_addresses_customer_id_customers_id_fk" FOREIGN KEY ("customer_id") REFERENCES "public"."customers"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "customer_sessions" ADD CONSTRAINT "customer_sessions_customer_id_customers_id_fk" FOREIGN KEY ("customer_id") REFERENCES "public"."customers"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "order_items" ADD CONSTRAINT "order_items_order_id_orders_id_fk" FOREIGN KEY ("order_id") REFERENCES "public"."orders"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "order_status_history" ADD CONSTRAINT "order_status_history_order_id_orders_id_fk" FOREIGN KEY ("order_id") REFERENCES "public"."orders"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "orders" ADD CONSTRAINT "orders_customer_id_customers_id_fk" FOREIGN KEY ("customer_id") REFERENCES "public"."customers"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "payment_transactions" ADD CONSTRAINT "payment_transactions_order_id_orders_id_fk" FOREIGN KEY ("order_id") REFERENCES "public"."orders"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "shipping_cities" ADD CONSTRAINT "shipping_cities_zone_id_shipping_zones_id_fk" FOREIGN KEY ("zone_id") REFERENCES "public"."shipping_zones"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "idx_platform_audit_tenant_id" ON "control_plane"."platform_audit_logs" USING btree ("tenant_id");--> statement-breakpoint
CREATE INDEX "idx_tenant_domains_tenant_id" ON "control_plane"."tenant_domains" USING btree ("tenant_id");--> statement-breakpoint
CREATE INDEX "idx_tenant_migrations_tenant_id" ON "control_plane"."tenant_migrations_log" USING btree ("tenant_id");--> statement-breakpoint
CREATE INDEX "idx_tenants_status" ON "control_plane"."tenants" USING btree ("status");--> statement-breakpoint
CREATE INDEX "idx_tenants_is_default" ON "control_plane"."tenants" USING btree ("is_default");--> statement-breakpoint
CREATE INDEX "idx_hero_sliders_store_order" ON "hero_sliders" USING btree ("store_id","sort_order");--> statement-breakpoint
CREATE INDEX "idx_homepage_sections_store_order" ON "homepage_sections" USING btree ("store_id","sort_order");--> statement-breakpoint
CREATE UNIQUE INDEX "uq_store_menus_store_location" ON "store_menus" USING btree ("store_id","location");--> statement-breakpoint
CREATE INDEX "idx_store_menus_store_id" ON "store_menus" USING btree ("store_id");--> statement-breakpoint
CREATE UNIQUE INDEX "uq_store_settings_store_id" ON "store_settings" USING btree ("store_id");--> statement-breakpoint
CREATE UNIQUE INDEX "uq_store_themes_store_id" ON "store_themes" USING btree ("store_id");--> statement-breakpoint
CREATE UNIQUE INDEX "uq_store_translations_store_locale" ON "store_translations" USING btree ("store_id","locale");--> statement-breakpoint
CREATE INDEX "idx_store_translations_store_id" ON "store_translations" USING btree ("store_id");--> statement-breakpoint
CREATE INDEX "idx_admin_sessions_store_user" ON "admin_sessions" USING btree ("store_id","admin_user_id");--> statement-breakpoint
CREATE INDEX "idx_admin_sessions_expires" ON "admin_sessions" USING btree ("expires_at");--> statement-breakpoint
CREATE UNIQUE INDEX "uq_admin_users_store_email" ON "admin_users" USING btree ("store_id","email");--> statement-breakpoint
CREATE INDEX "idx_admin_users_store_id" ON "admin_users" USING btree ("store_id");--> statement-breakpoint
CREATE INDEX "idx_audit_logs_store_created" ON "audit_logs" USING btree ("store_id","created_at");--> statement-breakpoint
CREATE INDEX "idx_notifications_store_unread" ON "notifications" USING btree ("store_id","is_read","created_at");--> statement-breakpoint
CREATE UNIQUE INDEX "uq_categories_store_slug" ON "categories" USING btree ("store_id","slug");--> statement-breakpoint
CREATE INDEX "idx_categories_store_parent" ON "categories" USING btree ("store_id","parent_id");--> statement-breakpoint
CREATE INDEX "idx_digital_downloads_store_order" ON "digital_downloads" USING btree ("store_id","order_id");--> statement-breakpoint
CREATE INDEX "idx_digital_downloads_store_customer" ON "digital_downloads" USING btree ("store_id","customer_id");--> statement-breakpoint
CREATE INDEX "idx_digital_files_store_product" ON "digital_files" USING btree ("store_id","product_id");--> statement-breakpoint
CREATE INDEX "idx_inventory_movements_store_product" ON "inventory_movements" USING btree ("store_id","product_id","created_at");--> statement-breakpoint
CREATE INDEX "idx_inventory_movements_store_order" ON "inventory_movements" USING btree ("store_id","order_id");--> statement-breakpoint
CREATE INDEX "idx_bundle_items_store_bundle" ON "product_bundle_items" USING btree ("store_id","bundle_product_id");--> statement-breakpoint
CREATE INDEX "idx_product_media_store_product" ON "product_media" USING btree ("store_id","product_id","sort_order");--> statement-breakpoint
CREATE INDEX "idx_product_reviews_store_product" ON "product_reviews" USING btree ("store_id","product_id","status");--> statement-breakpoint
CREATE INDEX "idx_product_variants_store_product" ON "product_variants" USING btree ("store_id","product_id");--> statement-breakpoint
CREATE UNIQUE INDEX "uq_products_store_slug" ON "products" USING btree ("store_id","slug");--> statement-breakpoint
CREATE INDEX "idx_products_store_published" ON "products" USING btree ("store_id","is_published","category_id");--> statement-breakpoint
CREATE INDEX "idx_products_store_flags" ON "products" USING btree ("store_id","is_featured","is_best_seller","is_new_arrival");--> statement-breakpoint
CREATE INDEX "idx_cart_items_store_cart" ON "cart_items" USING btree ("store_id","cart_id");--> statement-breakpoint
CREATE UNIQUE INDEX "uq_carts_store_token" ON "carts" USING btree ("store_id","cart_token");--> statement-breakpoint
CREATE UNIQUE INDEX "uq_coupons_store_code" ON "coupons" USING btree ("store_id","code");--> statement-breakpoint
CREATE INDEX "idx_customer_addresses_store_customer" ON "customer_addresses" USING btree ("store_id","customer_id");--> statement-breakpoint
CREATE INDEX "idx_customer_sessions_store_customer" ON "customer_sessions" USING btree ("store_id","customer_id");--> statement-breakpoint
CREATE INDEX "idx_customers_store_phone" ON "customers" USING btree ("store_id","normalized_phone");--> statement-breakpoint
CREATE INDEX "idx_customers_store_email" ON "customers" USING btree ("store_id","email");--> statement-breakpoint
CREATE INDEX "idx_customers_store_blacklisted" ON "customers" USING btree ("store_id","is_blacklisted");--> statement-breakpoint
CREATE INDEX "idx_order_items_store_order" ON "order_items" USING btree ("store_id","order_id");--> statement-breakpoint
CREATE INDEX "idx_order_history_store_order" ON "order_status_history" USING btree ("store_id","order_id","created_at");--> statement-breakpoint
CREATE UNIQUE INDEX "uq_orders_store_number" ON "orders" USING btree ("store_id","order_number");--> statement-breakpoint
CREATE INDEX "idx_orders_store_status" ON "orders" USING btree ("store_id","order_status","created_at");--> statement-breakpoint
CREATE INDEX "idx_orders_store_phone" ON "orders" USING btree ("store_id","normalized_phone");--> statement-breakpoint
CREATE INDEX "idx_orders_store_customer" ON "orders" USING btree ("store_id","customer_id");--> statement-breakpoint
CREATE INDEX "idx_password_reset_store_user" ON "password_reset_tokens" USING btree ("store_id","user_id");--> statement-breakpoint
CREATE UNIQUE INDEX "uq_payment_gateway_store_code" ON "payment_gateway_configs" USING btree ("store_id","gateway_code");--> statement-breakpoint
CREATE INDEX "idx_payment_tx_store_order" ON "payment_transactions" USING btree ("store_id","order_id");--> statement-breakpoint
CREATE INDEX "idx_payment_tx_store_status" ON "payment_transactions" USING btree ("store_id","status");--> statement-breakpoint
CREATE INDEX "idx_shipping_cities_store_active" ON "shipping_cities" USING btree ("store_id","is_active","sort_order");--> statement-breakpoint
CREATE INDEX "idx_shipping_cities_store_region" ON "shipping_cities" USING btree ("store_id","region_code");--> statement-breakpoint
CREATE UNIQUE INDEX "uq_shipping_providers_store_code" ON "shipping_providers" USING btree ("store_id","code");--> statement-breakpoint
CREATE INDEX "idx_shipping_zones_store_id" ON "shipping_zones" USING btree ("store_id");--> statement-breakpoint
CREATE INDEX "idx_webhook_logs_store_provider" ON "webhook_logs" USING btree ("store_id","provider","created_at");--> statement-breakpoint
CREATE UNIQUE INDEX "uq_landing_pages_store_slug" ON "landing_pages" USING btree ("store_id","slug");--> statement-breakpoint
CREATE INDEX "idx_landing_pages_store_product" ON "landing_pages" USING btree ("store_id","product_id");--> statement-breakpoint
CREATE INDEX "idx_thank_you_rules_store_priority" ON "thank_you_rules" USING btree ("store_id","priority");--> statement-breakpoint
CREATE UNIQUE INDEX "uq_tracking_configs_store_id" ON "tracking_configs" USING btree ("store_id");--> statement-breakpoint
CREATE UNIQUE INDEX "uq_whatsapp_configs_store_id" ON "whatsapp_configs" USING btree ("store_id");--> statement-breakpoint
CREATE INDEX "idx_whatsapp_logs_store_order" ON "whatsapp_logs" USING btree ("store_id","order_id","created_at");