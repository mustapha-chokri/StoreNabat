import type { Pool } from 'pg';

/**
 * Complete list of Data Plane tenant-scoped tables in topological parent-before-child order
 * for foreign-key-safe export/import and Row-Level Security enforcement.
 */
export const TENANT_TABLES_ORDERED = [
  'store_settings',
  'store_themes',
  'store_translations',
  'store_menus',
  'hero_sliders',
  'homepage_sections',
  'admin_users',
  'admin_sessions',
  'audit_logs',
  'notifications',
  'categories',
  'products',
  'product_media',
  'product_variants',
  'product_bundle_items',
  'digital_files',
  'digital_downloads',
  'product_reviews',
  'inventory_movements',
  'shipping_zones',
  'shipping_cities',
  'shipping_providers',
  'customers',
  'customer_addresses',
  'customer_sessions',
  'password_reset_tokens',
  'coupons',
  'carts',
  'cart_items',
  'orders',
  'order_items',
  'order_status_history',
  'payment_gateway_configs',
  'payment_transactions',
  'webhook_logs',
  'landing_pages',
  'thank_you_rules',
  'tracking_configs',
  'whatsapp_configs',
  'whatsapp_logs',
] as const;

export type TenantTableName = (typeof TENANT_TABLES_ORDERED)[number];

/**
 * Generates idempotent SQL to enforce PostgreSQL Row-Level Security (RLS)
 * on every tenant-owned table, including FORCE ROW LEVEL SECURITY.
 */
export function buildRlsSql(): string {
  const statements: string[] = [];

  for (const table of TENANT_TABLES_ORDERED) {
    statements.push(`
      ALTER TABLE "${table}" ENABLE ROW LEVEL SECURITY;
      ALTER TABLE "${table}" FORCE ROW LEVEL SECURITY;
      DROP POLICY IF EXISTS "tenant_isolation_policy" ON "${table}";
      CREATE POLICY "tenant_isolation_policy" ON "${table}"
        FOR ALL
        USING (store_id = NULLIF(current_setting('app.current_tenant_id', true), '')::uuid)
        WITH CHECK (store_id = NULLIF(current_setting('app.current_tenant_id', true), '')::uuid);
    `);
  }

  return statements.join('\n');
}

/**
 * Ensures the restricted non-superuser runtime role (`app_runtime`) exists
 * with NOBYPASSRLS and proper table privileges.
 */
export async function ensureRuntimeRole(
  adminPool: Pool,
  runtimeRoleName: string,
  runtimePassword: string
): Promise<void> {
  const safeRole = runtimeRoleName.replace(/[^a-zA-Z0-9_]/g, '');
  if (!safeRole) throw new Error('Invalid runtime role name.');

  const escapedPw = runtimePassword.replace(/'/g, "''");
  const existsRes = await adminPool.query('SELECT 1 FROM pg_roles WHERE rolname = $1', [safeRole]);

  if (existsRes.rows.length === 0) {
    await adminPool.query(
      `CREATE ROLE "${safeRole}" WITH LOGIN PASSWORD '${escapedPw}' NOSUPERUSER NOCREATEDB NOCREATEROLE NOBYPASSRLS;`
    );
  } else {
    await adminPool.query(
      `ALTER ROLE "${safeRole}" WITH LOGIN PASSWORD '${escapedPw}' NOSUPERUSER NOCREATEDB NOCREATEROLE NOBYPASSRLS;`
    );
  }

  await adminPool.query(`GRANT USAGE ON SCHEMA public TO "${safeRole}";`);
  await adminPool.query(
    `GRANT SELECT, INSERT, UPDATE, DELETE ON ALL TABLES IN SCHEMA public TO "${safeRole}";`
  );
  await adminPool.query(
    `GRANT USAGE, SELECT ON ALL SEQUENCES IN SCHEMA public TO "${safeRole}";`
  );
  await adminPool.query(
    `ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT SELECT, INSERT, UPDATE, DELETE ON TABLES TO "${safeRole}";`
  );
}

/**
 * Applies Row-Level Security policies across all tenant tables on a given PostgreSQL pool.
 */
export async function applyTenantRlsPolicies(adminPool: Pool): Promise<void> {
  const sql = buildRlsSql();
  await adminPool.query(sql);
}
