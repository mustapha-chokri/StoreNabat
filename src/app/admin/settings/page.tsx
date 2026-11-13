'use client';

import React, { useCallback, useEffect, useState } from 'react';
import { Check, Image as ImageIcon, Loader2, Trash2, Upload } from 'lucide-react';
import { AdminShell } from '@/components/admin/AdminShell';
import { useStore } from '@/components/providers/StoreContextProvider';
import {
  HomepageAndSlidersTab,
  type HeroSliderItem,
  type HomepageSectionItem,
} from '@/components/admin/settings/HomepageAndSlidersTab';
import {
  PaymentGatewaysTab,
  TrackingTab,
  WhatsAppSettingsTab,
  type PaymentGatewayRow,
  type TrackingConfigView,
  type WhatsAppConfigView,
} from '@/components/admin/settings/PaymentsAndWhatsAppTabs';

type SettingsTab =
  | 'general'
  | 'theme'
  | 'homepage'
  | 'menus'
  | 'checkout'
  | 'payments'
  | 'marketing'
  | 'whatsapp';

interface AdminSettingsPayload {
  settings: {
    storeNameI18n: Record<string, string>;
    storeDescriptionI18n: Record<string, string>;
    logoUrl: string | null;
    email: string | null;
    phone: string | null;
    whatsappNumber: string | null;
    addressI18n: Record<string, string>;
    defaultLanguage: string;
    taxEnabled: boolean;
    taxInclusive: boolean;
    taxRatePercent: string;
    announcementBar: {
      enabled: boolean;
      textI18n: Record<string, string>;
      linkUrl?: string;
      bgColor?: string;
      textColor?: string;
      countdownEndAt?: string | null;
    };
    socialLinks: Record<string, string>;
    checkoutConfig: {
      cartEnabled: boolean;
      quickOrderEnabled: boolean;
      defaultExperience: 'BOTH' | 'QUICK_ORDER' | 'CART';
      phoneValidationMode: 'MOROCCO_SMART' | 'INTERNATIONAL';
      requireEmail: boolean;
      requireAddress: boolean;
      requireCity: boolean;
      requireNotes: boolean;
      buttonTextI18n: Record<string, string>;
    };
    smtpPublic?: {
      host?: string;
      port?: number;
      secure?: boolean;
      user?: string;
      from?: string;
    } | null;
  };
  theme: {
    presetName: string;
    primaryColor: string;
    secondaryColor: string;
    backgroundColor: string;
    surfaceColor: string;
    textColor: string;
    buttonStyle: string;
    darkModeEnabled: boolean;
    customCss: string | null;
  };
  menus: Array<{
    location: string;
    items: Array<{ id: string; labelI18n: Record<string, string>; url: string }>;
  }>;
  sliders: HeroSliderItem[];
  sections: HomepageSectionItem[];
  paymentGateways: PaymentGatewayRow[];
  tracking: TrackingConfigView;
  whatsapp: WhatsAppConfigView;
  thankYouRules: Array<{
    id: string;
    name: string;
    paymentMethodFilter: string;
    orderStatusFilter: string;
    titleI18n: Record<string, string>;
    messageI18n: Record<string, string>;
    customHtml: string | null;
  }>;
}

export default function AdminSettingsPage() {
  const { locale } = useStore();
  const ar = locale === 'ar';

  const [tab, setTab] = useState<SettingsTab>('general');
  const [data, setData] = useState<AdminSettingsPayload | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [uploadingLogo, setUploadingLogo] = useState(false);
  const [savedToast, setSavedToast] = useState(false);
  const [smtpPass, setSmtpPass] = useState('');

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch('/api/admin/settings');
      if (res.ok) setData(await res.json());
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  async function saveSection(section: string, payload: Record<string, unknown>) {
    setSaving(true);
    try {
      const res = await fetch('/api/admin/settings', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ section, payload }),
      });
      if (res.ok) {
        setSavedToast(true);
        setTimeout(() => setSavedToast(false), 2500);
        await load();
      }
    } finally {
      setSaving(false);
    }
  }

  async function uploadAsset(file: File): Promise<string | null> {
    const fd = new FormData();
    fd.append('file', file);
    fd.append('visibility', 'public');
    const res = await fetch('/api/admin/upload', { method: 'POST', body: fd });
    if (!res.ok) return null;
    const d = await res.json();
    return d.url || d.publicUrl || null;
  }

  const TABS: Array<[SettingsTab, string]> = [
    ['general', ar ? 'إعدادات عامة و SMTP' : 'General & SMTP'],
    ['theme', ar ? 'المظهر والألوان' : 'Theme & CSS'],
    ['homepage', ar ? 'الرئيسية والسلايدر' : 'Homepage & Sliders'],
    ['menus', ar ? 'القوائم والتواصل' : 'Menus & Social'],
    ['checkout', ar ? 'الدفع السريع وشكراً' : 'Checkout & Thank You'],
    ['payments', ar ? 'بوابات الدفع' : 'Payments (COD/CMI/Stripe/PayPal)'],
    ['marketing', ar ? 'البيكسلات و CAPI' : 'Pixels & CAPI'],
    ['whatsapp', ar ? 'واتساب والقوالب' : 'WhatsApp'],
  ];

  return (
    <AdminShell>
      <div className="space-y-5">
        <div className="flex flex-wrap items-center justify-between gap-2 rounded-2xl border border-stone-200 bg-white p-3">
          <div className="flex flex-wrap gap-1.5">
            {TABS.map(([k, label]) => (
              <button
                key={k}
                type="button"
                onClick={() => setTab(k)}
                className={`rounded-xl px-3.5 py-2 text-xs font-bold transition-colors ${
                  tab === k
                    ? 'bg-store-primary text-white'
                    : 'bg-stone-100 text-stone-700 hover:bg-stone-200'
                }`}
              >
                {label}
              </button>
            ))}
          </div>

          {savedToast && (
            <span className="inline-flex items-center gap-1 rounded-full bg-emerald-100 px-3 py-1 text-xs font-bold text-emerald-900">
              <Check className="h-3.5 w-3.5" />
              {ar ? 'تم الحفظ' : 'Saved'}
            </span>
          )}
        </div>

        {loading || !data ? (
          <div className="flex min-h-[260px] items-center justify-center">
            <Loader2 className="h-7 w-7 animate-spin text-store-primary" />
          </div>
        ) : (
          <>
            {tab === 'general' && (
              <div className="rounded-2xl border border-stone-200 bg-white p-5 space-y-5 text-xs">
                {/* Store Logo Section */}
                <div className="rounded-2xl border border-stone-200 bg-stone-50/60 p-4 space-y-3">
                  <div className="flex items-center justify-between border-b border-stone-200 pb-2">
                    <div>
                      <h3 className="font-extrabold text-stone-900">{ar ? 'شعار المتجر (Logo)' : 'Store Logo'}</h3>
                      <p className="text-[11px] text-stone-500">
                        {ar
                          ? 'يظهر الشعار في رأس وتذييل صفحات المتجر وعلى فواتير الطلبات وملصقات الشحن.'
                          : 'Logo appears in the storefront header, footer, invoices, and shipping labels.'}
                      </p>
                    </div>
                  </div>

                  <div className="flex flex-col sm:flex-row items-center gap-5">
                    {/* Logo Preview */}
                    <div className="relative flex h-24 w-36 items-center justify-center rounded-2xl border-2 border-dashed border-stone-300 bg-white p-2 shadow-xs">
                      {data.settings.logoUrl ? (
                        <img
                          src={data.settings.logoUrl}
                          alt="Store Logo"
                          className="max-h-full max-w-full object-contain"
                        />
                      ) : (
                        <div className="flex flex-col items-center justify-center text-stone-400">
                          <ImageIcon className="h-6 w-6 stroke-1 mb-1" />
                          <span className="text-[10px] font-semibold">{ar ? 'لا يوجد شعار' : 'No Logo'}</span>
                        </div>
                      )}
                      {uploadingLogo && (
                        <div className="absolute inset-0 flex items-center justify-center rounded-2xl bg-white/80">
                          <Loader2 className="h-5 w-5 animate-spin text-store-primary" />
                        </div>
                      )}
                    </div>

                    {/* Logo Controls */}
                    <div className="flex-1 space-y-2.5 w-full">
                      <div className="flex flex-wrap items-center gap-2">
                        <label className="cursor-pointer inline-flex items-center gap-1.5 rounded-xl bg-store-primary px-3.5 py-2 text-xs font-bold text-white hover:opacity-90 transition-opacity shadow-xs">
                          <Upload className="h-3.5 w-3.5" />
                          <span>{ar ? 'رفع الشعار من جهازك' : 'Upload Logo'}</span>
                          <input
                            type="file"
                            accept="image/png,image/jpeg,image/svg+xml,image/webp,image/gif"
                            className="hidden"
                            onChange={async (e) => {
                              const file = e.target.files?.[0];
                              if (!file) return;
                              setUploadingLogo(true);
                              try {
                                const url = await uploadAsset(file);
                                if (url) {
                                  setData((prev) =>
                                    prev
                                      ? {
                                          ...prev,
                                          settings: { ...prev.settings, logoUrl: url },
                                        }
                                      : prev
                                  );
                                }
                              } finally {
                                setUploadingLogo(false);
                              }
                            }}
                          />
                        </label>

                        {data.settings.logoUrl && (
                          <button
                            type="button"
                            onClick={() =>
                              setData((prev) =>
                                prev
                                  ? {
                                      ...prev,
                                      settings: { ...prev.settings, logoUrl: null },
                                    }
                                  : prev
                              )
                            }
                            className="inline-flex items-center gap-1.5 rounded-xl border border-red-200 bg-red-50 px-3 py-2 text-xs font-bold text-red-700 hover:bg-red-100 transition-colors"
                          >
                            <Trash2 className="h-3.5 w-3.5" />
                            <span>{ar ? 'إزالة الشعار' : 'Remove Logo'}</span>
                          </button>
                        )}
                      </div>

                      <div>
                        <label className="mb-1 block text-[11px] font-bold text-stone-600">
                          {ar ? 'أو أدخل رابط الشعار المباشر (URL)' : 'Or Enter Direct Logo URL'}
                        </label>
                        <input
                          dir="ltr"
                          value={data.settings.logoUrl || ''}
                          placeholder="https://example.com/logo.png"
                          onChange={(e) =>
                            setData((prev) =>
                              prev
                                ? {
                                    ...prev,
                                    settings: {
                                      ...prev.settings,
                                      logoUrl: e.target.value.trim() || null,
                                    },
                                  }
                                : prev
                            )
                          }
                          className="w-full rounded-xl border border-stone-300 bg-white px-3 py-1.5 text-xs text-start font-mono"
                        />
                      </div>
                    </div>
                  </div>
                </div>

                <h2 className="text-sm font-extrabold">{ar ? 'بيانات المتجر الأساسية' : 'General Settings'}</h2>
                <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
                  <div>
                    <label className="mb-1 block font-bold">اسم المتجر (AR)</label>
                    <input
                      value={data.settings.storeNameI18n.ar || ''}
                      onChange={(e) =>
                        setData({
                          ...data,
                          settings: {
                            ...data.settings,
                            storeNameI18n: { ...data.settings.storeNameI18n, ar: e.target.value },
                          },
                        })
                      }
                      className="w-full rounded-xl border border-stone-300 px-3 py-2"
                    />
                  </div>
                  <div>
                    <label className="mb-1 block font-bold">Nom (FR)</label>
                    <input
                      value={data.settings.storeNameI18n.fr || ''}
                      onChange={(e) =>
                        setData({
                          ...data,
                          settings: {
                            ...data.settings,
                            storeNameI18n: { ...data.settings.storeNameI18n, fr: e.target.value },
                          },
                        })
                      }
                      className="w-full rounded-xl border border-stone-300 px-3 py-2"
                    />
                  </div>
                  <div>
                    <label className="mb-1 block font-bold">Phone / الهاتف</label>
                    <input
                      dir="ltr"
                      value={data.settings.phone || ''}
                      onChange={(e) =>
                        setData({ ...data, settings: { ...data.settings, phone: e.target.value } })
                      }
                      className="w-full rounded-xl border border-stone-300 px-3 py-2 text-start"
                    />
                  </div>
                  <div>
                    <label className="mb-1 block font-bold">Email</label>
                    <input
                      dir="ltr"
                      value={data.settings.email || ''}
                      onChange={(e) =>
                        setData({ ...data, settings: { ...data.settings, email: e.target.value } })
                      }
                      className="w-full rounded-xl border border-stone-300 px-3 py-2 text-start"
                    />
                  </div>
                  <div>
                    <label className="mb-1 block font-bold">{ar ? 'اللغة الافتراضية' : 'Default Locale'}</label>
                    <select
                      value={data.settings.defaultLanguage}
                      onChange={(e) =>
                        setData({
                          ...data,
                          settings: { ...data.settings, defaultLanguage: e.target.value },
                        })
                      }
                      className="w-full rounded-xl border border-stone-300 px-3 py-2"
                    >
                      <option value="ar">العربية (RTL)</option>
                      <option value="fr">Français (LTR)</option>
                      <option value="en">English (LTR)</option>
                    </select>
                  </div>
                  <div>
                    <label className="mb-1 block font-bold">TVA %</label>
                    <input
                      type="number"
                      value={data.settings.taxRatePercent}
                      onChange={(e) =>
                        setData({
                          ...data,
                          settings: { ...data.settings, taxRatePercent: e.target.value },
                        })
                      }
                      className="w-full rounded-xl border border-stone-300 px-3 py-2"
                    />
                  </div>
                </div>

                {/* Announcement Bar */}
                <div className="border-t border-stone-100 pt-4 space-y-3">
                  <label className="inline-flex items-center gap-2 font-bold">
                    <input
                      type="checkbox"
                      checked={data.settings.announcementBar.enabled}
                      onChange={(e) =>
                        setData({
                          ...data,
                          settings: {
                            ...data.settings,
                            announcementBar: {
                              ...data.settings.announcementBar,
                              enabled: e.target.checked,
                            },
                          },
                        })
                      }
                    />
                    {ar ? 'شريط الإعلانات العلوي' : 'Announcement Bar Enabled'}
                  </label>
                  <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
                    <input
                      value={data.settings.announcementBar.textI18n?.ar || ''}
                      onChange={(e) =>
                        setData({
                          ...data,
                          settings: {
                            ...data.settings,
                            announcementBar: {
                              ...data.settings.announcementBar,
                              textI18n: {
                                ...data.settings.announcementBar.textI18n,
                                ar: e.target.value,
                              },
                            },
                          },
                        })
                      }
                      placeholder="نص الإعلان (عربية)"
                      className="rounded-xl border border-stone-300 px-3 py-2"
                    />
                    <input
                      value={data.settings.announcementBar.textI18n?.fr || ''}
                      onChange={(e) =>
                        setData({
                          ...data,
                          settings: {
                            ...data.settings,
                            announcementBar: {
                              ...data.settings.announcementBar,
                              textI18n: {
                                ...data.settings.announcementBar.textI18n,
                                fr: e.target.value,
                              },
                            },
                          },
                        })
                      }
                      placeholder="Texte annonce (FR)"
                      className="rounded-xl border border-stone-300 px-3 py-2"
                    />
                  </div>
                </div>

                {/* SMTP Email */}
                <div className="border-t border-stone-100 pt-4 space-y-2">
                  <p className="font-extrabold">SMTP Email Server</p>
                  <div className="grid grid-cols-1 gap-2.5 sm:grid-cols-4">
                    <input
                      dir="ltr"
                      value={data.settings.smtpPublic?.host || ''}
                      onChange={(e) =>
                        setData({
                          ...data,
                          settings: {
                            ...data.settings,
                            smtpPublic: { ...(data.settings.smtpPublic || {}), host: e.target.value },
                          },
                        })
                      }
                      placeholder="smtp.host.com"
                      className="rounded-xl border border-stone-300 px-3 py-2 text-start"
                    />
                    <input
                      dir="ltr"
                      type="number"
                      value={data.settings.smtpPublic?.port || 587}
                      onChange={(e) =>
                        setData({
                          ...data,
                          settings: {
                            ...data.settings,
                            smtpPublic: {
                              ...(data.settings.smtpPublic || {}),
                              port: Number(e.target.value),
                            },
                          },
                        })
                      }
                      placeholder="587"
                      className="rounded-xl border border-stone-300 px-3 py-2 text-start"
                    />
                    <input
                      dir="ltr"
                      value={data.settings.smtpPublic?.user || ''}
                      onChange={(e) =>
                        setData({
                          ...data,
                          settings: {
                            ...data.settings,
                            smtpPublic: { ...(data.settings.smtpPublic || {}), user: e.target.value },
                          },
                        })
                      }
                      placeholder="SMTP Username"
                      className="rounded-xl border border-stone-300 px-3 py-2 text-start"
                    />
                    <input
                      dir="ltr"
                      type="password"
                      value={smtpPass}
                      onChange={(e) => setSmtpPass(e.target.value)}
                      placeholder="SMTP Password"
                      className="rounded-xl border border-stone-300 px-3 py-2 text-start"
                    />
                  </div>
                </div>

                <div className="flex justify-end">
                  <button
                    type="button"
                    disabled={saving}
                    onClick={() =>
                      saveSection('GENERAL', {
                        ...data.settings,
                        smtpConfig: data.settings.smtpPublic?.host
                          ? { ...data.settings.smtpPublic, ...(smtpPass ? { pass: smtpPass } : {}) }
                          : undefined,
                      })
                    }
                    className="btn-store-primary px-6 py-2.5 font-extrabold"
                  >
                    {ar ? 'حفظ الإعدادات العامة' : 'Save General Settings'}
                  </button>
                </div>
              </div>
            )}

            {tab === 'theme' && (
              <div className="rounded-2xl border border-stone-200 bg-white p-5 space-y-4 text-xs">
                <h2 className="text-sm font-extrabold">{ar ? 'الألوان والمظهر' : 'Theme & Custom CSS'}</h2>
                <div className="grid grid-cols-2 gap-3 sm:grid-cols-5">
                  {[
                    ['primaryColor', 'Primary'],
                    ['secondaryColor', 'Secondary'],
                    ['backgroundColor', 'Background'],
                    ['surfaceColor', 'Surface'],
                    ['textColor', 'Text'],
                  ].map(([k, lbl]) => (
                    <div key={k}>
                      <label className="mb-1 block font-bold">{lbl}</label>
                      <input
                        type="color"
                        value={String(data.theme[k as keyof typeof data.theme] || '#14532D')}
                        onChange={(e) =>
                          setData({
                            ...data,
                            theme: { ...data.theme, [k]: e.target.value },
                          })
                        }
                        className="h-10 w-full cursor-pointer rounded-xl border border-stone-200"
                      />
                    </div>
                  ))}
                </div>

                <div className="flex flex-wrap gap-4">
                  <select
                    value={data.theme.buttonStyle}
                    onChange={(e) =>
                      setData({ ...data, theme: { ...data.theme, buttonStyle: e.target.value } })
                    }
                    className="rounded-xl border border-stone-300 px-3 py-2 font-bold"
                  >
                    <option value="rounded-xl">Rounded (Luxury)</option>
                    <option value="pill">Pill</option>
                    <option value="square">Sharp Square</option>
                  </select>
                  <label className="inline-flex items-center gap-2 font-bold">
                    <input
                      type="checkbox"
                      checked={data.theme.darkModeEnabled}
                      onChange={(e) =>
                        setData({
                          ...data,
                          theme: { ...data.theme, darkModeEnabled: e.target.checked },
                        })
                      }
                    />
                    Dark Mode Storefront
                  </label>
                </div>

                <div>
                  <label className="mb-1 block font-bold">Custom CSS (Sanitized)</label>
                  <textarea
                    rows={4}
                    dir="ltr"
                    value={data.theme.customCss || ''}
                    onChange={(e) =>
                      setData({ ...data, theme: { ...data.theme, customCss: e.target.value } })
                    }
                    className="w-full rounded-xl border border-stone-300 p-3 font-mono text-xs text-start"
                  />
                </div>

                <div className="flex justify-end">
                  <button
                    type="button"
                    disabled={saving}
                    onClick={() => saveSection('THEME', data.theme)}
                    className="btn-store-primary px-6 py-2.5 font-extrabold"
                  >
                    {ar ? 'حفظ المظهر' : 'Save Theme'}
                  </button>
                </div>
              </div>
            )}

            {tab === 'homepage' && (
              <HomepageAndSlidersTab
                ar={ar}
                sections={data.sections}
                setSections={(sections) => setData({ ...data, sections })}
                sliders={data.sliders}
                onSaveSections={() => saveSection('HOMEPAGE_SECTIONS', { sections: data.sections })}
                onSaveSlider={(slider) => saveSection('SLIDER', slider as never)}
                onDeleteSlider={(id) => saveSection('SLIDER_DELETE', { id })}
                onUploadImage={uploadAsset}
                saving={saving}
              />
            )}

            {tab === 'menus' && (
              <div className="rounded-2xl border border-stone-200 bg-white p-5 space-y-4 text-xs">
                <h2 className="text-sm font-extrabold">{ar ? 'روابط التواصل الاجتماعي' : 'Social Media Links'}</h2>
                <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
                  {['instagram', 'facebook', 'tiktok', 'youtube', 'whatsapp'].map((net) => (
                    <input
                      key={net}
                      dir="ltr"
                      value={data.settings.socialLinks?.[net] || ''}
                      onChange={(e) =>
                        setData({
                          ...data,
                          settings: {
                            ...data.settings,
                            socialLinks: {
                              ...(data.settings.socialLinks || {}),
                              [net]: e.target.value,
                            },
                          },
                        })
                      }
                      placeholder={net}
                      className="rounded-xl border border-stone-300 px-3 py-2 text-start"
                    />
                  ))}
                </div>
                <div className="flex justify-end">
                  <button
                    type="button"
                    disabled={saving}
                    onClick={() =>
                      saveSection('GENERAL', { socialLinks: data.settings.socialLinks })
                    }
                    className="btn-store-primary px-5 py-2 font-extrabold"
                  >
                    {ar ? 'حفظ الروابط' : 'Save Social Links'}
                  </button>
                </div>
              </div>
            )}

            {tab === 'checkout' && (
              <div className="space-y-5 text-xs">
                <div className="rounded-2xl border border-stone-200 bg-white p-5 space-y-4">
                  <h2 className="text-sm font-extrabold">
                    {ar ? 'إعدادات نموذج الطلب السريع والسلة' : 'Checkout Behavior'}
                  </h2>
                  <div className="flex flex-wrap gap-5 font-semibold">
                    <label className="inline-flex items-center gap-2">
                      <input
                        type="checkbox"
                        checked={data.settings.checkoutConfig.quickOrderEnabled}
                        onChange={(e) =>
                          setData({
                            ...data,
                            settings: {
                              ...data.settings,
                              checkoutConfig: {
                                ...data.settings.checkoutConfig,
                                quickOrderEnabled: e.target.checked,
                              },
                            },
                          })
                        }
                      />
                      {ar ? 'نموذج الطلب السريع (COD)' : 'Quick Order Form'}
                    </label>
                    <label className="inline-flex items-center gap-2">
                      <input
                        type="checkbox"
                        checked={data.settings.checkoutConfig.cartEnabled}
                        onChange={(e) =>
                          setData({
                            ...data,
                            settings: {
                              ...data.settings,
                              checkoutConfig: {
                                ...data.settings.checkoutConfig,
                                cartEnabled: e.target.checked,
                              },
                            },
                          })
                        }
                      />
                      {ar ? 'سلة التسوق' : 'Shopping Cart'}
                    </label>
                    <label className="inline-flex items-center gap-2">
                      <input
                        type="checkbox"
                        checked={data.settings.checkoutConfig.requireEmail}
                        onChange={(e) =>
                          setData({
                            ...data,
                            settings: {
                              ...data.settings,
                              checkoutConfig: {
                                ...data.settings.checkoutConfig,
                                requireEmail: e.target.checked,
                              },
                            },
                          })
                        }
                      />
                      {ar ? 'إلزام البريد الإلكتروني' : 'Require Email'}
                    </label>
                  </div>

                  <div className="flex justify-end">
                    <button
                      type="button"
                      disabled={saving}
                      onClick={() =>
                        saveSection('GENERAL', { checkoutConfig: data.settings.checkoutConfig })
                      }
                      className="btn-store-primary px-5 py-2 font-extrabold"
                    >
                      {ar ? 'حفظ إعدادات الطلب' : 'Save Checkout Config'}
                    </button>
                  </div>
                </div>

                {/* Thank You Rules Editor */}
                <div className="rounded-2xl border border-stone-200 bg-white p-5 space-y-3">
                  <h2 className="text-sm font-extrabold">
                    {ar ? 'تخصيص صفحة الشكر (Thank You Rules)' : 'Thank You Page Rules'}
                  </h2>
                  {data.thankYouRules.map((rule) => (
                    <div key={rule.id} className="rounded-xl border border-stone-200 p-4 space-y-2.5">
                      <div className="flex items-center justify-between">
                        <span className="font-bold text-stone-900">
                          {rule.name} ({rule.paymentMethodFilter} / {rule.orderStatusFilter})
                        </span>
                      </div>
                      <div className="space-y-1.5">
                        <label className="text-xs font-bold text-stone-700">
                          {ar ? 'عنوان صفحة الشكر (3 لغات)' : 'Thank You Title (3 Languages)'}
                        </label>
                        <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
                          <input
                            value={rule.titleI18n.ar || ''}
                            onChange={(e) =>
                              setData({
                                ...data,
                                thankYouRules: data.thankYouRules.map((r) =>
                                  r.id === rule.id
                                    ? { ...r, titleI18n: { ...r.titleI18n, ar: e.target.value } }
                                    : r
                                ),
                              })
                            }
                            placeholder="العنوان بالعربية"
                            className="w-full rounded-xl border border-stone-300 px-3 py-2 text-xs"
                          />
                          <input
                            value={rule.titleI18n.fr || ''}
                            onChange={(e) =>
                              setData({
                                ...data,
                                thankYouRules: data.thankYouRules.map((r) =>
                                  r.id === rule.id
                                    ? { ...r, titleI18n: { ...r.titleI18n, fr: e.target.value } }
                                    : r
                                ),
                              })
                            }
                            placeholder="Titre en Français"
                            className="w-full rounded-xl border border-stone-300 px-3 py-2 text-xs"
                          />
                          <input
                            value={rule.titleI18n.en || ''}
                            onChange={(e) =>
                              setData({
                                ...data,
                                thankYouRules: data.thankYouRules.map((r) =>
                                  r.id === rule.id
                                    ? { ...r, titleI18n: { ...r.titleI18n, en: e.target.value } }
                                    : r
                                ),
                              })
                            }
                            placeholder="Title in English"
                            className="w-full rounded-xl border border-stone-300 px-3 py-2 text-xs"
                          />
                        </div>
                      </div>

                      <div className="space-y-1.5">
                        <label className="text-xs font-bold text-stone-700">
                          {ar ? 'رسالة الشكر والتأكيد (3 لغات)' : 'Thank You Message (3 Languages)'}
                        </label>
                        <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
                          <textarea
                            rows={2}
                            value={rule.messageI18n.ar || ''}
                            onChange={(e) =>
                              setData({
                                ...data,
                                thankYouRules: data.thankYouRules.map((r) =>
                                  r.id === rule.id
                                    ? { ...r, messageI18n: { ...r.messageI18n, ar: e.target.value } }
                                    : r
                                ),
                              })
                            }
                            placeholder="الرسالة بالعربية"
                            className="w-full rounded-xl border border-stone-300 px-3 py-2 text-xs"
                          />
                          <textarea
                            rows={2}
                            value={rule.messageI18n.fr || ''}
                            onChange={(e) =>
                              setData({
                                ...data,
                                thankYouRules: data.thankYouRules.map((r) =>
                                  r.id === rule.id
                                    ? { ...r, messageI18n: { ...r.messageI18n, fr: e.target.value } }
                                    : r
                                ),
                              })
                            }
                            placeholder="Message en Français"
                            className="w-full rounded-xl border border-stone-300 px-3 py-2 text-xs"
                          />
                          <textarea
                            rows={2}
                            value={rule.messageI18n.en || ''}
                            onChange={(e) =>
                              setData({
                                ...data,
                                thankYouRules: data.thankYouRules.map((r) =>
                                  r.id === rule.id
                                    ? { ...r, messageI18n: { ...r.messageI18n, en: e.target.value } }
                                    : r
                                ),
                              })
                            }
                            placeholder="Message in English"
                            className="w-full rounded-xl border border-stone-300 px-3 py-2 text-xs"
                          />
                        </div>
                      </div>
                      <button
                        type="button"
                        onClick={() => saveSection('THANK_YOU', rule as never)}
                        className="btn-store-primary px-4 py-1.5 font-bold"
                      >
                        {ar ? 'حفظ قاعدة الشكر' : 'Save Rule'}
                      </button>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {tab === 'payments' && (
              <PaymentGatewaysTab
                ar={ar}
                gateways={data.paymentGateways}
                saving={saving}
                onSaveGateway={(gw, secrets) =>
                  saveSection('PAYMENT_GATEWAY', { ...gw, secrets })
                }
              />
            )}

            {tab === 'marketing' && data.tracking && (
              <TrackingTab
                ar={ar}
                tracking={data.tracking}
                saving={saving}
                onSave={(next) => saveSection('TRACKING', next as never)}
              />
            )}

            {tab === 'whatsapp' && data.whatsapp && (
              <WhatsAppSettingsTab
                ar={ar}
                whatsapp={data.whatsapp}
                saving={saving}
                onSave={(next) => saveSection('WHATSAPP', next as never)}
              />
            )}
          </>
        )}
      </div>
    </AdminShell>
  );
}

