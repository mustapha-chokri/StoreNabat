'use client';

import React, { useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import {
  Eye,
  EyeOff,
  Globe,
  KeyRound,
  Loader2,
  Lock,
  Menu,
  PackageSearch,
  Search,
  ShoppingBag,
  User,
  X,
} from 'lucide-react';
import { useStore } from '@/components/providers/StoreContextProvider';
import { computeEffectivePrice } from '@/services/catalog/pricing';
import { CountdownTimer } from './CountdownTimer';
import type { I18nMap } from '@/db/schema/types';

interface SearchSuggestion {
  id: string;
  slug: string;
  titleI18n: I18nMap;
  regularPrice: string;
  salePrice: string | null;
  discountType: string | null;
  discountValue: string | null;
  promoStartsAt: string | null;
  promoEndsAt: string | null;
  media: Array<{ url: string; mediaType: string }>;
}

export function Header() {
  const router = useRouter();
  const {
    ctx,
    locale,
    setLocale,
    tr,
    pick,
    formatPrice,
    cart,
    setCartOpen,
  } = useStore();

  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [searchOpen, setSearchOpen] = useState(false);
  const [query, setQuery] = useState('');
  const [suggestions, setSuggestions] = useState<SearchSuggestion[]>([]);
  const [searching, setSearching] = useState(false);
  const [langMenuOpen, setLangMenuOpen] = useState(false);
  const searchBoxRef = useRef<HTMLDivElement | null>(null);

  // Secret 5-Click Admin Access State
  const [secretClicks, setSecretClicks] = useState(0);
  const [secretModalOpen, setSecretModalOpen] = useState(false);
  const [secretEmail, setSecretEmail] = useState('');
  const [secretPassword, setSecretPassword] = useState('');
  const [secretLoading, setSecretLoading] = useState(false);
  const [secretError, setSecretError] = useState<string | null>(null);
  const [showPassword, setShowPassword] = useState(false);
  const clickTimerRef = useRef<NodeJS.Timeout | null>(null);

  function handleLogoClick(e: React.MouseEvent) {
    const nextCount = secretClicks + 1;
    setSecretClicks(nextCount);

    if (clickTimerRef.current) {
      clearTimeout(clickTimerRef.current);
    }

    if (nextCount >= 5) {
      e.preventDefault();
      e.stopPropagation();
      setSecretClicks(0);
      setSecretPassword('');
      setSecretError(null);
      setSecretModalOpen(true);
      return;
    }

    clickTimerRef.current = setTimeout(() => {
      setSecretClicks(0);
    }, 3000);
  }

  async function handleSecretLogin(e: React.FormEvent) {
    e.preventDefault();
    if (!secretPassword) return;
    setSecretLoading(true);
    setSecretError(null);
    try {
      const res = await fetch('/api/admin/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          email: secretEmail.trim() || undefined,
          password: secretPassword,
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        setSecretError(data.error || (locale === 'ar' ? 'كلمة المرور غير صحيحة.' : 'Incorrect password.'));
        return;
      }
      window.location.href = '/admin';
    } catch {
      setSecretError(locale === 'ar' ? 'حدث خطأ أثناء الاتصال بالخادم.' : 'Error contacting server.');
    } finally {
      setSecretLoading(false);
    }
  }

  const settings = ctx?.settings;
  const announcement = settings?.announcementBar;
  const storeName = pick(settings?.storeNameI18n, 'نبات الأطلس | Nabat Al Atlas');
  const activeLanguages = (ctx?.languages || []).filter((l) => l.isActive);
  const headerMenu = ctx?.menus?.find((m) => m.location === 'HEADER')?.items || [];
  const cartEnabled = settings?.checkoutConfig?.cartEnabled ?? true;

  useEffect(() => {
    const trimmed = query.trim();
    if (trimmed.length < 2) {
      setSuggestions([]);
      return;
    }
    let cancelled = false;
    setSearching(true);
    const timer = setTimeout(async () => {
      try {
        const res = await fetch(
          `/api/storefront/products?q=${encodeURIComponent(trimmed)}&limit=6`
        );
        if (res.ok && !cancelled) {
          const data = await res.json();
          setSuggestions(data.items || []);
        }
      } catch {
        // Ignore transient search error
      } finally {
        if (!cancelled) setSearching(false);
      }
    }, 240);

    return () => {
      cancelled = true;
      clearTimeout(timer);
    };
  }, [query]);

  useEffect(() => {
    function handleOutsideClick(e: MouseEvent) {
      if (searchBoxRef.current && !searchBoxRef.current.contains(e.target as Node)) {
        setSuggestions([]);
      }
    }
    document.addEventListener('mousedown', handleOutsideClick);
    return () => document.removeEventListener('mousedown', handleOutsideClick);
  }, []);

  function handleSearchSubmit(e: React.FormEvent) {
    e.preventDefault();
    const trimmed = query.trim();
    setSuggestions([]);
    setSearchOpen(false);
    setMobileMenuOpen(false);
    router.push(trimmed ? `/shop?q=${encodeURIComponent(trimmed)}` : '/shop');
  }

  return (
    <header className="sticky top-0 z-40 border-b border-stone-200/80 bg-white/95 backdrop-blur-md">
      {announcement?.enabled && (
        <div
          style={{
            backgroundColor: announcement.bgColor || 'var(--store-primary)',
            color: announcement.textColor || '#FFFFFF',
          }}
          className="px-4 py-2 text-center text-xs sm:text-sm font-medium"
        >
          <div className="mx-auto flex max-w-7xl flex-wrap items-center justify-center gap-2">
            {announcement.linkUrl ? (
              <Link href={announcement.linkUrl} className="hover:underline">
                {pick(announcement.textI18n)}
              </Link>
            ) : (
              <span>{pick(announcement.textI18n)}</span>
            )}
            {announcement.countdownEndAt && (
              <CountdownTimer
                endsAt={announcement.countdownEndAt}
                compact
                locale={locale}
              />
            )}
          </div>
        </div>
      )}

      <div className="mx-auto flex h-16 max-w-7xl items-center justify-between gap-3 px-4 sm:px-6 lg:px-8">
        <div className="flex items-center gap-2 lg:gap-6">
          <button
            type="button"
            onClick={() => setMobileMenuOpen(true)}
            className="inline-flex h-10 w-10 items-center justify-center rounded-xl border border-stone-200 text-stone-700 hover:bg-stone-100 lg:hidden"
            aria-label="Open menu"
          >
            <Menu className="h-5 w-5" />
          </button>

          <Link
            href="/"
            onClick={handleLogoClick}
            className="flex items-center gap-2.5 group select-none"
            title={locale === 'ar' ? 'الرئيسية' : 'Home'}
          >
            {settings?.logoUrl ? (
              <img
                src={settings.logoUrl}
                alt={storeName}
                className="h-9 w-auto max-w-[140px] max-h-9 object-contain rounded-lg transition-transform active:scale-95"
              />
            ) : (
              <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-store-primary text-sm font-bold text-white shadow-xs transition-transform active:scale-95">
                ن
              </span>
            )}
            <span className="text-base sm:text-lg font-bold tracking-tight text-stone-900 group-hover:text-store-primary transition-colors">
              {storeName}
            </span>
          </Link>

          <nav className="hidden items-center gap-5 lg:flex">
            {headerMenu.length > 0 ? (
              headerMenu.map((item) => (
                <Link
                  key={item.id}
                  href={item.url}
                  target={item.openInNewTab ? '_blank' : undefined}
                  className="text-sm font-medium text-stone-700 transition-colors hover:text-store-primary"
                >
                  {pick(item.labelI18n)}
                </Link>
              ))
            ) : (
              <>
                <Link
                  href="/"
                  className="text-sm font-medium text-stone-700 hover:text-store-primary"
                >
                  {tr('nav.home')}
                </Link>
                <Link
                  href="/shop"
                  className="text-sm font-medium text-stone-700 hover:text-store-primary"
                >
                  {tr('nav.shop')}
                </Link>
                <Link
                  href="/track-order"
                  className="text-sm font-medium text-stone-700 hover:text-store-primary"
                >
                  {tr('nav.trackOrder')}
                </Link>
              </>
            )}
          </nav>
        </div>

        {/* Desktop Search with live suggestions */}
        <div ref={searchBoxRef} className="relative hidden max-w-md flex-1 md:block">
          <form onSubmit={handleSearchSubmit} className="relative">
            <Search className="pointer-events-none absolute top-1/2 start-3 h-4 w-4 -translate-y-1/2 text-stone-400" />
            <input
              type="search"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder={tr('nav.searchPlaceholder')}
              className="w-full rounded-xl border border-stone-200 bg-stone-50/80 py-2 ps-9 pe-3 text-sm text-stone-900 placeholder:text-stone-400 focus:border-emerald-700 focus:bg-white focus:outline-none"
            />
          </form>

          {(searching || suggestions.length > 0) && query.trim().length >= 2 && (
            <div className="absolute inset-x-0 top-full z-50 mt-2 overflow-hidden rounded-2xl border border-stone-200 bg-white shadow-xl">
              {searching && (
                <div className="px-4 py-3 text-xs text-stone-500">...</div>
              )}
              {suggestions.map((item) => {
                const price = computeEffectivePrice({
                  regularPrice: item.regularPrice,
                  salePrice: item.salePrice,
                  discountType: item.discountType,
                  discountValue: item.discountValue,
                  promoStartsAt: item.promoStartsAt,
                  promoEndsAt: item.promoEndsAt,
                });
                const img = item.media?.find((m) => m.mediaType === 'IMAGE')?.url;
                return (
                  <Link
                    key={item.id}
                    href={`/products/${item.slug}`}
                    onClick={() => setSuggestions([])}
                    className="flex items-center gap-3 border-b border-stone-100 px-3 py-2.5 last:border-b-0 hover:bg-stone-50"
                  >
                    <div className="h-11 w-11 shrink-0 overflow-hidden rounded-lg bg-stone-100">
                      {img && (
                        <img
                          src={img}
                          alt={pick(item.titleI18n)}
                          className="h-full w-full object-cover"
                        />
                      )}
                    </div>
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm font-medium text-stone-900">
                        {pick(item.titleI18n)}
                      </p>
                      <p className="text-xs font-semibold text-store-primary">
                        {formatPrice(price.effectivePrice)}
                      </p>
                    </div>
                  </Link>
                );
              })}
            </div>
          )}
        </div>

        {/* Actions */}
        <div className="flex items-center gap-1.5 sm:gap-2">
          <button
            type="button"
            onClick={() => setSearchOpen((v) => !v)}
            className="inline-flex h-10 w-10 items-center justify-center rounded-xl border border-stone-200 text-stone-700 hover:bg-stone-100 md:hidden"
            aria-label="Search"
          >
            <Search className="h-4 w-4" />
          </button>

          {activeLanguages.length > 1 && (
            <div className="relative">
              <button
                type="button"
                onClick={() => setLangMenuOpen((v) => !v)}
                className="inline-flex h-10 items-center gap-1.5 rounded-xl border border-stone-200 px-2.5 text-xs font-semibold uppercase text-stone-700 hover:bg-stone-100"
              >
                <Globe className="h-4 w-4 text-store-primary" />
                <span>{locale}</span>
              </button>
              {langMenuOpen && (
                <div className="absolute end-0 top-full z-50 mt-1.5 w-36 overflow-hidden rounded-xl border border-stone-200 bg-white shadow-lg">
                  {activeLanguages.map((lang) => (
                    <button
                      key={lang.locale}
                      type="button"
                      onClick={() => {
                        setLocale(lang.locale);
                        setLangMenuOpen(false);
                      }}
                      className={`flex w-full items-center justify-between px-3 py-2 text-xs font-medium hover:bg-stone-50 ${
                        locale === lang.locale ? 'bg-emerald-50 text-store-primary font-bold' : 'text-stone-700'
                      }`}
                    >
                      <span>{lang.localeName}</span>
                      <span className="uppercase opacity-60">{lang.locale}</span>
                    </button>
                  ))}
                </div>
              )}
            </div>
          )}

          <Link
            href="/track-order"
            className="hidden h-10 items-center gap-1.5 rounded-xl border border-stone-200 px-3 text-xs font-semibold text-stone-700 hover:bg-stone-100 sm:inline-flex"
            title={tr('nav.trackOrder')}
          >
            <PackageSearch className="h-4 w-4 text-store-primary" />
            <span className="hidden xl:inline">{tr('nav.trackOrder')}</span>
          </Link>

          <Link
            href="/account"
            className="inline-flex h-10 w-10 items-center justify-center rounded-xl border border-stone-200 text-stone-700 hover:bg-stone-100"
            title={tr('nav.account')}
          >
            <User className="h-4 w-4" />
          </Link>

          {cartEnabled && (
            <button
              type="button"
              onClick={() => setCartOpen(true)}
              className="relative inline-flex h-10 items-center gap-2 rounded-xl bg-store-primary px-3 text-sm font-semibold text-white shadow-xs hover:brightness-110"
              aria-label={tr('nav.cart')}
            >
              <ShoppingBag className="h-4 w-4" />
              <span className="hidden sm:inline">{tr('nav.cart')}</span>
              {cart.totalItems > 0 && (
                <span className="inline-flex h-5 min-w-5 items-center justify-center rounded-full bg-amber-500 px-1 text-[11px] font-bold text-white">
                  {cart.totalItems}
                </span>
              )}
            </button>
          )}
        </div>
      </div>

      {/* Mobile collapsible search bar */}
      {searchOpen && (
        <div className="border-t border-stone-100 bg-white px-4 py-3 md:hidden">
          <form onSubmit={handleSearchSubmit} className="flex gap-2">
            <input
              type="search"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder={tr('nav.searchPlaceholder')}
              className="flex-1 rounded-xl border border-stone-200 bg-stone-50 px-3 py-2 text-sm focus:border-emerald-700 focus:outline-none"
            />
            <button
              type="submit"
              className="btn-store-primary px-4 py-2 text-sm font-semibold"
            >
              <Search className="h-4 w-4" />
            </button>
          </form>
        </div>
      )}

      {/* Mobile Drawer */}
      {mobileMenuOpen && (
        <div className="fixed inset-0 z-50 flex lg:hidden">
          <div
            className="fixed inset-0 bg-black/40 backdrop-blur-xs"
            onClick={() => setMobileMenuOpen(false)}
          />
          <div className="relative z-10 flex h-full w-80 max-w-[85vw] flex-col bg-white p-5 shadow-2xl">
            <div className="flex items-center justify-between border-b border-stone-100 pb-4">
              <span className="font-bold text-stone-900">{storeName}</span>
              <button
                type="button"
                onClick={() => setMobileMenuOpen(false)}
                className="rounded-lg p-1.5 text-stone-500 hover:bg-stone-100"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            <div className="mt-4 flex flex-col gap-2">
              {headerMenu.length > 0 ? (
                headerMenu.map((item) => (
                  <Link
                    key={item.id}
                    href={item.url}
                    onClick={() => setMobileMenuOpen(false)}
                    className="rounded-xl px-3 py-2.5 text-sm font-medium text-stone-800 hover:bg-stone-100"
                  >
                    {pick(item.labelI18n)}
                  </Link>
                ))
              ) : (
                <>
                  <Link
                    href="/"
                    onClick={() => setMobileMenuOpen(false)}
                    className="rounded-xl px-3 py-2.5 text-sm font-medium text-stone-800 hover:bg-stone-100"
                  >
                    {tr('nav.home')}
                  </Link>
                  <Link
                    href="/shop"
                    onClick={() => setMobileMenuOpen(false)}
                    className="rounded-xl px-3 py-2.5 text-sm font-medium text-stone-800 hover:bg-stone-100"
                  >
                    {tr('nav.shop')}
                  </Link>
                </>
              )}
              <Link
                href="/track-order"
                onClick={() => setMobileMenuOpen(false)}
                className="rounded-xl px-3 py-2.5 text-sm font-medium text-stone-800 hover:bg-stone-100"
              >
                {tr('nav.trackOrder')}
              </Link>
              <Link
                href="/account"
                onClick={() => setMobileMenuOpen(false)}
                className="rounded-xl px-3 py-2.5 text-sm font-medium text-stone-800 hover:bg-stone-100"
              >
                {tr('nav.account')}
              </Link>
            </div>

            {activeLanguages.length > 1 && (
              <div className="mt-auto border-t border-stone-100 pt-4">
                <div className="flex flex-wrap gap-2">
                  {activeLanguages.map((lang) => (
                    <button
                      key={lang.locale}
                      type="button"
                      onClick={() => {
                        setLocale(lang.locale);
                        setMobileMenuOpen(false);
                      }}
                      className={`rounded-lg border px-3 py-1.5 text-xs font-semibold ${
                        locale === lang.locale
                          ? 'border-emerald-800 bg-emerald-50 text-emerald-900'
                          : 'border-stone-200 text-stone-600'
                      }`}
                    >
                      {lang.localeName}
                    </button>
                  ))}
                </div>
              </div>
            )}
          </div>
        </div>
      )}
      {/* Secret 5-Click Admin Access Modal */}
      {secretModalOpen && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/60 backdrop-blur-xs p-4 animate-in fade-in duration-200">
          <div className="relative w-full max-w-md overflow-hidden rounded-3xl bg-white shadow-2xl border border-stone-200">
            {/* Header with security badge */}
            <div className="bg-gradient-to-r from-stone-900 to-emerald-950 p-6 text-white text-center relative">
              <button
                type="button"
                onClick={() => setSecretModalOpen(false)}
                className="absolute top-4 end-4 rounded-full bg-white/10 p-1.5 text-stone-300 hover:bg-white/20 hover:text-white transition-colors"
                aria-label="Close"
              >
                <X className="h-5 w-5" />
              </button>
              <div className="mx-auto mb-3 flex h-14 w-14 items-center justify-center rounded-2xl bg-white/10 backdrop-blur-md border border-white/20 shadow-inner">
                <Lock className="h-7 w-7 text-emerald-400" />
              </div>
              <h3 className="text-lg font-black tracking-tight">
                {locale === 'ar' ? '🔐 دخول الإدارة السريع' : '🔐 Quick Admin Access'}
              </h3>
              <p className="mt-1 text-xs text-stone-300">
                {locale === 'ar'
                  ? 'تم فتح هذه البوابة بعد النقر 5 مرات على الشعار. أدخل كلمة السر للتحويل المباشر.'
                  : 'Unlocked after 5 clicks on the logo. Enter password for instant redirection.'}
              </p>
            </div>

            {/* Form */}
            <form onSubmit={handleSecretLogin} className="p-6 space-y-4">
              {secretError && (
                <div className="rounded-xl bg-red-50 p-3 text-xs font-bold text-red-700 border border-red-200 flex items-center gap-2">
                  <X className="h-4 w-4 shrink-0" />
                  <span>{secretError}</span>
                </div>
              )}

              <div>
                <label className="mb-1 block text-xs font-bold text-stone-700">
                  {locale === 'ar' ? 'البريد الإلكتروني (اختياري)' : 'Admin Email (optional)'}
                </label>
                <input
                  dir="ltr"
                  type="email"
                  value={secretEmail}
                  onChange={(e) => setSecretEmail(e.target.value)}
                  placeholder="admin@nabatalatlas.ma"
                  className="w-full rounded-xl border border-stone-300 bg-stone-50 px-3 py-2 text-xs text-start focus:border-store-primary focus:bg-white focus:outline-none"
                />
                <p className="mt-0.5 text-[10px] text-stone-400">
                  {locale === 'ar'
                    ? 'إذا ترك فارغاً سيتم التحقق بحساب مالك المتجر الأساسي.'
                    : 'Leave empty to verify with store owner credentials.'}
                </p>
              </div>

              <div>
                <label className="mb-1 block text-xs font-bold text-stone-700">
                  {locale === 'ar' ? 'كلمة المرور *' : 'Password *'}
                </label>
                <div className="relative">
                  <input
                    required
                    autoFocus
                    dir="ltr"
                    type={showPassword ? 'text' : 'password'}
                    value={secretPassword}
                    onChange={(e) => setSecretPassword(e.target.value)}
                    placeholder="••••••••••••"
                    className="w-full rounded-xl border border-stone-300 px-3 py-2.5 pe-10 text-xs text-start focus:border-store-primary focus:outline-none font-mono"
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    className="absolute top-1/2 end-2.5 -translate-y-1/2 text-stone-400 hover:text-stone-600 p-1"
                    tabIndex={-1}
                  >
                    {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                  </button>
                </div>
              </div>

              <div className="pt-2">
                <button
                  type="submit"
                  disabled={secretLoading || !secretPassword}
                  className="w-full inline-flex items-center justify-center gap-2 rounded-xl bg-store-primary py-2.5 text-xs font-extrabold text-white hover:opacity-95 disabled:opacity-50 transition-all shadow-md shadow-store-primary/20"
                >
                  {secretLoading ? (
                    <>
                      <Loader2 className="h-4 w-4 animate-spin" />
                      <span>{locale === 'ar' ? 'جاري التحقق...' : 'Verifying...'}</span>
                    </>
                  ) : (
                    <>
                      <KeyRound className="h-4 w-4" />
                      <span>{locale === 'ar' ? 'دخول لوحة التحكم الآن' : 'Access Admin Panel'}</span>
                    </>
                  )}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </header>
  );
}

