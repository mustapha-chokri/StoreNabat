'use client';

import React, { useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import {
  Bell,
  Boxes,
  CheckCheck,
  ExternalLink,
  FolderTree,
  LayoutDashboard,
  LayoutTemplate,
  Loader2,
  LogOut,
  Menu,
  MessageSquareText,
  Package,
  Settings,
  Shield,
  ShoppingCart,
  TicketPercent,
  Truck,
  Users,
  X,
} from 'lucide-react';
import { useStore } from '@/components/providers/StoreContextProvider';
import type { I18nMap } from '@/db/schema/types';

export interface AuthenticatedAdminInfo {
  id: string;
  email: string;
  fullName: string;
  role: string;
}

interface AdminNotificationRow {
  id: string;
  type: string;
  titleI18n: I18nMap;
  messageI18n: I18nMap;
  linkUrl: string | null;
  isRead: boolean;
  createdAt: string;
}

const NAV_ITEMS = [
  { href: '/admin', icon: LayoutDashboard, ar: 'لوحة المعلومات', fr: 'Tableau de bord', en: 'Dashboard' },
  { href: '/admin/orders', icon: ShoppingCart, ar: 'الطلبات', fr: 'Commandes', en: 'Orders' },
  { href: '/admin/products', icon: Package, ar: 'المنتجات', fr: 'Produits', en: 'Products' },
  { href: '/admin/categories', icon: FolderTree, ar: 'التصنيفات', fr: 'Catégories', en: 'Categories' },
  { href: '/admin/inventory', icon: Boxes, ar: 'المخزون', fr: 'Inventaire', en: 'Inventory' },
  { href: '/admin/landing-pages', icon: LayoutTemplate, ar: 'صفحات الهبوط', fr: 'Landing Pages', en: 'Landing Pages' },
  { href: '/admin/shipping', icon: Truck, ar: 'الشحن والمدن', fr: 'Livraison', en: 'Shipping' },
  { href: '/admin/customers', icon: Users, ar: 'الزبناء', fr: 'Clients', en: 'Customers' },
  { href: '/admin/coupons', icon: TicketPercent, ar: 'أكواد الخصم', fr: 'Coupons', en: 'Coupons' },
  { href: '/admin/reviews', icon: MessageSquareText, ar: 'التقييمات', fr: 'Avis', en: 'Reviews' },
  { href: '/admin/settings', icon: Settings, ar: 'إعدادات المتجر', fr: 'Paramètres', en: 'Settings' },
  { href: '/admin/staff', icon: Shield, ar: 'الفريق والأمان', fr: 'Équipe & DB', en: 'Staff & Tenant DB' },
];

export function AdminShell({
  children,
}: {
  children: React.ReactNode;
}) {
  const pathname = usePathname();
  const router = useRouter();
  const { locale, setLocale, pick } = useStore();

  const [admin, setAdmin] = useState<AuthenticatedAdminInfo | null>(null);
  const [checkingAuth, setCheckingAuth] = useState(true);
  const [sidebarOpen, setSidebarOpen] = useState(false);

  const [notifications, setNotifications] = useState<AdminNotificationRow[]>([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const [notifOpen, setNotifOpen] = useState(false);
  const [liveToast, setLiveToast] = useState<AdminNotificationRow | null>(null);

  const loadNotifications = useCallback(async () => {
    try {
      const res = await fetch('/api/admin/notifications');
      if (res.ok) {
        const d = await res.json();
        setNotifications(d.notifications || []);
        setUnreadCount(d.unreadCount || 0);
      }
    } catch {
      // Ignore
    }
  }, []);

  useEffect(() => {
    let active = true;
    async function check() {
      try {
        const res = await fetch('/api/admin/auth/me');
        if (!res.ok) {
          router.replace('/admin/login');
          return;
        }
        const d = await res.json();
        if (active) {
          setAdmin(d.admin);
          setCheckingAuth(false);
          loadNotifications();
        }
      } catch {
        router.replace('/admin/login');
      }
    }
    check();
    return () => {
      active = false;
    };
  }, [router, loadNotifications]);

  // Real-time SSE notification stream
  useEffect(() => {
    if (!admin) return;
    const es = new EventSource('/api/admin/notifications/stream');
    es.addEventListener('notification', (ev) => {
      try {
        const payload = JSON.parse((ev as MessageEvent).data) as {
          notification?: AdminNotificationRow;
          titleI18n?: I18nMap;
          messageI18n?: I18nMap;
          linkUrl?: string | null;
          id?: string;
          type?: string;
        };
        const notif: AdminNotificationRow = payload.notification || {
          id: payload.id || crypto.randomUUID(),
          type: payload.type || 'ORDER',
          titleI18n: payload.titleI18n || {},
          messageI18n: payload.messageI18n || {},
          linkUrl: payload.linkUrl || '/admin/orders',
          isRead: false,
          createdAt: new Date().toISOString(),
        };
        setNotifications((prev) => [notif, ...prev.slice(0, 49)]);
        setUnreadCount((c) => c + 1);
        setLiveToast(notif);
        setTimeout(() => setLiveToast(null), 6000);
      } catch {
        // Ignore parse error
      }
    });
    return () => es.close();
  }, [admin]);

  async function markAllRead() {
    await fetch('/api/admin/notifications', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ markAll: true }),
    });
    setNotifications((prev) => prev.map((n) => ({ ...n, isRead: true })));
    setUnreadCount(0);
  }

  async function handleLogout() {
    await fetch('/api/admin/auth/logout', { method: 'POST' });
    router.replace('/admin/login');
  }

  if (checkingAuth) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-stone-100">
        <Loader2 className="h-8 w-8 animate-spin text-store-primary" />
      </div>
    );
  }

  const labelKey = locale === 'fr' ? 'fr' : locale === 'en' ? 'en' : 'ar';

  const SidebarContent = (
    <div className="flex h-full flex-col bg-stone-950 text-stone-200">
      <div className="flex h-16 items-center justify-between border-b border-stone-800 px-5">
        <Link href="/admin" className="font-extrabold text-white">
          نبات الأطلس • Admin
        </Link>
        <button
          type="button"
          onClick={() => setSidebarOpen(false)}
          className="rounded-lg p-1 text-stone-400 hover:text-white lg:hidden"
        >
          <X className="h-5 w-5" />
        </button>
      </div>

      <nav className="flex-1 overflow-y-auto px-3 py-4 space-y-1">
        {NAV_ITEMS.map((item) => {
          const active =
            item.href === '/admin'
              ? pathname === '/admin'
              : pathname?.startsWith(item.href);
          const Icon = item.icon;
          return (
            <Link
              key={item.href}
              href={item.href}
              onClick={() => setSidebarOpen(false)}
              className={`flex items-center gap-3 rounded-xl px-3.5 py-2.5 text-sm font-semibold transition-colors ${
                active
                  ? 'bg-emerald-700 text-white shadow-xs'
                  : 'text-stone-300 hover:bg-stone-900 hover:text-white'
              }`}
            >
              <Icon className="h-4 w-4 shrink-0" />
              <span>{item[labelKey]}</span>
            </Link>
          );
        })}
      </nav>

      <div className="border-t border-stone-800 p-4 space-y-3 text-xs">
        <Link
          href="/"
          target="_blank"
          className="flex items-center justify-between rounded-xl bg-stone-900 px-3.5 py-2.5 font-semibold text-stone-200 hover:bg-stone-800"
        >
          <span>
            {locale === 'ar' ? 'معاينة المتجر' : locale === 'fr' ? 'Voir la boutique' : 'View Storefront'}
          </span>
          <ExternalLink className="h-3.5 w-3.5" />
        </Link>

        <div className="flex items-center justify-between px-1">
          <div className="min-w-0">
            <p className="truncate font-bold text-white">{admin?.fullName}</p>
            <p className="text-[11px] text-stone-400">{admin?.role}</p>
          </div>
          <button
            type="button"
            onClick={handleLogout}
            className="rounded-lg p-2 text-stone-400 hover:bg-stone-900 hover:text-red-400"
            title="Logout"
          >
            <LogOut className="h-4 w-4" />
          </button>
        </div>
      </div>
    </div>
  );

  return (
    <div className="flex min-h-screen bg-stone-100 text-stone-900">
      {/* Desktop Sidebar */}
      <aside className="hidden w-64 shrink-0 lg:block no-print">{SidebarContent}</aside>

      {/* Mobile Drawer */}
      {sidebarOpen && (
        <div className="fixed inset-0 z-50 flex lg:hidden no-print">
          <div
            className="fixed inset-0 bg-black/50"
            onClick={() => setSidebarOpen(false)}
          />
          <aside className="relative z-10 w-72 max-w-[85vw]">{SidebarContent}</aside>
        </div>
      )}

      {/* Main Column */}
      <div className="flex min-w-0 flex-1 flex-col">
        <header className="sticky top-0 z-30 flex h-16 items-center justify-between border-b border-stone-200 bg-white px-4 sm:px-6 no-print">
          <div className="flex items-center gap-3">
            <button
              type="button"
              onClick={() => setSidebarOpen(true)}
              className="rounded-xl border border-stone-200 p-2 text-stone-700 hover:bg-stone-50 lg:hidden"
            >
              <Menu className="h-5 w-5" />
            </button>
            <span className="text-sm font-bold text-stone-700">
              {NAV_ITEMS.find((n) =>
                n.href === '/admin' ? pathname === '/admin' : pathname?.startsWith(n.href)
              )?.[labelKey] || 'Admin'}
            </span>
          </div>

          <div className="flex items-center gap-2">
            {/* Language Toggle */}
            <div className="flex rounded-xl border border-stone-200 bg-stone-50 p-0.5">
              {(['ar', 'fr', 'en'] as const).map((l) => (
                <button
                  key={l}
                  type="button"
                  onClick={() => setLocale(l)}
                  className={`rounded-lg px-2 py-1 text-[11px] font-bold uppercase ${
                    locale === l
                      ? 'bg-store-primary text-white'
                      : 'text-stone-600 hover:text-stone-900'
                  }`}
                >
                  {l}
                </button>
              ))}
            </div>

            {/* Real-time Notification Bell */}
            <div className="relative">
              <button
                type="button"
                onClick={() => setNotifOpen((v) => !v)}
                className="relative flex h-10 w-10 items-center justify-center rounded-xl border border-stone-200 bg-white text-stone-700 hover:bg-stone-50"
              >
                <Bell className="h-4 w-4" />
                {unreadCount > 0 && (
                  <span className="absolute -top-1 -end-1 flex h-5 min-w-5 items-center justify-center rounded-full bg-amber-600 px-1 text-[10px] font-extrabold text-white">
                    {unreadCount}
                  </span>
                )}
              </button>

              {notifOpen && (
                <div className="absolute end-0 top-full z-50 mt-2 w-80 sm:w-96 overflow-hidden rounded-2xl border border-stone-200 bg-white shadow-2xl">
                  <div className="flex items-center justify-between border-b border-stone-100 px-4 py-3">
                    <span className="text-xs font-extrabold text-stone-900">
                      {locale === 'ar' ? 'الإشعارات الفورية' : 'Notifications'}
                    </span>
                    <button
                      type="button"
                      onClick={markAllRead}
                      className="inline-flex items-center gap-1 text-[11px] font-bold text-store-primary hover:underline"
                    >
                      <CheckCheck className="h-3.5 w-3.5" />
                      <span>{locale === 'ar' ? 'تحديد الكل كمقروء' : 'Mark all read'}</span>
                    </button>
                  </div>
                  <div className="max-h-80 divide-y divide-stone-100 overflow-y-auto">
                    {notifications.length === 0 ? (
                      <p className="p-4 text-center text-xs text-stone-400">—</p>
                    ) : (
                      notifications.map((n) => (
                        <Link
                          key={n.id}
                          href={n.linkUrl || '/admin/orders'}
                          onClick={() => setNotifOpen(false)}
                          className={`block px-4 py-3 text-xs hover:bg-stone-50 ${
                            !n.isRead ? 'bg-emerald-50/40' : ''
                          }`}
                        >
                          <p className="font-bold text-stone-900">{pick(n.titleI18n)}</p>
                          <p className="mt-0.5 text-stone-600">{pick(n.messageI18n)}</p>
                        </Link>
                      ))
                    )}
                  </div>
                </div>
              )}
            </div>
          </div>
        </header>

        {liveToast && (
          <div className="fixed bottom-4 end-4 z-50 max-w-sm rounded-2xl border border-emerald-700 bg-stone-950 p-4 text-white shadow-2xl no-print">
            <div className="flex items-start justify-between gap-2">
              <div>
                <p className="text-xs font-extrabold text-amber-400">
                  {pick(liveToast.titleI18n)}
                </p>
                <p className="mt-1 text-xs text-stone-200">{pick(liveToast.messageI18n)}</p>
              </div>
              <button
                type="button"
                onClick={() => setLiveToast(null)}
                className="text-stone-400 hover:text-white"
              >
                <X className="h-4 w-4" />
              </button>
            </div>
          </div>
        )}

        <main className="flex-1 p-4 sm:p-6 lg:p-8">{children}</main>
      </div>
    </div>
  );
}

