import '@/core/load-env';
import fs from 'node:fs/promises';
import path from 'node:path';
import { eq } from 'drizzle-orm';
import { getControlDb } from '@/db/pools';
import { tenantDomains, tenants } from '@/db/schema/control-plane';
import {
  adminUsers,
  categories,
  coupons,
  digitalFiles,
  heroSliders,
  homepageSections,
  inventoryMovements,
  landingPages,
  paymentGatewayConfigs,
  productBundleItems,
  productMedia,
  productReviews,
  products,
  productVariants,
  shippingCities,
  shippingProviders,
  shippingZones,
  storeMenus,
  storeSettings,
  storeThemes,
  storeTranslations,
  thankYouRules,
  trackingConfigs,
  whatsappConfigs,
} from '@/db/schema/tenant';
import { withTenantDb } from '@/core/tenancy/context';
import type { ResolvedTenant } from '@/core/tenancy/types';
import { hashPassword } from '@/core/crypto';
import { getEnv } from '@/core/env';
import { MOROCCO_CITIES_SEED } from '@/services/shipping/morocco-cities';
import { DEFAULT_WHATSAPP_TEMPLATES } from '@/services/whatsapp';

function buildSamplePdfBuffer(): Buffer {
  const pdfContent = `%PDF-1.4
1 0 obj << /Type /Catalog /Pages 2 0 R >> endobj
2 0 obj << /Type /Pages /Kids [3 0 R] /Count 1 >> endobj
3 0 obj << /Type /Page /Parent 2 0 R /MediaBox [0 0 612 792] /Contents 4 0 R /Resources << /Font << /F1 5 0 R >> >> >> endobj
4 0 obj << /Length 135 >> stream
BT
/F1 18 Tf
72 700 Td
(Nabat Al Atlas - Complete Moroccan Botanical Care Guide) Tj
0 -30 Td
/F1 12 Tf
(Thank you for purchasing this digital guide!) Tj
ET
endstream endobj
5 0 obj << /Type /Font /Subtype /Type1 /BaseFont /Helvetica >> endobj
xref
0 6
0000000000 65535 f 
0000000009 00000 n 
0000000058 00000 n 
0000000115 00000 n 
0000000241 00000 n 
0000000426 00000 n 
trailer << /Size 6 /Root 1 0 R >>
startxref
494
%%EOF`;
  return Buffer.from(pdfContent, 'utf8');
}

async function main() {
  const controlDb = getControlDb();
  const env = getEnv();

  console.log('Seeding Nabat Al Atlas flagship store...');

  let [tenantRow] = await controlDb
    .select()
    .from(tenants)
    .where(eq(tenants.slug, env.defaultTenantSlug))
    .limit(1);

  if (!tenantRow) {
    [tenantRow] = await controlDb
      .insert(tenants)
      .values({
        slug: env.defaultTenantSlug,
        name: 'نبات الأطلس | Nabat Al Atlas',
        status: 'ACTIVE',
        isolationMode: 'SHARED',
        dbProvisioningStatus: 'READY',
        migrationVersion: '0001',
        planTier: 'STANDALONE',
        isDefault: true,
      })
      .returning();
  }

  for (const domain of ['localhost', '127.0.0.1']) {
    await controlDb
      .insert(tenantDomains)
      .values({
        tenantId: tenantRow.id,
        domain,
        isPrimary: domain === 'localhost',
        isVerified: true,
        sslStatus: 'ACTIVE',
      })
      .onConflictDoNothing();
  }

  const resolvedTenant: ResolvedTenant = {
    id: tenantRow.id,
    slug: tenantRow.slug,
    name: tenantRow.name,
    status: 'ACTIVE',
    isolationMode: tenantRow.isolationMode as 'SHARED' | 'DEDICATED',
    encryptedDbUrl: tenantRow.encryptedDbUrl,
    migrationVersion: tenantRow.migrationVersion,
    planTier: tenantRow.planTier,
    isDefault: tenantRow.isDefault,
  };

  await withTenantDb(resolvedTenant, async (db) => {
    const storeId = resolvedTenant.id;

    // 1. Store Settings & Theme
    const existingSettings = await db
      .select({ id: storeSettings.id })
      .from(storeSettings)
      .where(eq(storeSettings.storeId, storeId))
      .limit(1);

    if (existingSettings.length === 0) {
      await db.insert(storeSettings).values({
        storeId,
        storeNameI18n: {
          ar: 'نبات الأطلس',
          fr: 'Nabat Al Atlas',
          en: 'Nabat Al Atlas',
        },
        storeDescriptionI18n: {
          ar: 'منتجات طبيعية مغربية أصيلة، باقات عناية، وأدلة رقمية بجودة عالية وتوصيل لجميع المدن المغربية.',
          fr: 'Produits naturels marocains authentiques, coffrets de soin et guides numériques avec livraison partout au Maroc.',
          en: 'Authentic Moroccan botanical products, care bundles, and digital guides delivered across Morocco.',
        },
        email: 'contact@nabatalatlas.ma',
        phone: '+212 600-112233',
        whatsappNumber: '+212600112233',
        addressI18n: {
          ar: 'شارع محمد السادس، مراكش، المغرب',
          fr: 'Avenue Mohammed VI, Marrakech, Maroc',
          en: 'Avenue Mohammed VI, Marrakech, Morocco',
        },
        defaultLanguage: 'ar',
        supportedLanguages: ['ar', 'fr', 'en'],
        defaultCurrency: 'MAD',
        currencySymbols: { ar: 'د.م.', fr: 'DH', en: 'MAD' },
        currencyPosition: 'after',
        timezone: 'Africa/Casablanca',
        taxEnabled: true,
        taxInclusive: true,
        taxRatePercent: '20.00',
        checkoutConfig: {
          cartEnabled: true,
          quickOrderEnabled: true,
          defaultExperience: 'BOTH',
          phoneValidationMode: 'MOROCCO_SMART',
          requireEmail: false,
          requireAddress: true,
          requireCity: true,
          requireNotes: false,
          customFields: [],
          buttonTextI18n: {
            ar: 'تأكيد الطلب الآن',
            fr: 'Confirmer la commande',
            en: 'Confirm Order Now',
          },
          confirmationMessageI18n: {
            ar: 'شكراً لك! تم تسجيل طلبك بنجاح وسنتواصل معك لتأكيده.',
            fr: 'Merci ! Votre commande a été enregistrée avec succès.',
            en: 'Thank you! Your order has been successfully placed.',
          },
        },
        inventoryConfig: {
          deductOnStatus: 'ON_CONFIRMED',
          restoreOnCancel: true,
          allowBackordersDefault: false,
          lowStockThresholdDefault: 5,
        },
        socialLinks: {
          facebook: 'https://facebook.com/nabatalatlas',
          instagram: 'https://instagram.com/nabatalatlas',
          tiktok: 'https://tiktok.com/@nabatalatlas',
          youtube: 'https://youtube.com/@nabatalatlas',
          whatsapp: 'https://wa.me/212600112233',
        },
        announcementBar: {
          enabled: true,
          textI18n: {
            ar: 'توصيل مجاني ابتداءً من 350 د.م. + الدفع عند الاستلام في جميع مدن المغرب',
            fr: 'Livraison gratuite dès 350 DH + Paiement à la livraison partout au Maroc',
            en: 'Free shipping over 350 MAD + Cash on Delivery across Morocco',
          },
          linkUrl: '/shop',
          bgColor: '#14532D',
          textColor: '#FAF9F6',
          countdownEndAt: null,
        },
        seoDefaults: {
          metaTitleI18n: {
            ar: 'نبات الأطلس | متجر المنتجات الطبيعية المغربية',
            fr: 'Nabat Al Atlas | Boutique Naturelle Marocaine',
            en: 'Nabat Al Atlas | Authentic Moroccan Botanical Store',
          },
          metaDescriptionI18n: {
            ar: 'تسوق زيوت الأركان، العسل الحر، وباقات العناية الطبيعية المغربية مع الدفع عند الاستلام.',
            fr: "Découvrez l'huile d'argan bio, miel du Moyen Atlas et soins marocains.",
            en: 'Shop pure Moroccan argan oil, Atlas thyme honey, bundles, and digital guides.',
          },
        },
      });
    }

    const existingTheme = await db
      .select({ id: storeThemes.id })
      .from(storeThemes)
      .where(eq(storeThemes.storeId, storeId))
      .limit(1);

    if (existingTheme.length === 0) {
      await db.insert(storeThemes).values({
        storeId,
        presetName: 'botanical-luxury',
        primaryColor: '#14532D',
        secondaryColor: '#D97706',
        backgroundColor: '#FAF9F6',
        surfaceColor: '#FFFFFF',
        textColor: '#1C1917',
        headingFontAr: 'IBM Plex Sans Arabic',
        headingFontLatin: 'Plus Jakarta Sans',
        buttonStyle: 'rounded-xl',
        headerStyle: 'sticky-centered',
        footerStyle: 'multi-column',
        darkModeEnabled: false,
      });
    }

    // 2. Supported Locales
    for (const loc of [
      { locale: 'ar', localeName: 'العربية', direction: 'rtl' },
      { locale: 'fr', localeName: 'Français', direction: 'ltr' },
      { locale: 'en', localeName: 'English', direction: 'ltr' },
    ]) {
      await db
        .insert(storeTranslations)
        .values({ storeId, ...loc, isActive: true, overrides: {} })
        .onConflictDoNothing();
    }

    // 3. Store Menus
    await db
      .insert(storeMenus)
      .values({
        storeId,
        location: 'HEADER',
        items: [
          { id: 'home', labelI18n: { ar: 'الرئيسية', fr: 'Accueil', en: 'Home' }, url: '/' },
          { id: 'shop', labelI18n: { ar: 'المتجر', fr: 'Boutique', en: 'Shop' }, url: '/shop' },
          {
            id: 'offers',
            labelI18n: { ar: 'العروض والباقات', fr: 'Offres & Packs', en: 'Offers & Bundles' },
            url: '/lp/argan-atlas-offer',
          },
          {
            id: 'track',
            labelI18n: { ar: 'تتبع الطلب', fr: 'Suivi commande', en: 'Track Order' },
            url: '/track-order',
          },
        ],
      })
      .onConflictDoNothing();

    await db
      .insert(storeMenus)
      .values({
        storeId,
        location: 'FOOTER_COL_1',
        items: [
          { id: 'f-shop', labelI18n: { ar: 'جميع المنتجات', fr: 'Tous les produits', en: 'All Products' }, url: '/shop' },
          { id: 'f-track', labelI18n: { ar: 'تتبع طلبك', fr: 'Suivre ma commande', en: 'Track Order' }, url: '/track-order' },
          { id: 'f-account', labelI18n: { ar: 'حسابي وتنزيلاتي', fr: 'Mon compte', en: 'My Account' }, url: '/account' },
        ],
      })
      .onConflictDoNothing();

    // 4. Hero Sliders & Homepage Sections
    const existingSliders = await db
      .select({ id: heroSliders.id })
      .from(heroSliders)
      .where(eq(heroSliders.storeId, storeId))
      .limit(1);

    if (existingSliders.length === 0) {
      await db.insert(heroSliders).values([
        {
          storeId,
          badgeI18n: { ar: 'أصالة جبال الأطلس 100%', fr: '100% Pur & Naturel', en: '100% Pure Atlas Heritage' },
          titleI18n: {
            ar: 'كنوز الطبيعة المغربية بين يديك',
            fr: "Les Trésors Botaniques de l'Atlas",
            en: 'Pure Moroccan Botanical Treasures',
          },
          subtitleI18n: {
            ar: 'زيوت عضوية، عسل جبلي حر، وباقات عناية فاخرة مع الدفع عند الاستلام والتوصيل السريع لجميع المدن.',
            fr: 'Huile d’argan bio, miel de thym et coffrets bien-être livrés en 24-48h partout au Maroc.',
            en: 'Organic argan oil, wild thyme honey, and care bundles delivered fast with Cash on Delivery.',
          },
          ctaTextI18n: { ar: 'تسوق الآن', fr: 'Découvrir la boutique', en: 'Shop Now' },
          ctaUrl: '/shop',
          desktopImageUrl: '/images/seed/hero-atlas-1.svg',
          mobileImageUrl: '/images/seed/hero-atlas-1.svg',
          sortOrder: 0,
          isActive: true,
        },
        {
          storeId,
          badgeI18n: { ar: 'عرض الباقة المتكاملة', fr: 'Offre Spéciale Pack', en: 'Special Bundle Offer' },
          titleI18n: {
            ar: 'وفر حتى 25% على باقة جمال الأطلس',
            fr: "Économisez 25% sur le Rituel Beauté de l'Atlas",
            en: 'Save 25% on Complete Atlas Ritual Bundle',
          },
          subtitleI18n: {
            ar: 'أركان بكر + غاسول بالأعشاب + صابون النيلة الصحراوية في عرض محدود.',
            fr: 'Argan pur + Ghassoul aux herbes + Savon Nila en édition limitée.',
            en: 'Pure Argan + Herbal Ghassoul + Saharan Nila Soap in one gift box.',
          },
          ctaTextI18n: { ar: 'اطلب العرض السريع', fr: 'Commander le Pack', en: 'Order Bundle' },
          ctaUrl: '/lp/argan-atlas-offer',
          desktopImageUrl: '/images/seed/hero-atlas-2.svg',
          mobileImageUrl: '/images/seed/hero-atlas-2.svg',
          sortOrder: 1,
          isActive: true,
        },
      ]);
    }

    const existingSections = await db
      .select({ id: homepageSections.id })
      .from(homepageSections)
      .where(eq(homepageSections.storeId, storeId))
      .limit(1);

    if (existingSections.length === 0) {
      await db.insert(homepageSections).values([
        {
          storeId,
          sectionType: 'HERO_SLIDER',
          titleI18n: { ar: 'السلايدر الرئيسي', fr: 'Bannière Principale', en: 'Hero Slider' },
          sortOrder: 0,
          isEnabled: true,
          config: {},
        },
        {
          storeId,
          sectionType: 'TRUST_BADGES',
          titleI18n: { ar: 'لماذا نبات الأطلس؟', fr: 'Pourquoi nous choisir ?', en: 'Why Nabat Al Atlas?' },
          sortOrder: 1,
          isEnabled: true,
          config: {},
        },
        {
          storeId,
          sectionType: 'FEATURED_CATEGORIES',
          titleI18n: { ar: 'تسوق حسب الفئة', fr: 'Catégories Populaires', en: 'Shop by Category' },
          subtitleI18n: { ar: 'منتجات فيزيائية، باقات، أدلة رقمية وخدمات', fr: 'Produits physiques, packs, ebooks & services', en: 'Physical goods, bundles, digital guides & subscriptions' },
          sortOrder: 2,
          isEnabled: true,
          config: { limit: 6 },
        },
        {
          storeId,
          sectionType: 'FEATURED_PRODUCTS',
          titleI18n: { ar: 'اختيارات نبات الأطلس المميزة', fr: 'Sélection Vedette', en: 'Featured Selection' },
          sortOrder: 3,
          isEnabled: true,
          config: { limit: 8 },
        },
        {
          storeId,
          sectionType: 'PROMO_OFFERS',
          titleI18n: { ar: 'عروض وتخفيضات محدودة', fr: 'Promotions Limitée', en: 'Limited Time Offers' },
          sortOrder: 4,
          isEnabled: true,
          config: { limit: 4 },
        },
        {
          storeId,
          sectionType: 'BEST_SELLERS',
          titleI18n: { ar: 'الأكثر مبيعاً في المغرب', fr: 'Meilleures Ventes', en: 'Best Sellers' },
          sortOrder: 5,
          isEnabled: true,
          config: { limit: 4 },
        },
        {
          storeId,
          sectionType: 'NEW_ARRIVALS',
          titleI18n: { ar: 'وصل حديثاً', fr: 'Nouveautés', en: 'New Arrivals' },
          sortOrder: 6,
          isEnabled: true,
          config: { limit: 4 },
        },
        {
          storeId,
          sectionType: 'CUSTOMER_REVIEWS',
          titleI18n: { ar: 'آراء زبنائنا الكرام', fr: 'Avis de nos clients', en: 'Customer Reviews' },
          sortOrder: 7,
          isEnabled: true,
          config: {},
        },
      ]);
    }

    // 5. Initial OWNER Admin User
    const adminEmail = process.env.SEED_ADMIN_EMAIL || 'admin@nabatalatlas.ma';
    const adminPassword = process.env.SEED_ADMIN_PASSWORD || 'ChangeMe123!';
    const adminName = process.env.SEED_ADMIN_NAME || 'مدير متجر نبات الأطلس';

    const existingAdmin = await db
      .select({ id: adminUsers.id })
      .from(adminUsers)
      .where(eq(adminUsers.storeId, storeId))
      .limit(1);

    if (existingAdmin.length === 0) {
      const passwordHash = await hashPassword(adminPassword);
      await db.insert(adminUsers).values({
        storeId,
        email: adminEmail.toLowerCase(),
        passwordHash,
        fullName: adminName,
        role: 'OWNER',
        permissions: ['*'],
        preferredLocale: 'ar',
        isActive: true,
      });
    }

    // 6. Shipping Zones & Moroccan Cities
    const existingZones = await db
      .select({ id: shippingZones.id })
      .from(shippingZones)
      .where(eq(shippingZones.storeId, storeId))
      .limit(1);

    if (existingZones.length === 0) {
      const [mainZone] = await db
        .insert(shippingZones)
        .values({
          storeId,
          nameI18n: {
            ar: 'المغرب — التوصيل الوطني السريع',
            fr: 'Maroc — Livraison Nationale Express',
            en: 'Morocco — National Express Delivery',
          },
          defaultFee: '35.00',
          codFee: '0.00',
          freeShippingThreshold: '350.00',
          codEnabled: true,
          isActive: true,
        })
        .returning();

      await db.insert(shippingCities).values(
        MOROCCO_CITIES_SEED.map((c, idx) => ({
          storeId,
          zoneId: mainZone.id,
          regionCode: c.regionCode,
          regionNameI18n: c.regionNameI18n,
          cityNameI18n: c.cityNameI18n,
          deliveryFee: c.deliveryFee,
          codFee: c.codFee,
          codEnabled: true,
          freeShippingMinOrder: '350.00',
          estimatedDaysI18n: c.estimatedDaysI18n,
          isActive: true,
          sortOrder: idx,
        }))
      );

      await db.insert(shippingProviders).values([
        { storeId, code: 'MANUAL', name: 'توصيل يدوي / محلي (Manual Shipping)', isEnabled: true, config: {} },
        { storeId, code: 'AMEEX', name: 'Ameex Delivery (Adapter Ready)', isEnabled: false, config: {} },
        { storeId, code: 'OZONE', name: 'Ozone Express (Adapter Ready)', isEnabled: false, config: {} },
        { storeId, code: 'CATHEDIS', name: 'Cathedis (Adapter Ready)', isEnabled: false, config: {} },
        { storeId, code: 'AMANA', name: 'Amana Poste Maroc (Adapter Ready)', isEnabled: false, config: {} },
      ]);
    }

    // 7. Payment Gateways
    for (const gw of [
      {
        gatewayCode: 'COD',
        isEnabled: true,
        mode: 'LIVE',
        displayNameI18n: {
          ar: 'الدفع عند الاستلام (COD)',
          fr: 'Paiement à la livraison (COD)',
          en: 'Cash on Delivery (COD)',
        },
        instructionsI18n: {
          ar: 'ادفع نقداً للموزع عند استلام طلبك وفحصه.',
          fr: 'Payez en espèces à la réception de votre colis.',
          en: 'Pay in cash when your order arrives.',
        },
        publicConfig: {},
      },
      {
        gatewayCode: 'STRIPE',
        isEnabled: false,
        mode: 'TEST',
        displayNameI18n: {
          ar: 'البطاقة البنكية الدولية (Stripe)',
          fr: 'Carte Bancaire Internationale (Stripe)',
          en: 'Credit / Debit Card (Stripe)',
        },
        instructionsI18n: {
          ar: 'تحويل تلقائي إلى اليورو/الدولار مع دفع آمن عبر Stripe.',
          fr: 'Conversion automatique vers EUR/USD via Stripe Checkout.',
          en: 'Automatic EUR/USD conversion via secure Stripe Checkout.',
        },
        publicConfig: { publishableKey: '', targetCurrency: 'EUR', exchangeRate: 0.092 },
      },
      {
        gatewayCode: 'PAYPAL',
        isEnabled: false,
        mode: 'TEST',
        displayNameI18n: {
          ar: 'باي بال (PayPal)',
          fr: 'PayPal',
          en: 'PayPal',
        },
        instructionsI18n: {
          ar: 'تحويل تلقائي من الدرهم إلى الدولار/اليورو عبر PayPal Sandbox/Live.',
          fr: 'Conversion automatique MAD vers USD/EUR via PayPal.',
          en: 'Automatic MAD to USD/EUR conversion via PayPal.',
        },
        publicConfig: { clientId: '', targetCurrency: 'USD', exchangeRate: 0.1 },
      },
      {
        gatewayCode: 'CMI',
        isEnabled: false,
        mode: 'TEST',
        displayNameI18n: {
          ar: 'البطاقة البنكية المغربية (CMI)',
          fr: 'Carte Bancaire Marocaine (CMI)',
          en: 'Moroccan Bank Card (CMI)',
        },
        instructionsI18n: {
          ar: 'دفع آمن بالدرهم المغربي عبر بوابة CMI البنكية.',
          fr: 'Paiement sécurisé en MAD via CMI.',
          en: 'Secure MAD payment via Moroccan CMI gateway.',
        },
        publicConfig: { merchantId: '', gatewayUrl: '' },
      },
    ]) {
      await db
        .insert(paymentGatewayConfigs)
        .values({ storeId, ...gw })
        .onConflictDoNothing();
    }

    // 8. Categories & Multi-Purpose Catalog
    const existingProducts = await db
      .select({ id: products.id })
      .from(products)
      .where(eq(products.storeId, storeId))
      .limit(1);

    if (existingProducts.length === 0) {
      const [catOils, catHoney, catBundles, catDigital, catServices] = await db
        .insert(categories)
        .values([
          {
            storeId,
            slug: 'natural-oils',
            nameI18n: { ar: 'الزيوت الطبيعية', fr: 'Huiles Naturelles', en: 'Natural Oils' },
            descriptionI18n: { ar: 'زيوت عضوية معصورة على البارد', fr: 'Huiles bio pressées à froid', en: 'Cold-pressed organic oils' },
            imageUrl: '/images/seed/product-argan.svg',
            isFeatured: true,
            sortOrder: 0,
          },
          {
            storeId,
            slug: 'atlas-botanicals',
            nameI18n: { ar: 'أعشاب ومنتجات الأطلس', fr: 'Herbes & Trésors Atlas', en: 'Atlas Botanicals' },
            imageUrl: '/images/seed/product-honey.svg',
            isFeatured: true,
            sortOrder: 1,
          },
          {
            storeId,
            slug: 'care-bundles',
            nameI18n: { ar: 'باقات العناية والتوفير', fr: 'Packs & Coffrets', en: 'Care Bundles' },
            imageUrl: '/images/seed/product-bundle.svg',
            isFeatured: true,
            sortOrder: 2,
          },
          {
            storeId,
            slug: 'digital-guides',
            nameI18n: { ar: 'الأدلة والكتب الرقمية', fr: 'Guides Numériques', en: 'Digital Guides' },
            imageUrl: '/images/seed/product-digital.svg',
            isFeatured: true,
            sortOrder: 3,
          },
          {
            storeId,
            slug: 'subscriptions-services',
            nameI18n: { ar: 'الاشتراكات والخدمات', fr: 'Abonnements & Services', en: 'Subscriptions & Services' },
            imageUrl: '/images/seed/product-botanical.svg',
            isFeatured: true,
            sortOrder: 4,
          },
        ])
        .returning();

      // Product 1: Physical with Variants (Argan Oil)
      const [arganProduct] = await db
        .insert(products)
        .values({
          storeId,
          categoryId: catOils.id,
          productType: 'PHYSICAL',
          slug: 'pure-atlas-argan-oil',
          titleI18n: {
            ar: 'زيت الأركان البكر العضوي الممتاز',
            fr: "Huile d'Argan Bio Vierge Extra",
            en: 'Pure Organic Atlas Argan Oil',
          },
          shortDescriptionI18n: {
            ar: 'معصور على البارد من تعاونيات سوس ماسة 100% خالي من الإضافات.',
            fr: 'Pressée à froid au Souss-Massa, 100% pure et certifiée naturelle.',
            en: 'Cold-pressed in Souss-Massa cooperatives, 100% pure & unrefined.',
          },
          descriptionI18n: {
            ar: 'زيت الأركان التجميلي الأصيل الغني بفيتامين E والأحماض الدهنية الأساسية لترطيب البشرة وتقوية الشعر والأظافر.',
            fr: "Véritable or liquide du Maroc, riche en vitamine E et antioxydants pour sublimer la peau et les cheveux.",
            en: "Morocco's liquid gold rich in Vitamin E and essential fatty acids to nourish skin, hair, and nails.",
          },
          specificationsI18n: {
            ar: [
              { key: 'المصدر', value: 'تارودانت - سوس ماسة، المغرب' },
              { key: 'طريقة العصر', value: 'عصر بارد أول 100%' },
              { key: 'التغليف', value: 'قارورة زجاجية داكنة حافظة للجودة' },
            ],
            fr: [
              { key: 'Origine', value: 'Taroudant - Souss-Massa, Maroc' },
              { key: 'Extraction', value: 'Première pression à froid' },
              { key: 'Flacon', value: 'Verre ambré anti-UV' },
            ],
            en: [
              { key: 'Origin', value: 'Taroudant - Souss-Massa, Morocco' },
              { key: 'Extraction', value: '100% Cold-pressed' },
              { key: 'Packaging', value: 'UV-protected amber glass' },
            ],
          },
          regularPrice: '180.00',
          salePrice: '139.00',
          sku: 'NAA-ARG-BASE',
          trackInventory: true,
          stockQuantity: 120,
          hasVariants: true,
          variantOptions: [
            {
              id: 'size',
              nameI18n: { ar: 'الحجم', fr: 'Contenance', en: 'Volume' },
              values: [
                { value: '100ml', labelI18n: { ar: '100 مل', fr: '100 ml', en: '100 ml' } },
                { value: '250ml', labelI18n: { ar: '250 مل', fr: '250 ml', en: '250 ml' } },
                { value: '500ml', labelI18n: { ar: '500 مل', fr: '500 ml', en: '500 ml' } },
              ],
            },
          ],
          isPublished: true,
          isFeatured: true,
          isBestSeller: true,
          isNewArrival: true,
          badgeI18n: { ar: 'الأكثر طلباً', fr: 'Best-Seller', en: 'Best Seller' },
          averageRating: '4.90',
          reviewsCount: 2,
        })
        .returning();

      await db.insert(productMedia).values({
        storeId,
        productId: arganProduct.id,
        mediaType: 'IMAGE',
        url: '/images/seed/product-argan.svg',
        sortOrder: 0,
      });

      const arganVariants = await db
        .insert(productVariants)
        .values([
          {
            storeId,
            productId: arganProduct.id,
            titleI18n: { ar: '100 مل', fr: '100 ml', en: '100 ml' },
            optionValues: { size: '100ml' },
            sku: 'NAA-ARG-100',
            regularPrice: '180.00',
            salePrice: '139.00',
            stockQuantity: 50,
            imageUrl: '/images/seed/product-argan.svg',
            isDefault: true,
          },
          {
            storeId,
            productId: arganProduct.id,
            titleI18n: { ar: '250 مل', fr: '250 ml', en: '250 ml' },
            optionValues: { size: '250ml' },
            sku: 'NAA-ARG-250',
            regularPrice: '340.00',
            salePrice: '269.00',
            stockQuantity: 40,
            imageUrl: '/images/seed/product-argan.svg',
          },
          {
            storeId,
            productId: arganProduct.id,
            titleI18n: { ar: '500 مل', fr: '500 ml', en: '500 ml' },
            optionValues: { size: '500ml' },
            sku: 'NAA-ARG-500',
            regularPrice: '590.00',
            salePrice: '449.00',
            stockQuantity: 30,
            imageUrl: '/images/seed/product-argan.svg',
          },
        ])
        .returning();

      // Product 2: Physical with Scheduled Promo Countdown (Thyme Honey)
      const promoEnd = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000);
      const [honeyProduct] = await db
        .insert(products)
        .values({
          storeId,
          categoryId: catHoney.id,
          productType: 'PHYSICAL',
          slug: 'wild-atlas-thyme-honey',
          titleI18n: {
            ar: 'عسل الزعتر الأطلسي الحر',
            fr: 'Miel de Thym Sauvage du Haut Atlas',
            en: 'Wild High Atlas Thyme Honey',
          },
          shortDescriptionI18n: {
            ar: 'عسل جبلي نادر مقطوف من مرتفعات الأطلس الكبير ومفحوص مخبرياً.',
            fr: 'Miel rare récolté en haute altitude dans le Haut Atlas, 100% pur.',
            en: 'Rare raw mountain honey harvested in the High Atlas, lab-tested pure.',
          },
          descriptionI18n: {
            ar: 'عسل الزعتر البري معروف بخصائصه المناعية القوية وطعمه الغني الأصيل.',
            fr: 'Reconnu pour ses vertus immunitaires exceptionnelles et son arôme boisé unique.',
            en: 'Renowned for natural immunity support and rich aromatic complexity.',
          },
          regularPrice: '280.00',
          salePrice: '219.00',
          promoStartsAt: new Date(Date.now() - 86400000),
          promoEndsAt: promoEnd,
          sku: 'NAA-HON-500',
          stockQuantity: 45,
          hasVariants: true,
          variantOptions: [
            {
              id: 'weight',
              nameI18n: { ar: 'الوزن', fr: 'Poids', en: 'Weight' },
              values: [
                { value: '500g', labelI18n: { ar: '500 غرام', fr: '500 g', en: '500 g' } },
                { value: '1kg', labelI18n: { ar: '1 كيلوغرام', fr: '1 kg', en: '1 kg' } },
              ],
            },
          ],
          isPublished: true,
          isFeatured: true,
          isBestSeller: true,
          badgeI18n: { ar: 'عرض محدود', fr: 'Promo Flash', en: 'Flash Deal' },
          averageRating: '4.80',
          reviewsCount: 1,
        })
        .returning();

      await db.insert(productMedia).values({
        storeId,
        productId: honeyProduct.id,
        mediaType: 'IMAGE',
        url: '/images/seed/product-honey.svg',
        sortOrder: 0,
      });

      await db.insert(productVariants).values([
        {
          storeId,
          productId: honeyProduct.id,
          titleI18n: { ar: '500 غرام', fr: '500 g', en: '500 g' },
          optionValues: { weight: '500g' },
          sku: 'NAA-HON-500G',
          regularPrice: '280.00',
          salePrice: '219.00',
          stockQuantity: 30,
          isDefault: true,
        },
        {
          storeId,
          productId: honeyProduct.id,
          titleI18n: { ar: '1 كيلوغرام', fr: '1 kg', en: '1 kg' },
          optionValues: { weight: '1kg' },
          sku: 'NAA-HON-1KG',
          regularPrice: '520.00',
          salePrice: '399.00',
          stockQuantity: 15,
        },
      ]);

      // Product 3 & 4: Simple Physical Products
      const [ghassoulProduct] = await db
        .insert(products)
        .values({
          storeId,
          categoryId: catHoney.id,
          productType: 'PHYSICAL',
          slug: 'moroccan-herbal-ghassoul',
          titleI18n: {
            ar: 'طين الغاسول المغربي بالأعشاب السبعة',
            fr: 'Ghassoul Marocain aux 7 Herbes',
            en: 'Moroccan 7-Herb Ghassoul Clay',
          },
          shortDescriptionI18n: {
            ar: 'غاسول ميسور الأصلي مع الورد واللافندر وإكليل الجبل.',
            fr: 'Argile minérale de Missour enrichie à la rose et lavande.',
            en: 'Authentic Missour clay infused with Damascus rose & rosemary.',
          },
          regularPrice: '95.00',
          salePrice: '75.00',
          sku: 'NAA-GHA-400',
          stockQuantity: 80,
          isPublished: true,
          isNewArrival: true,
        })
        .returning();

      await db.insert(productMedia).values({
        storeId,
        productId: ghassoulProduct.id,
        mediaType: 'IMAGE',
        url: '/images/seed/product-botanical.svg',
        sortOrder: 0,
      });

      const [nilaSoap] = await db
        .insert(products)
        .values({
          storeId,
          categoryId: catHoney.id,
          productType: 'PHYSICAL',
          slug: 'saharan-nila-soap',
          titleI18n: {
            ar: 'صابون النيلة الصحراوية والعكر الفاسي',
            fr: 'Savon Nila Saharien & Aker Fassi',
            en: 'Saharan Nila & Aker Fassi Soap',
          },
          shortDescriptionI18n: {
            ar: 'لتفتيح وتوحيد لون البشرة بلطف مع ترطيب طبيعي.',
            fr: "Éclat naturel et douceur pour le visage et le corps.",
            en: 'Gentle brightening & botanical nourishment for radiant skin.',
          },
          regularPrice: '85.00',
          salePrice: '69.00',
          sku: 'NAA-NIL-150',
          stockQuantity: 90,
          isPublished: true,
          isFeatured: true,
          isNewArrival: true,
        })
        .returning();

      await db.insert(productMedia).values({
        storeId,
        productId: nilaSoap.id,
        mediaType: 'IMAGE',
        url: '/images/seed/product-botanical.svg',
        sortOrder: 0,
      });

      // Product 5: Bundle Product
      const [bundleProduct] = await db
        .insert(products)
        .values({
          storeId,
          categoryId: catBundles.id,
          productType: 'BUNDLE',
          slug: 'atlas-beauty-ritual-bundle',
          titleI18n: {
            ar: 'باقة جمال الأطلس المتكاملة (3 منتجات)',
            fr: "Coffret Rituel Beauté de l'Atlas (3 Produits)",
            en: 'Complete Atlas Beauty Ritual Bundle (3 Items)',
          },
          shortDescriptionI18n: {
            ar: 'تضم زيت الأركان 100 مل + الغاسول بالأعشاب + صابون النيلة بتخفيض خاص.',
            fr: "Inclut Huile d'Argan 100ml + Ghassoul + Savon Nila à prix coffret.",
            en: 'Includes 100ml Argan Oil + 7-Herb Ghassoul + Nila Soap with savings.',
          },
          regularPrice: '360.00',
          salePrice: '249.00',
          sku: 'NAA-BND-001',
          stockQuantity: 25,
          shippingConfig: { freeShipping: false },
          isPublished: true,
          isFeatured: true,
          isBestSeller: true,
          badgeI18n: { ar: 'باقة التوفير -31%', fr: 'Pack -31%', en: 'Save 31%' },
        })
        .returning();

      await db.insert(productMedia).values({
        storeId,
        productId: bundleProduct.id,
        mediaType: 'IMAGE',
        url: '/images/seed/product-bundle.svg',
        sortOrder: 0,
      });

      await db.insert(productBundleItems).values([
        {
          storeId,
          bundleProductId: bundleProduct.id,
          itemProductId: arganProduct.id,
          itemVariantId: arganVariants[0].id,
          quantity: 1,
        },
        {
          storeId,
          bundleProductId: bundleProduct.id,
          itemProductId: ghassoulProduct.id,
          quantity: 1,
        },
        {
          storeId,
          bundleProductId: bundleProduct.id,
          itemProductId: nilaSoap.id,
          quantity: 1,
        },
      ]);

      // Product 6: Digital Downloadable Product
      const [digitalProduct] = await db
        .insert(products)
        .values({
          storeId,
          categoryId: catDigital.id,
          productType: 'DIGITAL',
          slug: 'moroccan-botanical-guide-pdf',
          titleI18n: {
            ar: 'الدليل الرقمي الشامل للعناية الطبيعية بالأعشاب المغربية (PDF)',
            fr: 'Guide Numérique des Soins Botaniques Marocains (PDF)',
            en: 'Complete Moroccan Botanical Care Guide (PDF eBook)',
          },
          shortDescriptionI18n: {
            ar: 'تحميل فوري لكتاب إلكتروني يضم 45 وصفة مجربة بالزيوت والأعشاب الأطلسية.',
            fr: 'Téléchargement immédiat : 45 recettes naturelles aux huiles et plantes marocaines.',
            en: 'Instant PDF download featuring 45 authentic Moroccan herbal & oil recipes.',
          },
          regularPrice: '99.00',
          salePrice: '49.00',
          sku: 'NAA-DIG-PDF1',
          trackInventory: false,
          requiresShipping: false,
          isPublished: true,
          isFeatured: true,
          isNewArrival: true,
          badgeI18n: { ar: 'تحميل فوري', fr: 'Téléchargement Direct', en: 'Instant Download' },
        })
        .returning();

      await db.insert(productMedia).values({
        storeId,
        productId: digitalProduct.id,
        mediaType: 'IMAGE',
        url: '/images/seed/product-digital.svg',
        sortOrder: 0,
      });

      // Save sample PDF safely in private-digital storage
      const privateRelKey = path.posix.join(storeId, 'moroccan-botanical-guide.pdf');
      const privateAbsPath = path.resolve(
        process.cwd(),
        env.storageLocalRoot,
        'private-digital',
        privateRelKey
      );
      await fs.mkdir(path.dirname(privateAbsPath), { recursive: true });
      const pdfBuf = buildSamplePdfBuffer();
      await fs.writeFile(privateAbsPath, pdfBuf);

      await db.insert(digitalFiles).values({
        storeId,
        productId: digitalProduct.id,
        fileName: 'Nabat-Al-Atlas-Botanical-Guide.pdf',
        storageKey: privateRelKey,
        mimeType: 'application/pdf',
        fileSizeBytes: pdfBuf.byteLength,
        maxDownloads: 5,
        expiryDays: 30,
      });

      // Product 7: Service / Subscription
      const [subProduct] = await db
        .insert(products)
        .values({
          storeId,
          categoryId: catServices.id,
          productType: 'SUBSCRIPTION',
          slug: 'atlas-monthly-herbal-box',
          titleI18n: {
            ar: 'اشتراك صندوق الأعشاب الشهري + استشارة طبيعية',
            fr: 'Abonnement Box Botanique Mensuelle + Conseil',
            en: 'Monthly Atlas Botanical Box & Consultation',
          },
          shortDescriptionI18n: {
            ar: 'تشكيلة موسمية متجددة كل شهر مع متابعة مخصصة عبر واتساب.',
            fr: 'Sélection saisonnière livrée chaque mois avec accompagnement personnalisé.',
            en: 'Curated seasonal herbal selection delivered monthly with personal guidance.',
          },
          regularPrice: '320.00',
          salePrice: '279.00',
          sku: 'NAA-SUB-MON',
          trackInventory: false,
          requiresShipping: true,
          shippingConfig: { freeShipping: true },
          subscriptionConfig: {
            interval: 'MONTHLY',
            durationLabelI18n: { ar: 'شهرياً', fr: 'Mensuel', en: 'Monthly' },
          },
          isPublished: true,
          isFeatured: true,
        })
        .returning();

      await db.insert(productMedia).values({
        storeId,
        productId: subProduct.id,
        mediaType: 'IMAGE',
        url: '/images/seed/product-bundle.svg',
        sortOrder: 0,
      });

      // Link Related & Frequently Bought Together
      await db
        .update(products)
        .set({
          frequentlyBoughtTogetherIds: [ghassoulProduct.id, nilaSoap.id],
          relatedProductIds: [bundleProduct.id, honeyProduct.id, ghassoulProduct.id],
        })
        .where(eq(products.id, arganProduct.id));

      // Initial inventory audit record
      await db.insert(inventoryMovements).values([
        {
          storeId,
          productId: arganProduct.id,
          variantId: arganVariants[0].id,
          changeAmount: 50,
          previousQuantity: 0,
          newQuantity: 50,
          reason: 'INITIAL_SEED',
          actorEmail: 'system',
        },
        {
          storeId,
          productId: bundleProduct.id,
          changeAmount: 25,
          previousQuantity: 0,
          newQuantity: 25,
          reason: 'INITIAL_SEED',
          actorEmail: 'system',
        },
      ]);

      // Reviews
      await db.insert(productReviews).values([
        {
          storeId,
          productId: arganProduct.id,
          customerName: 'سلمى بنعلي — الدار البيضاء',
          rating: 5,
          title: 'جودة رائعة ورائحة أركان أصيلة',
          comment: 'طلبت 250 مل ووصلني في أقل من 24 ساعة مع تغليف أنيق جداً. أنصح به بشدة.',
          isVerifiedPurchase: true,
          status: 'APPROVED',
        },
        {
          storeId,
          productId: arganProduct.id,
          customerName: 'يوسف العلمي — الرباط',
          rating: 5,
          title: 'Service impeccable',
          comment: 'Huile authentique et livraison rapide avec paiement à la livraison.',
          isVerifiedPurchase: true,
          status: 'APPROVED',
        },
        {
          storeId,
          productId: honeyProduct.id,
          customerName: 'خديجة أمين — مراكش',
          rating: 5,
          title: 'عسل حر ممتاز',
          comment: 'مذاق طبيعي 100% وتعامل راقي في التأكيد عبر واتساب.',
          isVerifiedPurchase: true,
          status: 'APPROVED',
        },
      ]);

      // Sample Landing Page
      await db
        .insert(landingPages)
        .values({
          storeId,
          productId: arganProduct.id,
          slug: 'argan-atlas-offer',
          titleI18n: {
            ar: 'العرض الحصري: زيت الأركان العضوي من نبات الأطلس',
            fr: "Offre Exclusive : Huile d'Argan Bio Nabat Al Atlas",
            en: 'Exclusive Offer: Pure Atlas Argan Oil',
          },
          isPublished: true,
          showHeader: true,
          showFooter: true,
          sections: [
            {
              id: 'lp-hero',
              type: 'HERO',
              enabled: true,
              sortOrder: 0,
              titleI18n: {
                ar: 'زيت الأركان البكر 100% مباشرة من تعاونيات سوس ماسة',
                fr: "Huile d'Argan Bio Pressée à Froid — Direct Coopérative",
                en: '100% Pure Cold-Pressed Atlas Argan Oil',
              },
              subtitleI18n: {
                ar: 'استعدي إشراقة بشرتك وقوة شعرك بتركيبة مغربية خالصة — الدفع عند الاستلام!',
                fr: 'Peau lumineuse et cheveux forts naturellement — Paiement à la livraison !',
                en: 'Restore radiant skin and strong hair naturally — Cash on Delivery across Morocco!',
              },
              content: {
                imageUrl: '/images/seed/hero-atlas-1.svg',
                badgeI18n: { ar: 'تخفيض -23% اليوم فقط', fr: 'Offre -23% Aujourd’hui', en: '23% Off Today' },
              },
            },
            {
              id: 'lp-benefits',
              type: 'BENEFITS',
              enabled: true,
              sortOrder: 1,
              titleI18n: { ar: 'مميزات زيت الأركان الأصلي', fr: 'Les Bienfaits Clés', en: 'Key Benefits' },
              content: {
                items: [
                  {
                    titleI18n: { ar: 'عصر بارد 100%', fr: 'Pression à froid', en: 'Cold Pressed' },
                    descI18n: { ar: 'يحافظ على كامل الفيتامينات ومضادات الأكسدة.', fr: 'Préserve toute la vitamine E.', en: 'Preserves full Vitamin E & antioxidants.' },
                  },
                  {
                    titleI18n: { ar: 'مختبر ومضمون', fr: 'Qualité Garantie', en: 'Lab Verified' },
                    descI18n: { ar: 'بدون أي زيوت مضافة أو مواد حافظة.', fr: 'Zéro additif ni conservateur.', en: 'Zero additives or synthetic fragrances.' },
                  },
                  {
                    titleI18n: { ar: 'توصيل سريع COD', fr: 'Paiement à la livraison', en: 'Fast Morocco COD' },
                    descI18n: { ar: 'عاين طلبك عند الاستلام في جميع المدن المغربية.', fr: 'Payez uniquement à la réception.', en: 'Pay cash upon delivery nationwide.' },
                  },
                ],
              },
            },
            {
              id: 'lp-countdown',
              type: 'COUNTDOWN',
              enabled: true,
              sortOrder: 2,
              titleI18n: { ar: 'ينتهي العرض الترويجي خلال:', fr: "L'offre expire dans :", en: 'Offer ends in:' },
              content: {
                endsAt: promoEnd.toISOString(),
              },
            },
            {
              id: 'lp-faq',
              type: 'FAQ',
              enabled: true,
              sortOrder: 3,
              titleI18n: { ar: 'الأسئلة الشائعة', fr: 'Questions Fréquentes', en: 'FAQ' },
              content: {
                items: [
                  {
                    qI18n: { ar: 'كم يستغرق التوصيل؟', fr: 'Quel est le délai de livraison ?', en: 'How fast is delivery?' },
                    aI18n: { ar: 'من 24 إلى 48 ساعة في أغلب المدن المغربية.', fr: '24 à 48h dans la majorité des villes.', en: '24 to 48 hours across major Moroccan cities.' },
                  },
                  {
                    qI18n: { ar: 'هل يمكنني الدفع عند الاستلام؟', fr: 'Puis-je payer à la livraison ?', en: 'Can I pay Cash on Delivery?' },
                    aI18n: { ar: 'نعم، الدفع عند الاستلام متاح مجاناً في جميع المدن.', fr: 'Oui, le paiement à la livraison est disponible partout.', en: 'Yes, Cash on Delivery is available nationwide.' },
                  },
                ],
              },
            },
            {
              id: 'lp-order',
              type: 'QUICK_ORDER_FORM',
              enabled: true,
              sortOrder: 4,
              titleI18n: { ar: 'اطلب الآن في 30 ثانية', fr: 'Commandez en 30 secondes', en: 'Order Now in 30 Seconds' },
              content: {},
            },
          ],
        })
        .onConflictDoNothing();
    }

    // 9. Coupons
    for (const c of [
      { code: 'ATLAS10', discountType: 'PERCENT', discountValue: '10.00', minOrderAmount: '100.00' },
      { code: 'FREESHIP', discountType: 'FREE_SHIPPING', discountValue: '0.00', minOrderAmount: '150.00' },
    ]) {
      await db.insert(coupons).values({ storeId, ...c, isActive: true }).onConflictDoNothing();
    }

    // 10. Thank You Rule
    const existingTy = await db
      .select({ id: thankYouRules.id })
      .from(thankYouRules)
      .where(eq(thankYouRules.storeId, storeId))
      .limit(1);

    if (existingTy.length === 0) {
      await db.insert(thankYouRules).values({
        storeId,
        name: 'Default Thank You Rule',
        paymentMethodFilter: 'ALL',
        orderStatusFilter: 'ALL',
        titleI18n: {
          ar: 'شكراً لطلبك من نبات الأطلس!',
          fr: 'Merci pour votre commande chez Nabat Al Atlas !',
          en: 'Thank you for your order at Nabat Al Atlas!',
        },
        messageI18n: {
          ar: 'تم تسجيل طلبك بنجاح. يمكنك تأكيده مباشرة عبر واتساب لتسريع عملية الشحن.',
          fr: 'Votre commande a bien été enregistrée. Confirmez-la via WhatsApp pour accélérer l’expédition.',
          en: 'Your order is confirmed in our system. Click below to confirm on WhatsApp for priority dispatch.',
        },
        showOrderSummary: true,
        showWhatsappButton: true,
        showTrackingLink: true,
        showSocialLinks: true,
        priority: 0,
        isActive: true,
      });
    }

    // 11. WhatsApp & Tracking Configs
    await db
      .insert(whatsappConfigs)
      .values({
        storeId,
        defaultPhone: '+212600112233',
        clickToChatEnabled: true,
        templates: DEFAULT_WHATSAPP_TEMPLATES,
        cloudApiEnabled: false,
      })
      .onConflictDoNothing();

    await db
      .insert(trackingConfigs)
      .values({
        storeId,
        metaCapiEnabled: false,
        requireConsent: false,
      })
      .onConflictDoNothing();
  });

  console.log('Seed completed cleanly!');
  process.exit(0);
}

main().catch((err) => {
  console.error('Seed failed:', err);
  process.exit(1);
});

