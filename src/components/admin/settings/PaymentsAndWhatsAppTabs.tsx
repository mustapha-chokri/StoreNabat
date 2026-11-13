'use client';

import React, { useState } from 'react';
import { CreditCard, MessageCircle, Megaphone } from 'lucide-react';
import type { I18nMap } from '@/db/schema/types';

export interface PaymentGatewayRow {
  gatewayCode: string;
  isEnabled: boolean;
  mode: 'TEST' | 'LIVE';
  displayNameI18n: I18nMap;
  instructionsI18n: I18nMap;
  publicConfig: Record<string, unknown>;
  hasSecrets?: boolean;
}

export interface TrackingConfigView {
  metaPixelId: string | null;
  metaCapiEnabled: boolean;
  metaTestEventCode: string | null;
  tiktokPixelId: string | null;
  ga4MeasurementId: string | null;
  gtmContainerId: string | null;
  googleAdsId: string | null;
  googleAdsConversionLabel: string | null;
  requireConsent: boolean;
  hasMetaCapiToken?: boolean;
}

export interface WhatsAppConfigView {
  defaultPhone: string | null;
  clickToChatEnabled: boolean;
  templates: Record<string, Record<string, string>>;
  cloudApiEnabled: boolean;
  cloudPhoneNumberId: string | null;
  cloudWabaId: string | null;
  hasCloudAccessToken?: boolean;
}

export function PaymentGatewaysTab({
  ar,
  gateways,
  onSaveGateway,
  saving,
}: {
  ar: boolean;
  gateways: PaymentGatewayRow[];
  onSaveGateway: (gw: PaymentGatewayRow, secrets: Record<string, string>) => Promise<void>;
  saving: boolean;
}) {
  const [drafts, setDrafts] = useState<Record<string, PaymentGatewayRow>>(() =>
    Object.fromEntries(gateways.map((g) => [g.gatewayCode, g]))
  );
  const [secretsMap, setSecretsMap] = useState<Record<string, Record<string, string>>>({});

  return (
    <div className="space-y-4">
      {gateways.map((orig) => {
        const g = drafts[orig.gatewayCode] || orig;
        const sec = secretsMap[orig.gatewayCode] || {};
        const setG = (patch: Partial<PaymentGatewayRow>) =>
          setDrafts((p) => ({ ...p, [orig.gatewayCode]: { ...g, ...patch } }));
        const setPub = (key: string, val: unknown) =>
          setG({ publicConfig: { ...(g.publicConfig || {}), [key]: val } });
        const setSec = (key: string, val: string) =>
          setSecretsMap((p) => ({
            ...p,
            [orig.gatewayCode]: { ...(p[orig.gatewayCode] || {}), [key]: val },
          }));

        return (
          <div
            key={g.gatewayCode}
            className="rounded-2xl border border-stone-200 bg-white p-5 space-y-4 text-xs"
          >
            <div className="flex flex-wrap items-center justify-between gap-3 border-b border-stone-100 pb-3">
              <div className="flex items-center gap-2">
                <CreditCard className="h-4 w-4 text-store-primary" />
                <h3 className="text-sm font-extrabold">{g.gatewayCode}</h3>
                {orig.hasSecrets && (
                  <span className="rounded-full bg-emerald-50 px-2 py-0.5 text-[10px] font-bold text-emerald-800">
                    {ar ? 'مفاتيح محفوظة ومشفرة' : 'Encrypted secrets saved'}
                  </span>
                )}
              </div>

              <div className="flex items-center gap-3">
                {g.gatewayCode !== 'COD' && (
                  <select
                    value={g.mode}
                    onChange={(e) => setG({ mode: e.target.value as 'TEST' | 'LIVE' })}
                    className="rounded-xl border border-stone-300 px-3 py-1.5 font-bold"
                  >
                    <option value="TEST">TEST / Sandbox</option>
                    <option value="LIVE">LIVE / Production</option>
                  </select>
                )}
                <label className="inline-flex items-center gap-1.5 font-bold">
                  <input
                    type="checkbox"
                    checked={g.isEnabled}
                    onChange={(e) => setG({ isEnabled: e.target.checked })}
                  />
                  {ar ? 'مفعل' : 'Enabled'}
                </label>
              </div>
            </div>

            {g.gatewayCode === 'STRIPE' && (
              <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                <input
                  dir="ltr"
                  value={String(g.publicConfig?.publishableKey || '')}
                  onChange={(e) => setPub('publishableKey', e.target.value)}
                  placeholder="Publishable Key (pk_test_...)"
                  className="rounded-xl border border-stone-300 px-3 py-2 text-start"
                />
                <input
                  dir="ltr"
                  type="password"
                  value={sec.secretKey || ''}
                  onChange={(e) => setSec('secretKey', e.target.value)}
                  placeholder="Secret Key (sk_test_... leave blank to keep)"
                  className="rounded-xl border border-stone-300 px-3 py-2 text-start"
                />
                <input
                  dir="ltr"
                  type="password"
                  value={sec.webhookSecret || ''}
                  onChange={(e) => setSec('webhookSecret', e.target.value)}
                  placeholder="Webhook Secret (whsec_...)"
                  className="rounded-xl border border-stone-300 px-3 py-2 text-start"
                />
                <div className="flex gap-2">
                  <select
                    value={String(g.publicConfig?.targetCurrency || 'EUR')}
                    onChange={(e) => setPub('targetCurrency', e.target.value)}
                    className="rounded-xl border border-stone-300 px-3 py-2 font-bold"
                  >
                    <option value="EUR">EUR</option>
                    <option value="USD">USD</option>
                  </select>
                  <input
                    type="number"
                    step="0.001"
                    value={String(g.publicConfig?.exchangeRate || '0.092')}
                    onChange={(e) => setPub('exchangeRate', Number(e.target.value))}
                    placeholder="MAD -> Currency Rate"
                    className="flex-1 rounded-xl border border-stone-300 px-3 py-2"
                  />
                </div>
              </div>
            )}

            {g.gatewayCode === 'PAYPAL' && (
              <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                <input
                  dir="ltr"
                  value={String(g.publicConfig?.clientId || '')}
                  onChange={(e) => setPub('clientId', e.target.value)}
                  placeholder="PayPal Client ID"
                  className="rounded-xl border border-stone-300 px-3 py-2 text-start"
                />
                <input
                  dir="ltr"
                  type="password"
                  value={sec.clientSecret || ''}
                  onChange={(e) => setSec('clientSecret', e.target.value)}
                  placeholder="PayPal Client Secret (leave blank to keep)"
                  className="rounded-xl border border-stone-300 px-3 py-2 text-start"
                />
                <div className="flex gap-2">
                  <select
                    value={String(g.publicConfig?.targetCurrency || 'USD')}
                    onChange={(e) => setPub('targetCurrency', e.target.value)}
                    className="rounded-xl border border-stone-300 px-3 py-2 font-bold"
                  >
                    <option value="USD">USD</option>
                    <option value="EUR">EUR</option>
                  </select>
                  <input
                    type="number"
                    step="0.001"
                    value={String(g.publicConfig?.exchangeRate || '0.10')}
                    onChange={(e) => setPub('exchangeRate', Number(e.target.value))}
                    placeholder="MAD -> Rate"
                    className="flex-1 rounded-xl border border-stone-300 px-3 py-2"
                  />
                </div>
              </div>
            )}

            {g.gatewayCode === 'CMI' && (
              <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
                <input
                  dir="ltr"
                  value={String(g.publicConfig?.merchantId || '')}
                  onChange={(e) => setPub('merchantId', e.target.value)}
                  placeholder="CMI Merchant ID (clientid)"
                  className="rounded-xl border border-stone-300 px-3 py-2 text-start"
                />
                <input
                  dir="ltr"
                  value={String(g.publicConfig?.gatewayUrl || '')}
                  onChange={(e) => setPub('gatewayUrl', e.target.value)}
                  placeholder="CMI Gateway URL (https://testpayment.cmi.co.ma/fim/est3Dgate)"
                  className="rounded-xl border border-stone-300 px-3 py-2 text-start"
                />
                <input
                  dir="ltr"
                  type="password"
                  value={sec.storeKey || ''}
                  onChange={(e) => setSec('storeKey', e.target.value)}
                  placeholder="CMI Store Key"
                  className="rounded-xl border border-stone-300 px-3 py-2 text-start"
                />
              </div>
            )}

            <div className="flex justify-end">
              <button
                type="button"
                disabled={saving}
                onClick={() => onSaveGateway(g, sec)}
                className="btn-store-primary px-5 py-2 font-extrabold"
              >
                {ar ? 'حفظ البوابة' : `Save ${g.gatewayCode}`}
              </button>
            </div>
          </div>
        );
      })}
    </div>
  );
}

export function TrackingTab({
  ar,
  tracking,
  onSave,
  saving,
}: {
  ar: boolean;
  tracking: TrackingConfigView;
  onSave: (next: TrackingConfigView & { metaCapiToken?: string }) => Promise<void>;
  saving: boolean;
}) {
  const [form, setForm] = useState(tracking);
  const [capiToken, setCapiToken] = useState('');

  return (
    <div className="rounded-2xl border border-stone-200 bg-white p-5 space-y-4 text-xs">
      <div className="flex items-center gap-2">
        <Megaphone className="h-4 w-4 text-store-primary" />
        <h3 className="text-sm font-extrabold">
          {ar ? 'تتبع التحويلات والبيكسلات (Pixels & Meta CAPI)' : 'Marketing Pixels & CAPI'}
        </h3>
      </div>

      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        <input
          dir="ltr"
          value={form.metaPixelId || ''}
          onChange={(e) => setForm({ ...form, metaPixelId: e.target.value })}
          placeholder="Meta Pixel ID"
          className="rounded-xl border border-stone-300 px-3 py-2 text-start"
        />
        <input
          dir="ltr"
          type="password"
          value={capiToken}
          onChange={(e) => setCapiToken(e.target.value)}
          placeholder="Meta Conversions API Access Token (leave blank to keep)"
          className="rounded-xl border border-stone-300 px-3 py-2 text-start"
        />
        <input
          dir="ltr"
          value={form.metaTestEventCode || ''}
          onChange={(e) => setForm({ ...form, metaTestEventCode: e.target.value })}
          placeholder="Meta Test Event Code (e.g. TEST12345)"
          className="rounded-xl border border-stone-300 px-3 py-2 text-start"
        />
        <input
          dir="ltr"
          value={form.tiktokPixelId || ''}
          onChange={(e) => setForm({ ...form, tiktokPixelId: e.target.value })}
          placeholder="TikTok Pixel ID"
          className="rounded-xl border border-stone-300 px-3 py-2 text-start"
        />
        <input
          dir="ltr"
          value={form.ga4MeasurementId || ''}
          onChange={(e) => setForm({ ...form, ga4MeasurementId: e.target.value })}
          placeholder="GA4 Measurement ID (G-...)"
          className="rounded-xl border border-stone-300 px-3 py-2 text-start"
        />
        <input
          dir="ltr"
          value={form.gtmContainerId || ''}
          onChange={(e) => setForm({ ...form, gtmContainerId: e.target.value })}
          placeholder="Google Tag Manager ID (GTM-...)"
          className="rounded-xl border border-stone-300 px-3 py-2 text-start"
        />
      </div>

      <div className="flex flex-wrap gap-5 font-semibold">
        <label className="inline-flex items-center gap-2">
          <input
            type="checkbox"
            checked={form.metaCapiEnabled}
            onChange={(e) => setForm({ ...form, metaCapiEnabled: e.target.checked })}
          />
          {ar ? 'تفعيل Meta Conversions API (تتبع الخادم)' : 'Enable Meta CAPI (Server-Side)'}
        </label>
        <label className="inline-flex items-center gap-2">
          <input
            type="checkbox"
            checked={form.requireConsent}
            onChange={(e) => setForm({ ...form, requireConsent: e.target.checked })}
          />
          {ar ? 'طلب موافقة ملفات تعريف الارتباط' : 'Require Cookie Consent'}
        </label>
      </div>

      <div className="flex justify-end">
        <button
          type="button"
          disabled={saving}
          onClick={() => onSave({ ...form, metaCapiToken: capiToken || undefined })}
          className="btn-store-primary px-5 py-2 font-extrabold"
        >
          {ar ? 'حفظ إعدادات التتبع' : 'Save Tracking'}
        </button>
      </div>
    </div>
  );
}

export function WhatsAppSettingsTab({
  ar,
  whatsapp,
  onSave,
  saving,
}: {
  ar: boolean;
  whatsapp: WhatsAppConfigView;
  onSave: (next: WhatsAppConfigView & { cloudAccessToken?: string }) => Promise<void>;
  saving: boolean;
}) {
  const [form, setForm] = useState(whatsapp);
  const [cloudToken, setCloudToken] = useState('');

  return (
    <div className="rounded-2xl border border-stone-200 bg-white p-5 space-y-4 text-xs">
      <div className="flex items-center gap-2">
        <MessageCircle className="h-4 w-4 text-emerald-700" />
        <h3 className="text-sm font-extrabold">
          {ar ? 'إعدادات واتساب (Click-to-Chat + Meta Cloud API)' : 'WhatsApp & Templates'}
        </h3>
      </div>

      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        <div>
          <label className="mb-1 block font-bold">{ar ? 'رقم الواتساب الافتراضي' : 'Default WhatsApp'}</label>
          <input
            dir="ltr"
            value={form.defaultPhone || ''}
            onChange={(e) => setForm({ ...form, defaultPhone: e.target.value })}
            placeholder="+212600112233"
            className="w-full rounded-xl border border-stone-300 px-3 py-2 text-start"
          />
        </div>
        <div className="flex items-end">
          <label className="inline-flex items-center gap-2 font-bold">
            <input
              type="checkbox"
              checked={form.clickToChatEnabled}
              onChange={(e) => setForm({ ...form, clickToChatEnabled: e.target.checked })}
            />
            {ar ? 'تفعيل رابط wa.me المباشر بعد الطلب' : 'Enable Click-to-Chat wa.me'}
          </label>
        </div>
      </div>

      <div className="border-t border-stone-100 pt-3 space-y-2">
        <label className="inline-flex items-center gap-2 font-bold text-emerald-950">
          <input
            type="checkbox"
            checked={form.cloudApiEnabled}
            onChange={(e) => setForm({ ...form, cloudApiEnabled: e.target.checked })}
          />
          {ar ? 'تفعيل WhatsApp Business Cloud API (إرسال آلي)' : 'Enable Meta WhatsApp Cloud API'}
        </label>
        {form.cloudApiEnabled && (
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-3 pt-2">
            <input
              dir="ltr"
              value={form.cloudPhoneNumberId || ''}
              onChange={(e) => setForm({ ...form, cloudPhoneNumberId: e.target.value })}
              placeholder="Cloud Phone Number ID"
              className="rounded-xl border border-stone-300 px-3 py-2 text-start"
            />
            <input
              dir="ltr"
              value={form.cloudWabaId || ''}
              onChange={(e) => setForm({ ...form, cloudWabaId: e.target.value })}
              placeholder="WABA ID"
              className="rounded-xl border border-stone-300 px-3 py-2 text-start"
            />
            <input
              dir="ltr"
              type="password"
              value={cloudToken}
              onChange={(e) => setCloudToken(e.target.value)}
              placeholder="Cloud API Access Token"
              className="rounded-xl border border-stone-300 px-3 py-2 text-start"
            />
          </div>
        )}
      </div>

      <div className="border-t border-stone-100 pt-3 space-y-2">
        <p className="font-bold">{ar ? 'قالب رسالة تأكيد الزبون (عربية)' : 'Customer Order Template (AR)'}</p>
        <textarea
          rows={3}
          value={form.templates?.ar?.customer_order_confirmation || ''}
          onChange={(e) =>
            setForm({
              ...form,
              templates: {
                ...form.templates,
                ar: {
                  ...(form.templates?.ar || {}),
                  customer_order_confirmation: e.target.value,
                },
              },
            })
          }
          className="w-full rounded-xl border border-stone-300 px-3 py-2"
        />
      </div>

      <div className="flex justify-end">
        <button
          type="button"
          disabled={saving}
          onClick={() => onSave({ ...form, cloudAccessToken: cloudToken || undefined })}
          className="btn-store-primary px-5 py-2 font-extrabold"
        >
          {ar ? 'حفظ إعدادات واتساب' : 'Save WhatsApp'}
        </button>
      </div>
    </div>
  );
}

