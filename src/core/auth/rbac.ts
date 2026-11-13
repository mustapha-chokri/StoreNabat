import type { AdminRole } from '@/db/schema/types';

export type Permission =
  | 'analytics.view'
  | 'orders.read'
  | 'orders.write'
  | 'orders.export'
  | 'products.read'
  | 'products.write'
  | 'inventory.write'
  | 'customers.read'
  | 'customers.write'
  | 'shipping.write'
  | 'payments.write'
  | 'marketing.write'
  | 'landing.write'
  | 'storefront.write'
  | 'settings.write'
  | 'staff.manage'
  | 'whatsapp.send'
  | 'tenancy.view';

const ROLE_DEFAULTS: Record<AdminRole, Permission[] | ['*']> = {
  OWNER: ['*'],
  ADMIN: ['*'],
  MANAGER: [
    'analytics.view',
    'orders.read',
    'orders.write',
    'orders.export',
    'products.read',
    'products.write',
    'inventory.write',
    'customers.read',
    'customers.write',
    'shipping.write',
    'marketing.write',
    'landing.write',
    'whatsapp.send',
  ],
  CONFIRMATOR: ['orders.read', 'orders.write', 'customers.read', 'whatsapp.send'],
  EDITOR: ['products.read', 'products.write', 'landing.write', 'storefront.write'],
};

export function getEffectivePermissions(
  role: AdminRole,
  customPermissions: string[] = []
): Set<string> {
  const defaults = ROLE_DEFAULTS[role] || [];
  if ((defaults as string[]).includes('*') || customPermissions.includes('*')) {
    return new Set(['*']);
  }
  return new Set([...defaults, ...customPermissions]);
}

export function hasPermission(
  role: AdminRole,
  customPermissions: string[],
  required: Permission
): boolean {
  const effective = getEffectivePermissions(role, customPermissions);
  return effective.has('*') || effective.has(required);
}

