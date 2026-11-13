import {
  pgTable,
  uuid,
  varchar,
  text,
  boolean,
  jsonb,
  timestamp,
  index,
  uniqueIndex,
} from 'drizzle-orm/pg-core';
import type { AdminRole, I18nMap } from '../types';

export const adminUsers = pgTable(
  'admin_users',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    storeId: uuid('store_id').notNull(),
    email: varchar('email', { length: 255 }).notNull(),
    passwordHash: text('password_hash').notNull(),
    fullName: varchar('full_name', { length: 160 }).notNull(),
    role: varchar('role', { length: 40 }).$type<AdminRole>().notNull().default('EDITOR'),
    permissions: jsonb('permissions').$type<string[]>().notNull().default([]),
    preferredLocale: varchar('preferred_locale', { length: 10 }).notNull().default('ar'),
    isActive: boolean('is_active').notNull().default(true),
    lastLoginAt: timestamp('last_login_at', { withTimezone: true }),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    uniqueIndex('uq_admin_users_store_email').on(table.storeId, table.email),
    index('idx_admin_users_store_id').on(table.storeId),
  ]
);

export const adminSessions = pgTable(
  'admin_sessions',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    storeId: uuid('store_id').notNull(),
    adminUserId: uuid('admin_user_id')
      .notNull()
      .references(() => adminUsers.id, { onDelete: 'cascade' }),
    tokenHash: varchar('token_hash', { length: 128 }).notNull().unique(),
    ipAddress: varchar('ip_address', { length: 64 }),
    userAgent: text('user_agent'),
    expiresAt: timestamp('expires_at', { withTimezone: true }).notNull(),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    index('idx_admin_sessions_store_user').on(table.storeId, table.adminUserId),
    index('idx_admin_sessions_expires').on(table.expiresAt),
  ]
);

export const auditLogs = pgTable(
  'audit_logs',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    storeId: uuid('store_id').notNull(),
    adminUserId: uuid('admin_user_id'),
    actorEmail: varchar('actor_email', { length: 255 }),
    action: varchar('action', { length: 120 }).notNull(),
    entityType: varchar('entity_type', { length: 60 }),
    entityId: varchar('entity_id', { length: 100 }),
    metadata: jsonb('metadata').$type<Record<string, unknown>>().notNull().default({}),
    ipAddress: varchar('ip_address', { length: 64 }),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [index('idx_audit_logs_store_created').on(table.storeId, table.createdAt)]
);

export const notifications = pgTable(
  'notifications',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    storeId: uuid('store_id').notNull(),
    type: varchar('type', { length: 50 }).notNull(),
    titleI18n: jsonb('title_i18n').$type<I18nMap>().notNull(),
    messageI18n: jsonb('message_i18n').$type<I18nMap>().notNull(),
    linkUrl: text('link_url'),
    entityType: varchar('entity_type', { length: 50 }),
    entityId: varchar('entity_id', { length: 100 }),
    isRead: boolean('is_read').notNull().default(false),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [index('idx_notifications_store_unread').on(table.storeId, table.isRead, table.createdAt)]
);

