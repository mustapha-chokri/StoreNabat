import {
  pgSchema,
  uuid,
  varchar,
  text,
  boolean,
  integer,
  jsonb,
  timestamp,
  index,
} from 'drizzle-orm/pg-core';

/**
 * Central Control Plane schema managing tenant registry, domain mapping,
 * isolation strategy (SHARED vs DEDICATED), and database migration logs.
 */
export const controlPlaneSchema = pgSchema('control_plane');

export const tenants = controlPlaneSchema.table(
  'tenants',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    slug: varchar('slug', { length: 100 }).notNull().unique(),
    name: varchar('name', { length: 200 }).notNull(),
    status: varchar('status', { length: 30 }).notNull().default('ACTIVE'),
    isolationMode: varchar('isolation_mode', { length: 20 }).notNull().default('SHARED'),
    encryptedDbUrl: text('encrypted_db_url'),
    dbName: varchar('db_name', { length: 120 }),
    dbHost: varchar('db_host', { length: 255 }),
    dbPort: integer('db_port'),
    dbProvisioningStatus: varchar('db_provisioning_status', { length: 30 }).notNull().default('READY'),
    migrationVersion: varchar('migration_version', { length: 50 }).notNull().default('0001'),
    planTier: varchar('plan_tier', { length: 50 }).notNull().default('STANDALONE'),
    featureFlags: jsonb('feature_flags').$type<Record<string, boolean>>().notNull().default({}),
    usageLimits: jsonb('usage_limits').$type<Record<string, number>>().notNull().default({}),
    isDefault: boolean('is_default').notNull().default(false),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    index('idx_tenants_status').on(table.status),
    index('idx_tenants_is_default').on(table.isDefault),
  ]
);

export const tenantDomains = controlPlaneSchema.table(
  'tenant_domains',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    tenantId: uuid('tenant_id')
      .notNull()
      .references(() => tenants.id, { onDelete: 'cascade' }),
    domain: varchar('domain', { length: 255 }).notNull().unique(),
    isPrimary: boolean('is_primary').notNull().default(false),
    isVerified: boolean('is_verified').notNull().default(false),
    sslStatus: varchar('ssl_status', { length: 30 }).notNull().default('PENDING'),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [index('idx_tenant_domains_tenant_id').on(table.tenantId)]
);

export const tenantMigrationsLog = controlPlaneSchema.table(
  'tenant_migrations_log',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    tenantId: uuid('tenant_id')
      .notNull()
      .references(() => tenants.id, { onDelete: 'cascade' }),
    direction: varchar('direction', { length: 40 }).notNull(),
    status: varchar('status', { length: 30 }).notNull(),
    backupPath: text('backup_path'),
    rowCountsSource: jsonb('row_counts_source').$type<Record<string, number>>(),
    rowCountsTarget: jsonb('row_counts_target').$type<Record<string, number>>(),
    checksums: jsonb('checksums').$type<Record<string, string>>(),
    errorMessage: text('error_message'),
    startedBy: varchar('started_by', { length: 150 }).notNull().default('system'),
    startedAt: timestamp('started_at', { withTimezone: true }).notNull().defaultNow(),
    completedAt: timestamp('completed_at', { withTimezone: true }),
  },
  (table) => [index('idx_tenant_migrations_tenant_id').on(table.tenantId)]
);

export const platformAuditLogs = controlPlaneSchema.table(
  'platform_audit_logs',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    tenantId: uuid('tenant_id'),
    actor: varchar('actor', { length: 150 }).notNull(),
    action: varchar('action', { length: 120 }).notNull(),
    details: jsonb('details').$type<Record<string, unknown>>().notNull().default({}),
    ipAddress: varchar('ip_address', { length: 64 }),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [index('idx_platform_audit_tenant_id').on(table.tenantId)]
);

