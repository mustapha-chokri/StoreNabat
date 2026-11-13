export type SupportedLocale = string; // 'ar' | 'fr' | 'en' | extensible

export type I18nMap = Record<string, string>;

export type TenantIsolationMode = 'SHARED' | 'DEDICATED';
export type TenantStatus = 'ACTIVE' | 'SUSPENDED' | 'PROVISIONING' | 'MIGRATING';

export type ProductType = 'PHYSICAL' | 'DIGITAL' | 'SERVICE' | 'SUBSCRIPTION' | 'BUNDLE';

export type OrderStatus =
  | 'NEW'
  | 'PENDING_WHATSAPP_CONFIRMATION'
  | 'CONFIRMED'
  | 'PROCESSING'
  | 'READY_FOR_SHIPPING'
  | 'SHIPPED'
  | 'OUT_FOR_DELIVERY'
  | 'DELIVERED'
  | 'CANCELLED'
  | 'RETURNED'
  | 'REFUNDED';

export type PaymentMethod = 'COD' | 'STRIPE' | 'PAYPAL' | 'CMI';
export type PaymentStatus =
  | 'PENDING'
  | 'AUTHORIZED'
  | 'PAID'
  | 'FAILED'
  | 'REFUNDED'
  | 'PARTIALLY_REFUNDED';

export type AdminRole = 'OWNER' | 'ADMIN' | 'MANAGER' | 'CONFIRMATOR' | 'EDITOR';

export interface ProductSpecificationItem {
  key: string;
  value: string;
}

export interface VariantOptionDefinition {
  id: string;
  nameI18n: I18nMap;
  values: Array<{
    value: string;
    labelI18n: I18nMap;
    colorHex?: string;
  }>;
}

export interface CustomCheckoutField {
  id: string;
  key: string;
  labelI18n: I18nMap;
  type: 'text' | 'textarea' | 'select' | 'checkbox';
  required: boolean;
  enabled: boolean;
  options?: Array<{ value: string; labelI18n: I18nMap }>;
}

export interface CheckoutConfiguration {
  cartEnabled: boolean;
  quickOrderEnabled: boolean;
  defaultExperience: 'BOTH' | 'QUICK_ORDER' | 'CART';
  phoneValidationMode: 'MOROCCO_SMART' | 'INTERNATIONAL';
  requireEmail: boolean;
  requireAddress: boolean;
  requireCity: boolean;
  requireNotes: boolean;
  customFields: CustomCheckoutField[];
  buttonTextI18n: I18nMap;
  confirmationMessageI18n: I18nMap;
}

export interface InventoryConfiguration {
  deductOnStatus: 'ON_ORDER_CREATED' | 'ON_CONFIRMED';
  restoreOnCancel: boolean;
  allowBackordersDefault: boolean;
  lowStockThresholdDefault: number;
}

export interface SocialLinksConfig {
  facebook?: string;
  instagram?: string;
  tiktok?: string;
  youtube?: string;
  whatsapp?: string;
  twitter?: string;
  snapchat?: string;
}

export interface AnnouncementBarConfig {
  enabled: boolean;
  textI18n: I18nMap;
  linkUrl?: string;
  bgColor?: string;
  textColor?: string;
  countdownEndAt?: string | null;
}

export interface MenuItemConfig {
  id: string;
  labelI18n: I18nMap;
  url: string;
  openInNewTab?: boolean;
  children?: MenuItemConfig[];
}

export type LandingSectionType =
  | 'HERO'
  | 'IMAGE_BANNER'
  | 'PRODUCT_PRESENTATION'
  | 'BENEFITS'
  | 'GALLERY_VIDEO'
  | 'TESTIMONIALS'
  | 'FAQ'
  | 'PROMO_OFFER'
  | 'COUNTDOWN'
  | 'PRICING_BUNDLES'
  | 'QUICK_ORDER_FORM';

export interface LandingPageSection {
  id: string;
  type: LandingSectionType;
  enabled: boolean;
  sortOrder: number;
  titleI18n?: I18nMap;
  subtitleI18n?: I18nMap;
  content: Record<string, unknown>;
}

