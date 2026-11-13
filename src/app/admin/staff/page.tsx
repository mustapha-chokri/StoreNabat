'use client';

import React, { useCallback, useEffect, useState } from 'react';
import { Database, Loader2, Shield, UserPlus } from 'lucide-react';
import { AdminShell } from '@/components/admin/AdminShell';
import { useStore } from '@/components/providers/StoreContextProvider';

interface StaffRow {
  id: string;
  email: string;
  fullName: string;
  role: 'OWNER' | 'ADMIN' | 'MANAGER' | 'CONFIRMATOR' | 'EDITOR';
  isActive: boolean;
  lastLoginAt: string | null;
}

interface AuditLogRow {
  id: string;
  actorEmail: string | null;
  action: string;
  entityType: string;
  createdAt: string;
}

interface TenancyInfo {
  id: string;
  slug: string;
  name: string;
  status: string;
  isolationMode: 'SHARED' | 'DEDICATED';
  migrationVersion: number;
  planTier: string;
  domains: Array<{ host: string; isPrimary: boolean }>;
}

export default function AdminStaffAndSecurityPage() {
  const { locale } = useStore();
  const ar = locale === 'ar';

  const [staff, setStaff] = useState<StaffRow[]>([]);
  const [auditLogs, setAuditLogs] = useState<AuditLogRow[]>([]);
  const [tenancy, setTenancy] = useState<TenancyInfo | null>(null);
  const [loading, setLoading] = useState(true);

  const [email, setEmail] = useState('');
  const [fullName, setFullName] = useState('');
  const [password, setPassword] = useState('');
  const [role, setRole] = useState<'ADMIN' | 'MANAGER' | 'CONFIRMATOR' | 'EDITOR'>('CONFIRMATOR');
  const [errMsg, setErrMsg] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch('/api/admin/staff');
      if (res.ok) {
        const d = await res.json();
        setStaff(d.staff || []);
        setAuditLogs(d.auditLogs || []);
        setTenancy(d.tenancy || null);
      }
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  async function handleCreateStaff(e: React.FormEvent) {
    e.preventDefault();
    setErrMsg(null);
    const res = await fetch('/api/admin/staff', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email, fullName, password, role, preferredLocale: 'ar' }),
    });
    const d = await res.json();
    if (!res.ok) {
      setErrMsg(d.error || 'Failed');
      return;
    }
    setEmail('');
    setFullName('');
    setPassword('');
    await load();
  }

  async function toggleActive(member: StaffRow) {
    await fetch('/api/admin/staff', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id: member.id, isActive: !member.isActive }),
    });
    await load();
  }

  return (
    <AdminShell>
      {loading ? (
        <div className="flex justify-center py-20">
          <Loader2 className="h-7 w-7 animate-spin text-store-primary" />
        </div>
      ) : (
        <div className="space-y-6">
          {/* Hybrid Multi-Tenant Isolation Status */}
          {tenancy && (
            <div className="rounded-2xl border border-emerald-900/20 bg-emerald-950 p-5 text-white space-y-2">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div className="flex items-center gap-2 font-extrabold">
                  <Database className="h-5 w-5 text-amber-400" />
                  <span>
                    {ar ? 'حالة عزل قاعدة بيانات المتجر (Hybrid Multi-Tenant)' : 'Tenant Database Isolation Status'}
                  </span>
                </div>
                <span className="rounded-full bg-amber-500 px-3 py-0.5 text-xs font-extrabold text-stone-950">
                  {tenancy.isolationMode} • {tenancy.status}
                </span>
              </div>
              <p className="text-xs text-emerald-100">
                Store ID: <code dir="ltr">{tenancy.id}</code> • Slug: <code>{tenancy.slug}</code> •
                Version: <code>v{tenancy.migrationVersion}</code>
              </p>
              <p className="text-[11px] text-emerald-200/80">
                Domains: {tenancy.domains.map((d) => d.host).join(', ')}
              </p>
            </div>
          )}

          <div className="grid grid-cols-1 gap-6 lg:grid-cols-12">
            {/* Add Staff Member */}
            <form
              onSubmit={handleCreateStaff}
              className="rounded-2xl border border-stone-200 bg-white p-5 space-y-3 lg:col-span-4 h-fit text-xs"
            >
              <h2 className="flex items-center gap-2 text-sm font-extrabold">
                <UserPlus className="h-4 w-4 text-store-primary" />
                {ar ? 'إضافة موظف / مؤكد طلبات' : 'Add Staff Member'}
              </h2>
              <input
                required
                value={fullName}
                onChange={(e) => setFullName(e.target.value)}
                placeholder={ar ? 'الاسم الكامل' : 'Full Name'}
                className="w-full rounded-xl border border-stone-300 px-3 py-2"
              />
              <input
                required
                type="email"
                dir="ltr"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="staff@nabatalatlas.ma"
                className="w-full rounded-xl border border-stone-300 px-3 py-2 text-start"
              />
              <input
                required
                type="password"
                minLength={8}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="Password (8+ chars)"
                className="w-full rounded-xl border border-stone-300 px-3 py-2"
              />
              <select
                value={role}
                onChange={(e) => setRole(e.target.value as typeof role)}
                className="w-full rounded-xl border border-stone-300 px-3 py-2 font-bold"
              >
                <option value="ADMIN">ADMIN</option>
                <option value="MANAGER">MANAGER</option>
                <option value="CONFIRMATOR">CONFIRMATOR (تأكيد الطلبات)</option>
                <option value="EDITOR">EDITOR</option>
              </select>
              {errMsg && <p className="text-red-600">{errMsg}</p>}
              <button
                type="submit"
                className="btn-store-primary w-full py-2.5 font-extrabold"
              >
                {ar ? 'إنشاء حساب الموظف' : 'Create Staff'}
              </button>
            </form>

            {/* Staff List */}
            <div className="rounded-2xl border border-stone-200 bg-white p-5 lg:col-span-8 space-y-3">
              <h2 className="flex items-center gap-2 text-sm font-extrabold">
                <Shield className="h-4 w-4 text-store-primary" />
                {ar ? 'فريق العمل والصلاحيات (RBAC)' : 'Staff & Permissions'}
              </h2>
              <div className="divide-y divide-stone-100 text-xs">
                {staff.map((m) => (
                  <div key={m.id} className="flex items-center justify-between py-3">
                    <div>
                      <p className="font-bold text-stone-900">
                        {m.fullName}{' '}
                        <span className="rounded-md bg-stone-100 px-2 py-0.5 text-[10px] font-extrabold">
                          {m.role}
                        </span>
                      </p>
                      <p dir="ltr" className="text-stone-500">
                        {m.email}
                      </p>
                    </div>
                    {m.role !== 'OWNER' && (
                      <button
                        type="button"
                        onClick={() => toggleActive(m)}
                        className={`rounded-xl px-3 py-1.5 font-bold ${
                          m.isActive
                            ? 'bg-emerald-50 text-emerald-900'
                            : 'bg-red-50 text-red-700'
                        }`}
                      >
                        {m.isActive ? (ar ? 'نشط' : 'Active') : ar ? 'معطل' : 'Disabled'}
                      </button>
                    )}
                  </div>
                ))}
              </div>
            </div>
          </div>

          {/* Audit Logs */}
          <div className="rounded-2xl border border-stone-200 bg-white p-5 space-y-3">
            <h2 className="text-sm font-extrabold">{ar ? 'سجل التدقيق الأمني' : 'Security Audit Logs'}</h2>
            <div className="divide-y divide-stone-100 text-xs">
              {auditLogs.map((log) => (
                <div key={log.id} className="flex flex-wrap justify-between py-2">
                  <div>
                    <span className="font-mono font-bold text-stone-800">{log.action}</span>{' '}
                    <span className="text-stone-400">({log.entityType})</span>
                  </div>
                  <span dir="ltr" className="text-stone-400">
                    {log.actorEmail || 'system'} • {new Date(log.createdAt).toLocaleString()}
                  </span>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}
    </AdminShell>
  );
}

