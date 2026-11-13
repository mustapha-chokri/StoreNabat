'use client';

import React, { Suspense, useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import { useSearchParams } from 'next/navigation';
import {
  Download,
  KeyRound,
  Loader2,
  LogOut,
  MapPin,
  Package,
  Plus,
  Trash2,
  User,
} from 'lucide-react';
import { useStore } from '@/components/providers/StoreContextProvider';
import { StorefrontShell } from '@/components/storefront/StorefrontShell';

interface CustomerProfileResponse {
  customer: {
    id: string;
    fullName: string;
    email: string | null;
    phone: string;
  } | null;
  addresses?: Array<{
    id: string;
    label: string;
    cityName: string;
    addressLine: string;
    isDefault: boolean;
  }>;
  orders?: Array<{
    id: string;
    orderNumber: string;
    orderStatus: string;
    paymentStatus: string;
    totalAmount: string;
    createdAt: string;
  }>;
  downloads?: Array<{
    id: string;
    accessToken: string;
    fileName: string;
    downloadCount: number;
    maxDownloads: number | null;
    expiresAt: string | null;
    isRevoked: boolean;
    orderPaymentStatus?: string;
    orderNumber?: string;
  }>;
}

function AccountInner() {
  const sp = useSearchParams();
  const resetToken = sp.get('resetToken');
  const { ctx, locale, tr, pick, formatPrice } = useStore();

  const [loading, setLoading] = useState(true);
  const [profile, setProfile] = useState<CustomerProfileResponse | null>(null);
  const [authTab, setAuthTab] = useState<'login' | 'register' | 'reset'>(
    resetToken ? 'reset' : 'login'
  );
  const [dashTab, setDashTab] = useState<'orders' | 'downloads' | 'addresses'>('orders');

  // Auth form fields
  const [fullName, setFullName] = useState('');
  const [email, setEmail] = useState('');
  const [phone, setPhone] = useState('');
  const [password, setPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [feedback, setFeedback] = useState<{ ok: boolean; msg: string } | null>(null);

  // Address form
  const [addrLabel, setAddrLabel] = useState('Home');
  const [addrCityId, setAddrCityId] = useState('');
  const [addrLine, setAddrLine] = useState('');

  const loadMe = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch('/api/customer/me');
      if (res.ok) {
        const d = (await res.json()) as CustomerProfileResponse;
        setProfile(d);
      }
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadMe();
  }, [loadMe]);

  async function handleLogin(e: React.FormEvent) {
    e.preventDefault();
    setSubmitting(true);
    setFeedback(null);
    try {
      const res = await fetch('/api/customer/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, password }),
      });
      const d = await res.json();
      if (!res.ok) setFeedback({ ok: false, msg: d.error || 'Login failed' });
      else await loadMe();
    } finally {
      setSubmitting(false);
    }
  }

  async function handleRegister(e: React.FormEvent) {
    e.preventDefault();
    setSubmitting(true);
    setFeedback(null);
    try {
      const res = await fetch('/api/customer/register', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ fullName, email, phone, password }),
      });
      const d = await res.json();
      if (!res.ok) setFeedback({ ok: false, msg: d.error || 'Registration failed' });
      else await loadMe();
    } finally {
      setSubmitting(false);
    }
  }

  async function handlePasswordReset(e: React.FormEvent) {
    e.preventDefault();
    setSubmitting(true);
    setFeedback(null);
    try {
      const payload = resetToken
        ? { action: 'CONFIRM', token: resetToken, newPassword }
        : { action: 'REQUEST', email };
      const res = await fetch('/api/customer/password-reset', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });
      const d = await res.json();
      if (!res.ok) {
        setFeedback({ ok: false, msg: d.error || 'Reset failed' });
      } else {
        setFeedback({
          ok: true,
          msg: resetToken
            ? locale === 'ar'
              ? 'تم تحديث كلمة المرور بنجاح!'
              : 'Password updated successfully!'
            : locale === 'ar'
              ? 'تم إرسال رابط استرجاع كلمة المرور إن كان الحساب مسجلاً.'
              : 'Reset instructions sent if account exists.',
        });
      }
    } finally {
      setSubmitting(false);
    }
  }

  async function handleLogout() {
    await fetch('/api/customer/logout', { method: 'POST' });
    setProfile({ customer: null });
  }

  async function handleAddAddress(e: React.FormEvent) {
    e.preventDefault();
    const cityObj = (ctx?.cities || []).find((c) => c.id === addrCityId);
    const res = await fetch('/api/customer/addresses', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        label: addrLabel,
        cityId: cityObj?.id || null,
        cityName: cityObj ? pick(cityObj.cityNameI18n) : 'Casablanca',
        addressLine: addrLine,
        isDefault: true,
      }),
    });
    if (res.ok) {
      setAddrLine('');
      await loadMe();
    }
  }

  async function handleDeleteAddress(id: string) {
    const res = await fetch(`/api/customer/addresses?id=${encodeURIComponent(id)}`, {
      method: 'DELETE',
    });
    if (res.ok) await loadMe();
  }

  if (loading) {
    return (
      <div className="flex min-h-[320px] items-center justify-center">
        <Loader2 className="h-7 w-7 animate-spin text-store-primary" />
      </div>
    );
  }

  if (!profile?.customer) {
    return (
      <div className="mx-auto max-w-md px-4 py-12">
        <div className="rounded-3xl border border-stone-200 bg-white p-6 sm:p-8 shadow-sm space-y-5">
          <div className="flex border-b border-stone-100">
            {(
              [
                ['login', locale === 'ar' ? 'تسجيل الدخول' : locale === 'fr' ? 'Connexion' : 'Login'],
                ['register', locale === 'ar' ? 'حساب جديد' : locale === 'fr' ? 'Inscription' : 'Register'],
                ['reset', locale === 'ar' ? 'استرجاع' : locale === 'fr' ? 'Mot de passe' : 'Reset'],
              ] as const
            ).map(([k, label]) => (
              <button
                key={k}
                type="button"
                onClick={() => {
                  setAuthTab(k);
                  setFeedback(null);
                }}
                className={`flex-1 border-b-2 pb-3 text-xs sm:text-sm font-bold ${
                  authTab === k
                    ? 'border-emerald-800 text-store-primary'
                    : 'border-transparent text-stone-500'
                }`}
              >
                {label}
              </button>
            ))}
          </div>

          {feedback && (
            <div
              className={`rounded-xl border px-3 py-2.5 text-xs font-semibold ${
                feedback.ok
                  ? 'border-emerald-200 bg-emerald-50 text-emerald-900'
                  : 'border-red-200 bg-red-50 text-red-700'
              }`}
            >
              {feedback.msg}
            </div>
          )}

          {authTab === 'login' && (
            <form onSubmit={handleLogin} className="space-y-3.5">
              <input
                type="email"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="email@example.com"
                className="w-full rounded-xl border border-stone-300 px-3.5 py-2.5 text-sm"
              />
              <input
                type="password"
                required
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="••••••••"
                className="w-full rounded-xl border border-stone-300 px-3.5 py-2.5 text-sm"
              />
              <button
                type="submit"
                disabled={submitting}
                className="btn-store-primary w-full py-3 text-sm font-extrabold"
              >
                {locale === 'ar' ? 'دخول' : 'Sign In'}
              </button>
            </form>
          )}

          {authTab === 'register' && (
            <form onSubmit={handleRegister} className="space-y-3.5">
              <input
                type="text"
                required
                value={fullName}
                onChange={(e) => setFullName(e.target.value)}
                placeholder={tr('checkout.fullName')}
                className="w-full rounded-xl border border-stone-300 px-3.5 py-2.5 text-sm"
              />
              <input
                type="email"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="email@example.com"
                className="w-full rounded-xl border border-stone-300 px-3.5 py-2.5 text-sm"
              />
              <input
                type="tel"
                required
                dir="ltr"
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
                placeholder="0612345678"
                className="w-full rounded-xl border border-stone-300 px-3.5 py-2.5 text-sm text-start"
              />
              <input
                type="password"
                required
                minLength={8}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder={locale === 'ar' ? 'كلمة المرور (8 أحرف+)' : 'Password (8+ chars)'}
                className="w-full rounded-xl border border-stone-300 px-3.5 py-2.5 text-sm"
              />
              <button
                type="submit"
                disabled={submitting}
                className="btn-store-primary w-full py-3 text-sm font-extrabold"
              >
                {locale === 'ar' ? 'إنشاء الحساب' : 'Create Account'}
              </button>
            </form>
          )}

          {authTab === 'reset' && (
            <form onSubmit={handlePasswordReset} className="space-y-3.5">
              <div className="flex items-center gap-2 text-xs text-stone-600">
                <KeyRound className="h-4 w-4 text-store-primary" />
                <span>
                  {resetToken
                    ? locale === 'ar'
                      ? 'أدخل كلمة المرور الجديدة'
                      : 'Enter your new password'
                    : locale === 'ar'
                      ? 'أدخل بريدك لإرسال رابط الاسترجاع'
                      : 'Enter your email for reset link'}
                </span>
              </div>
              {resetToken ? (
                <input
                  type="password"
                  required
                  minLength={8}
                  value={newPassword}
                  onChange={(e) => setNewPassword(e.target.value)}
                  placeholder="••••••••"
                  className="w-full rounded-xl border border-stone-300 px-3.5 py-2.5 text-sm"
                />
              ) : (
                <input
                  type="email"
                  required
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="email@example.com"
                  className="w-full rounded-xl border border-stone-300 px-3.5 py-2.5 text-sm"
                />
              )}
              <button
                type="submit"
                disabled={submitting}
                className="btn-store-primary w-full py-3 text-sm font-extrabold"
              >
                {locale === 'ar' ? 'تأكيد' : 'Submit'}
              </button>
            </form>
          )}
        </div>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-5xl px-4 py-8 sm:px-6 space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-4 rounded-3xl border border-stone-200 bg-white p-6">
        <div className="flex items-center gap-3">
          <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-emerald-100 text-store-primary">
            <User className="h-6 w-6" />
          </div>
          <div>
            <h1 className="text-lg font-extrabold text-stone-900">
              {profile.customer.fullName}
            </h1>
            <p className="text-xs text-stone-500">
              {profile.customer.email} • <span dir="ltr">{profile.customer.phone}</span>
            </p>
          </div>
        </div>
        <button
          type="button"
          onClick={handleLogout}
          className="inline-flex items-center gap-1.5 rounded-xl border border-stone-200 px-4 py-2 text-xs font-bold text-stone-700 hover:bg-red-50 hover:text-red-700"
        >
          <LogOut className="h-4 w-4" />
          <span>{locale === 'ar' ? 'خروج' : 'Logout'}</span>
        </button>
      </div>

      <div className="flex gap-2">
        {(
          [
            ['orders', Package, locale === 'ar' ? 'طلباتي' : 'My Orders'],
            ['downloads', Download, locale === 'ar' ? 'التحميلات الرقمية' : 'Downloads'],
            ['addresses', MapPin, locale === 'ar' ? 'عناوين التوصيل' : 'Addresses'],
          ] as const
        ).map(([k, Icon, label]) => (
          <button
            key={k}
            type="button"
            onClick={() => setDashTab(k)}
            className={`inline-flex items-center gap-2 rounded-xl border px-4 py-2 text-xs sm:text-sm font-bold ${
              dashTab === k
                ? 'border-emerald-800 bg-store-primary text-white'
                : 'border-stone-200 bg-white text-stone-700'
            }`}
          >
            <Icon className="h-4 w-4" />
            <span>{label}</span>
          </button>
        ))}
      </div>

      {dashTab === 'orders' && (
        <div className="rounded-3xl border border-stone-200 bg-white p-6 space-y-3">
          {(profile.orders || []).length === 0 ? (
            <p className="text-sm text-stone-500">
              {locale === 'ar' ? 'لا توجد طلبات مسجلة بعد.' : 'No orders yet.'}
            </p>
          ) : (
            (profile.orders || []).map((ord) => (
              <div
                key={ord.id}
                className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-stone-100 p-4"
              >
                <div>
                  <Link
                    href={`/thank-you/${encodeURIComponent(ord.orderNumber)}`}
                    dir="ltr"
                    className="font-extrabold text-store-primary hover:underline"
                  >
                    {ord.orderNumber}
                  </Link>
                  <p className="text-xs text-stone-500">
                    {new Date(ord.createdAt).toLocaleDateString()}
                  </p>
                </div>
                <div className="flex items-center gap-3">
                  <span className="rounded-full bg-emerald-50 px-3 py-1 text-xs font-bold text-emerald-900">
                    {tr(`orderStatus.${ord.orderStatus}`)}
                  </span>
                  <span className="font-extrabold tabular-nums">
                    {formatPrice(ord.totalAmount)}
                  </span>
                </div>
              </div>
            ))
          )}
        </div>
      )}

      {dashTab === 'downloads' && (
        <div className="rounded-3xl border border-stone-200 bg-white p-6 space-y-3">
          {(profile.downloads || []).length === 0 ? (
            <p className="text-sm text-stone-500">
              {locale === 'ar' ? 'لا توجد ملفات رقمية.' : 'No digital files available.'}
            </p>
          ) : (
            (profile.downloads || []).map((d) => (
              <div
                key={d.id}
                className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-sky-100 bg-sky-50/40 p-4"
              >
                <div>
                  <p className="font-bold text-stone-900">{d.fileName}</p>
                  <p className="text-xs text-stone-500">
                    {d.downloadCount} / {d.maxDownloads ?? '∞'}
                  </p>
                </div>
                {!d.isRevoked && (
                  d.orderPaymentStatus === 'PAID' ? (
                    <a
                      href={`/api/digital/download/${encodeURIComponent(d.accessToken)}`}
                      className="inline-flex items-center gap-1.5 rounded-xl bg-sky-700 px-4 py-2 text-xs font-bold text-white hover:bg-sky-600"
                    >
                      <Download className="h-4 w-4" />
                      <span>{tr('thankyou.downloadNow')}</span>
                    </a>
                  ) : (
                    <span className="inline-flex items-center gap-1 rounded-xl bg-amber-100 px-3 py-1.5 text-xs font-bold text-amber-800">
                      {locale === 'ar'
                        ? 'في انتظار تأكيد الدفع'
                        : locale === 'fr'
                        ? 'En attente de paiement'
                        : 'Pending Payment'}
                    </span>
                  )
                )}
              </div>
            ))
          )}
        </div>
      )}

      {dashTab === 'addresses' && (
        <div className="grid grid-cols-1 gap-6 md:grid-cols-2">
          <div className="rounded-3xl border border-stone-200 bg-white p-6 space-y-3">
            {(profile.addresses || []).map((addr) => (
              <div
                key={addr.id}
                className="flex items-start justify-between rounded-2xl border border-stone-100 p-3.5"
              >
                <div>
                  <p className="text-sm font-bold text-stone-900">
                    {addr.label} — {addr.cityName}
                  </p>
                  <p className="text-xs text-stone-600">{addr.addressLine}</p>
                </div>
                <button
                  type="button"
                  onClick={() => handleDeleteAddress(addr.id)}
                  className="p-1.5 text-stone-400 hover:text-red-600"
                >
                  <Trash2 className="h-4 w-4" />
                </button>
              </div>
            ))}
          </div>

          <form
            onSubmit={handleAddAddress}
            className="rounded-3xl border border-stone-200 bg-white p-6 space-y-3"
          >
            <h3 className="text-sm font-extrabold text-stone-900 flex items-center gap-1.5">
              <Plus className="h-4 w-4 text-store-primary" />
              <span>{locale === 'ar' ? 'إضافة عنوان' : 'Add Address'}</span>
            </h3>
            <input
              type="text"
              required
              value={addrLabel}
              onChange={(e) => setAddrLabel(e.target.value)}
              placeholder="Home / Work"
              className="w-full rounded-xl border border-stone-300 px-3 py-2 text-sm"
            />
            <select
              value={addrCityId}
              onChange={(e) => setAddrCityId(e.target.value)}
              className="w-full rounded-xl border border-stone-300 px-3 py-2 text-sm"
            >
              <option value="">{tr('checkout.selectCity')}</option>
              {(ctx?.cities || []).map((c) => (
                <option key={c.id} value={c.id}>
                  {pick(c.cityNameI18n)}
                </option>
              ))}
            </select>
            <input
              type="text"
              required
              minLength={4}
              value={addrLine}
              onChange={(e) => setAddrLine(e.target.value)}
              placeholder={tr('checkout.address')}
              className="w-full rounded-xl border border-stone-300 px-3 py-2 text-sm"
            />
            <button type="submit" className="btn-store-primary w-full py-2.5 text-sm font-bold">
              {locale === 'ar' ? 'حفظ العنوان' : 'Save Address'}
            </button>
          </form>
        </div>
      )}
    </div>
  );
}

export default function AccountPage() {
  return (
    <StorefrontShell>
      <Suspense fallback={<div className="p-12 text-center">...</div>}>
        <AccountInner />
      </Suspense>
    </StorefrontShell>
  );
}

