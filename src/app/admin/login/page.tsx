'use client';

import React, { useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { Lock, Loader2, ShieldCheck } from 'lucide-react';
import { useStore } from '@/components/providers/StoreContextProvider';

export default function AdminLoginPage() {
  const router = useRouter();
  const { locale, setLocale } = useStore();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setErrorMsg(null);
    try {
      const res = await fetch('/api/admin/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, password }),
      });
      const d = await res.json();
      if (!res.ok) {
        setErrorMsg(d.error || 'Invalid credentials');
        setLoading(false);
        return;
      }
      router.push('/admin');
      router.refresh();
    } catch {
      setErrorMsg('Login failed');
      setLoading(false);
    }
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-stone-100 px-4 py-12">
      <div className="w-full max-w-md rounded-3xl border border-stone-200 bg-white p-8 shadow-xl space-y-6">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-store-primary text-white">
              <ShieldCheck className="h-5 w-5" />
            </div>
            <div>
              <h1 className="text-lg font-extrabold text-stone-900">
                {locale === 'ar'
                  ? 'لوحة تحكم الإدارة'
                  : locale === 'fr'
                    ? 'Administration'
                    : 'Admin Portal'}
              </h1>
              <p className="text-xs text-stone-500">Nabat Al Atlas E-Commerce</p>
            </div>
          </div>

          <div className="flex gap-1">
            {(['ar', 'fr', 'en'] as const).map((l) => (
              <button
                key={l}
                type="button"
                onClick={() => setLocale(l)}
                className={`rounded-lg px-2 py-1 text-xs font-bold uppercase ${
                  locale === l
                    ? 'bg-emerald-900 text-white'
                    : 'bg-stone-100 text-stone-600'
                }`}
              >
                {l}
              </button>
            ))}
          </div>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="mb-1 block text-xs font-semibold text-stone-700">
              {locale === 'ar' ? 'البريد الإلكتروني' : 'Email'}
            </label>
            <input
              type="email"
              required
              dir="ltr"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="admin@nabatalatlas.ma"
              className="w-full rounded-xl border border-stone-300 px-3.5 py-2.5 text-sm text-start focus:border-emerald-700 focus:outline-none"
            />
          </div>

          <div>
            <label className="mb-1 block text-xs font-semibold text-stone-700">
              {locale === 'ar' ? 'كلمة المرور' : 'Password'}
            </label>
            <input
              type="password"
              required
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="••••••••"
              className="w-full rounded-xl border border-stone-300 px-3.5 py-2.5 text-sm focus:border-emerald-700 focus:outline-none"
            />
          </div>

          {errorMsg && (
            <div className="rounded-xl border border-red-200 bg-red-50 px-3 py-2 text-xs font-semibold text-red-700">
              {errorMsg}
            </div>
          )}

          <button
            type="submit"
            disabled={loading}
            className="btn-store-primary flex w-full items-center justify-center gap-2 py-3 text-sm font-extrabold shadow-sm disabled:opacity-60"
          >
            {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Lock className="h-4 w-4" />}
            <span>
              {locale === 'ar'
                ? 'تسجيل الدخول للإدارة'
                : locale === 'fr'
                  ? 'Se connecter'
                  : 'Sign In'}
            </span>
          </button>
        </form>

        <div className="border-t border-stone-100 pt-4 text-center">
          <Link href="/" className="text-xs font-semibold text-stone-500 hover:text-store-primary">
            {locale === 'ar' ? 'العودة إلى واجهة المتجر' : 'Back to Storefront'}
          </Link>
        </div>
      </div>
    </div>
  );
}

