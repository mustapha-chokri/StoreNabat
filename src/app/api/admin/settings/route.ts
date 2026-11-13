import { NextRequest, NextResponse } from 'next/server';
import { and, asc, eq } from 'drizzle-orm';
import {
  auditLogs,
  heroSliders,
  homepageSections,
  paymentGatewayConfigs,
  storeMenus,
  storeSettings,
  storeThemes,
  storeTranslations,
  thankYouRules,
  trackingConfigs,
  whatsappConfigs,
} from '@/db/schema/tenant';
import { getRequestTenant, withTenantDb } from '@/core/tenancy/context';
import { requireAdmin } from '@/core/auth/admin-session';
import { decryptJsonSecret, encryptJsonSecret, encryptSecret } from '@/core/crypto';
import { sanitizeCustomCss, sanitizeRichHtml } from '@/core/security/sanitize';
import { assertSameOrigin, errorResponse } from '@/core/http/api';

export async function GET() {
  try {
    const tenant = await getRequestTenant();
    await requireAdmin(tenant);

    const data = await withTenantDb(tenant, async (db) => {
      const [settings] = await db
        .select()
        .from(storeSettings)
        .where(eq(storeSettings.storeId, tenant.id))
        .limit(1);

      const [theme] = await db
        .select()
        .from(storeThemes)
        .where(eq(storeThemes.storeId, tenant.id))
        .limit(1);

      const translations = await db
        .select()
        .from(storeTranslations)
        .where(eq(storeTranslations.storeId, tenant.id));

      const menus = await db
        .select()
        .from(storeMenus)
        .where(eq(storeMenus.storeId, tenant.id));

      const sliders = await db
        .select()
        .from(heroSliders)
        .where(eq(heroSliders.storeId, tenant.id))
        .orderBy(asc(heroSliders.sortOrder));

      const sections = await db
        .select()
        .from(homepageSections)
        .where(eq(homepageSections.storeId, tenant.id))
        .orderBy(asc(homepageSections.sortOrder));

      const paymentGateways = await db
        .select()
        .from(paymentGatewayConfigs)
        .where(eq(paymentGatewayConfigs.storeId, tenant.id));

      const [tracking] = await db
        .select()
        .from(trackingConfigs)
        .where(eq(trackingConfigs.storeId, tenant.id))
        .limit(1);

      const [whatsapp] = await db
        .select()
        .from(whatsappConfigs)
        .where(eq(whatsappConfigs.storeId, tenant.id))
        .limit(1);

      const thankYou = await db
        .select()
        .from(thankYouRules)
        .where(eq(thankYouRules.storeId, tenant.id))
        .orderBy(asc(thankYouRules.priority));

      const smtpDecoded = settings?.encryptedSmtpConfig
        ? decryptJsonSecret<{ host?: string; port?: number; secure?: boolean; user?: string; from?: string }>(
            settings.encryptedSmtpConfig
          )
        : null;

      return {
        settings: settings
          ? {
              ...settings,
              encryptedSmtpConfig: undefined,
              smtpPublic: smtpDecoded
                ? {
                    host: smtpDecoded.host,
                    port: smtpDecoded.port,
                    secure: smtpDecoded.secure,
                    user: smtpDecoded.user,
                    from: smtpDecoded.from,
                    hasPassword: true,
                  }
                : null,
            }
          : null,
        theme: theme || null,
        translations,
        menus,
        sliders,
        sections,
        paymentGateways: paymentGateways.map((g) => ({
          ...g,
          encryptedSecrets: undefined,
          hasSecrets: Boolean(g.encryptedSecrets),
        })),
        tracking: tracking
          ? {
              ...tracking,
              encryptedMetaCapiToken: undefined,
              hasMetaCapiToken: Boolean(tracking.encryptedMetaCapiToken),
            }
          : null,
        whatsapp: whatsapp
          ? {
              ...whatsapp,
              encryptedCloudAccessToken: undefined,
              hasCloudAccessToken: Boolean(whatsapp.encryptedCloudAccessToken),
            }
          : null,
        thankYouRules: thankYou,
      };
    });

    return NextResponse.json(data);
  } catch (err) {
    return errorResponse(err);
  }
}

export async function PATCH(req: NextRequest) {
  const csrfErr = assertSameOrigin(req);
  if (csrfErr) return csrfErr;

  try {
    const tenant = await getRequestTenant();
    const body = (await req.json()) as {
      section:
        | 'GENERAL'
        | 'THEME'
        | 'TRANSLATION'
        | 'MENU'
        | 'SLIDER'
        | 'SLIDER_DELETE'
        | 'HOMEPAGE_SECTIONS'
        | 'PAYMENT_GATEWAY'
        | 'TRACKING'
        | 'WHATSAPP'
        | 'THANK_YOU'
        | 'THANK_YOU_DELETE';
      payload: Record<string, unknown>;
    };

    const perm =
      body.section === 'PAYMENT_GATEWAY'
        ? 'payments.write'
        : body.section === 'TRACKING'
          ? 'marketing.write'
          : body.section === 'MENU' ||
              body.section === 'SLIDER' ||
              body.section === 'SLIDER_DELETE' ||
              body.section === 'HOMEPAGE_SECTIONS' ||
              body.section === 'THEME'
            ? 'storefront.write'
            : 'settings.write';

    const admin = await requireAdmin(tenant, perm);

    await withTenantDb(tenant, async (db) => {
      const p = body.payload;

      if (body.section === 'GENERAL') {
        const updateData: Record<string, unknown> = { updatedAt: new Date() };
        const keys = [
          'storeNameI18n',
          'storeDescriptionI18n',
          'logoUrl',
          'faviconUrl',
          'email',
          'phone',
          'whatsappNumber',
          'addressI18n',
          'defaultLanguage',
          'supportedLanguages',
          'defaultCurrency',
          'currencySymbols',
          'currencyPosition',
          'timezone',
          'taxEnabled',
          'taxInclusive',
          'taxRatePercent',
          'taxLabelI18n',
          'checkoutConfig',
          'inventoryConfig',
          'socialLinks',
          'announcementBar',
          'seoDefaults',
        ];
        for (const k of keys) {
          if (k in p) updateData[k] = p[k];
        }
        if (p.smtpConfig && typeof p.smtpConfig === 'object') {
          const s = p.smtpConfig as Record<string, unknown>;
          if (s.host) {
            const [cur] = await db
              .select({ enc: storeSettings.encryptedSmtpConfig })
              .from(storeSettings)
              .where(eq(storeSettings.storeId, tenant.id))
              .limit(1);
            const prevSmtp = cur?.enc
              ? decryptJsonSecret<Record<string, unknown>>(cur.enc)
              : {};
            updateData.encryptedSmtpConfig = encryptJsonSecret({
              host: s.host,
              port: Number(s.port || 587),
              secure: Boolean(s.secure),
              user: s.user || '',
              pass: s.pass ? String(s.pass) : prevSmtp?.pass || '',
              from: s.from || '',
            });
          }
        }
        await db
          .update(storeSettings)
          .set(updateData)
          .where(eq(storeSettings.storeId, tenant.id));
      } else if (body.section === 'THEME') {
        const updateData: Record<string, unknown> = { updatedAt: new Date() };
        const keys = [
          'presetName',
          'primaryColor',
          'secondaryColor',
          'backgroundColor',
          'surfaceColor',
          'textColor',
          'headingFontAr',
          'headingFontLatin',
          'buttonStyle',
          'headerStyle',
          'footerStyle',
          'darkModeEnabled',
          'layoutConfig',
        ];
        for (const k of keys) {
          if (k in p) updateData[k] = p[k];
        }
        if ('customCss' in p) {
          updateData.customCss = sanitizeCustomCss(String(p.customCss || ''));
        }
        await db
          .update(storeThemes)
          .set(updateData)
          .where(eq(storeThemes.storeId, tenant.id));
      } else if (body.section === 'TRANSLATION') {
        const locale = String(p.locale || '').toLowerCase();
        if (!locale) throw new Error('Locale code required');
        const existing = await db
          .select()
          .from(storeTranslations)
          .where(
            and(eq(storeTranslations.storeId, tenant.id), eq(storeTranslations.locale, locale))
          )
          .limit(1);

        if (existing.length > 0) {
          await db
            .update(storeTranslations)
            .set({
              localeName: String(p.localeName || existing[0].localeName),
              direction: p.direction === 'rtl' ? 'rtl' : 'ltr',
              isActive: p.isActive !== false,
              overrides: (p.overrides as Record<string, string>) || existing[0].overrides,
              updatedAt: new Date(),
            })
            .where(
              and(eq(storeTranslations.storeId, tenant.id), eq(storeTranslations.id, existing[0].id))
            );
        } else {
          await db.insert(storeTranslations).values({
            storeId: tenant.id,
            locale,
            localeName: String(p.localeName || locale.toUpperCase()),
            direction: p.direction === 'rtl' ? 'rtl' : 'ltr',
            isActive: true,
            overrides: (p.overrides as Record<string, string>) || {},
          });
        }
      } else if (body.section === 'MENU') {
        const location = String(p.location || 'HEADER');
        const items = Array.isArray(p.items) ? p.items : [];
        const existing = await db
          .select()
          .from(storeMenus)
          .where(and(eq(storeMenus.storeId, tenant.id), eq(storeMenus.location, location)))
          .limit(1);
        if (existing.length > 0) {
          await db
            .update(storeMenus)
            .set({ items, updatedAt: new Date() })
            .where(and(eq(storeMenus.storeId, tenant.id), eq(storeMenus.id, existing[0].id)));
        } else {
          await db.insert(storeMenus).values({ storeId: tenant.id, location, items });
        }
      } else if (body.section === 'SLIDER') {
        const values = {
          titleI18n: (p.titleI18n as Record<string, string>) || {},
          subtitleI18n: (p.subtitleI18n as Record<string, string>) || {},
          badgeI18n: (p.badgeI18n as Record<string, string>) || {},
          ctaTextI18n: (p.ctaTextI18n as Record<string, string>) || {},
          ctaUrl: String(p.ctaUrl || '/shop'),
          desktopImageUrl: String(p.desktopImageUrl || '/images/seed/hero-atlas-1.svg'),
          mobileImageUrl: (p.mobileImageUrl as string) || null,
          sortOrder: Number(p.sortOrder || 0),
          isActive: p.isActive !== false,
          startsAt: p.startsAt ? new Date(String(p.startsAt)) : null,
          endsAt: p.endsAt ? new Date(String(p.endsAt)) : null,
        };
        if (p.id) {
          await db
            .update(heroSliders)
            .set(values)
            .where(and(eq(heroSliders.storeId, tenant.id), eq(heroSliders.id, String(p.id))));
        } else {
          await db.insert(heroSliders).values({ storeId: tenant.id, ...values });
        }
      } else if (body.section === 'SLIDER_DELETE' && p.id) {
        await db
          .delete(heroSliders)
          .where(and(eq(heroSliders.storeId, tenant.id), eq(heroSliders.id, String(p.id))));
      } else if (body.section === 'HOMEPAGE_SECTIONS' && Array.isArray(p.sections)) {
        for (const sec of p.sections as Array<{
          id: string;
          sortOrder: number;
          isEnabled: boolean;
          titleI18n?: Record<string, string>;
          subtitleI18n?: Record<string, string>;
          config?: Record<string, unknown>;
        }>) {
          await db
            .update(homepageSections)
            .set({
              sortOrder: sec.sortOrder,
              isEnabled: sec.isEnabled,
              ...(sec.titleI18n ? { titleI18n: sec.titleI18n } : {}),
              ...(sec.subtitleI18n ? { subtitleI18n: sec.subtitleI18n } : {}),
              ...(sec.config ? { config: sec.config } : {}),
              updatedAt: new Date(),
            })
            .where(and(eq(homepageSections.storeId, tenant.id), eq(homepageSections.id, sec.id)));
        }
      } else if (body.section === 'PAYMENT_GATEWAY') {
        const gatewayCode = String(p.gatewayCode);
        const [cur] = await db
          .select()
          .from(paymentGatewayConfigs)
          .where(
            and(
              eq(paymentGatewayConfigs.storeId, tenant.id),
              eq(paymentGatewayConfigs.gatewayCode, gatewayCode)
            )
          )
          .limit(1);

        const prevSecrets =
          decryptJsonSecret<Record<string, string>>(cur?.encryptedSecrets) || {};
        const incomingSecrets = (p.secrets as Record<string, string>) || {};
        const mergedSecrets: Record<string, string> = { ...prevSecrets };
        for (const [k, v] of Object.entries(incomingSecrets)) {
          if (v && v.trim()) mergedSecrets[k] = v.trim();
        }

        await db
          .update(paymentGatewayConfigs)
          .set({
            isEnabled: Boolean(p.isEnabled),
            mode: p.mode === 'LIVE' ? 'LIVE' : 'TEST',
            publicConfig: (p.publicConfig as Record<string, unknown>) || cur?.publicConfig || {},
            displayNameI18n:
              (p.displayNameI18n as Record<string, string>) || cur?.displayNameI18n || {},
            instructionsI18n:
              (p.instructionsI18n as Record<string, string>) || cur?.instructionsI18n || {},
            encryptedSecrets:
              Object.keys(mergedSecrets).length > 0 ? encryptJsonSecret(mergedSecrets) : null,
            updatedAt: new Date(),
          })
          .where(
            and(
              eq(paymentGatewayConfigs.storeId, tenant.id),
              eq(paymentGatewayConfigs.gatewayCode, gatewayCode)
            )
          );
      } else if (body.section === 'TRACKING') {
        const updateData: Record<string, unknown> = {
          metaPixelId: p.metaPixelId || null,
          metaCapiEnabled: Boolean(p.metaCapiEnabled),
          metaTestEventCode: p.metaTestEventCode || null,
          tiktokPixelId: p.tiktokPixelId || null,
          ga4MeasurementId: p.ga4MeasurementId || null,
          gtmContainerId: p.gtmContainerId || null,
          googleAdsId: p.googleAdsId || null,
          googleAdsConversionLabel: p.googleAdsConversionLabel || null,
          requireConsent: Boolean(p.requireConsent),
          updatedAt: new Date(),
        };
        if (typeof p.metaCapiToken === 'string' && p.metaCapiToken.trim()) {
          updateData.encryptedMetaCapiToken = encryptSecret(p.metaCapiToken.trim());
        }
        await db
          .update(trackingConfigs)
          .set(updateData)
          .where(eq(trackingConfigs.storeId, tenant.id));
      } else if (body.section === 'WHATSAPP') {
        const updateData: Record<string, unknown> = {
          defaultPhone: p.defaultPhone || null,
          clickToChatEnabled: p.clickToChatEnabled !== false,
          templates: p.templates || {},
          cloudApiEnabled: Boolean(p.cloudApiEnabled),
          cloudPhoneNumberId: p.cloudPhoneNumberId || null,
          cloudWabaId: p.cloudWabaId || null,
          updatedAt: new Date(),
        };
        if (typeof p.cloudAccessToken === 'string' && p.cloudAccessToken.trim()) {
          updateData.encryptedCloudAccessToken = encryptSecret(p.cloudAccessToken.trim());
        }
        await db
          .update(whatsappConfigs)
          .set(updateData)
          .where(eq(whatsappConfigs.storeId, tenant.id));
      } else if (body.section === 'THANK_YOU') {
        const values = {
          name: String(p.name || 'Thank You Rule'),
          paymentMethodFilter: String(p.paymentMethodFilter || 'ALL'),
          orderStatusFilter: String(p.orderStatusFilter || 'ALL'),
          titleI18n: (p.titleI18n as Record<string, string>) || { ar: '' },
          messageI18n: (p.messageI18n as Record<string, string>) || { ar: '' },
          mediaUrl: (p.mediaUrl as string) || null,
          mediaType: (p.mediaType as string) || null,
          showOrderSummary: p.showOrderSummary !== false,
          showWhatsappButton: p.showWhatsappButton !== false,
          showTrackingLink: p.showTrackingLink !== false,
          showSocialLinks: p.showSocialLinks !== false,
          upsellProductIds: Array.isArray(p.upsellProductIds) ? p.upsellProductIds : [],
          customHtml: p.customHtml ? sanitizeRichHtml(String(p.customHtml)) : null,
          priority: Number(p.priority || 0),
          isActive: p.isActive !== false,
        };
        if (p.id) {
          await db
            .update(thankYouRules)
            .set(values)
            .where(and(eq(thankYouRules.storeId, tenant.id), eq(thankYouRules.id, String(p.id))));
        } else {
          await db.insert(thankYouRules).values({ storeId: tenant.id, ...values });
        }
      } else if (body.section === 'THANK_YOU_DELETE' && p.id) {
        await db
          .delete(thankYouRules)
          .where(and(eq(thankYouRules.storeId, tenant.id), eq(thankYouRules.id, String(p.id))));
      }

      await db.insert(auditLogs).values({
        storeId: tenant.id,
        adminUserId: admin.id,
        actorEmail: admin.email,
        action: `settings.updated.${body.section.toLowerCase()}`,
        entityType: 'settings',
      });
    });

    return NextResponse.json({ ok: true });
  } catch (err) {
    return errorResponse(err);
  }
}

