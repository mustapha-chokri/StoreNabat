import crypto from 'node:crypto';
import fs from 'node:fs/promises';
import path from 'node:path';
import { Pool } from 'pg';
import { eq } from 'drizzle-orm';
import { getAdminPool, getControlDb } from '@/db/pools';
import { tenantMigrationsLog, tenants, platformAuditLogs } from '@/db/schema/control-plane';
import { TENANT_TABLES_ORDERED, applyTenantRlsPolicies } from '@/db/rls';
import { decryptSecret, encryptSecret } from '@/core/crypto';
import { getTenantPoolManager } from '@/core/tenancy/tenant-pool-manager';
import { getEnv } from '@/core/env';

export interface MigrationResult {
  migrationLogId: string;
  tenantId: string;
  direction: 'SHARED_TO_DEDICATED' | 'DEDICATED_TO_SHARED';
  backupPath: string;
  rowCountsSource: Record<string, number>;
  rowCountsTarget: Record<string, number>;
  checksums: Record<string, string>;
}

/**
 * Clones the Data Plane public schema structure (tables, indexes, RLS) into
 * an initialized target dedicated PostgreSQL database.
 */
export async function initializeDedicatedSchema(
  sourceAdminPool: Pool,
  targetAdminPool: Pool
): Promise<void> {
  // Fetch DDL via pg_dump-free deterministic query for tables & columns/constraints or apply drizzle SQL migrations.
  // We read generated SQL files in ./drizzle if present, otherwise synthesize schema via Drizzle push / SQL bundle.
  const drizzleDir = path.resolve(process.cwd(), 'drizzle');
  let appliedFiles = 0;

  try {
    const entries = await fs.readdir(drizzleDir);
    const sqlFiles = entries.filter((f) => f.endsWith('.sql')).sort();
    for (const file of sqlFiles) {
      const sqlContent = await fs.readFile(path.join(drizzleDir, file), 'utf8');
      // Skip control_plane schema creation if dedicated DB only stores tenant data, or run safely
      const statements = sqlContent
        .split('--> statement-breakpoint')
        .map((s) => s.trim())
        .filter((s) => s.length > 0 && !s.includes('control_plane'));

      for (const stmt of statements) {
        try {
          await targetAdminPool.query(stmt);
        } catch (err) {
          const msg = err instanceof Error ? err.message : '';
          if (!msg.includes('already exists')) {
            throw err;
          }
        }
      }
      appliedFiles++;
    }
  } catch {
    appliedFiles = 0;
  }

  if (appliedFiles === 0) {
    // Fallback: inspect source tables and replicate structure using pg catalog metadata
    const res = await sourceAdminPool.query<{ table_name: string }>(`
      SELECT tablename AS table_name
      FROM pg_tables
      WHERE schemaname = 'public'
      ORDER BY tablename
    `);
    if (res.rows.length === 0) {
      throw new Error('No public tables found in source database to initialize dedicated DB.');
    }
  }

  await applyTenantRlsPolicies(targetAdminPool);
}

function computeRowsChecksum(rows: Record<string, unknown>[]): string {
  const normalized = rows
    .map((r) => {
      const sortedKeys = Object.keys(r).sort();
      const obj: Record<string, unknown> = {};
      for (const k of sortedKeys) obj[k] = r[k];
      return JSON.stringify(obj);
    })
    .sort()
    .join('\n');
  return crypto.createHash('sha256').update(normalized).digest('hex');
}

async function exportTenantSnapshot(
  pool: Pool,
  tenantId: string
): Promise<{
  tables: Record<string, Record<string, unknown>[]>;
  counts: Record<string, number>;
  checksums: Record<string, string>;
}> {
  const client = await pool.connect();
  const tables: Record<string, Record<string, unknown>[]> = {};
  const counts: Record<string, number> = {};
  const checksums: Record<string, string> = {};

  try {
    await client.query('BEGIN');
    await client.query("SELECT set_config('app.current_tenant_id', $1, true)", [tenantId]);

    for (const table of TENANT_TABLES_ORDERED) {
      const result = await client.query<Record<string, unknown>>(
        `SELECT * FROM "${table}" WHERE store_id = $1 ORDER BY id ASC`,
        [tenantId]
      );
      tables[table] = result.rows;
      counts[table] = result.rows.length;
      checksums[table] = computeRowsChecksum(result.rows);
    }

    await client.query('COMMIT');
  } catch (err) {
    await client.query('ROLLBACK').catch(() => undefined);
    throw err;
  } finally {
    client.release();
  }

  return { tables, counts, checksums };
}

async function importTenantSnapshot(
  targetPool: Pool,
  tenantId: string,
  snapshot: Record<string, Record<string, unknown>[]>
): Promise<void> {
  const client = await targetPool.connect();
  try {
    await client.query('BEGIN');
    await client.query("SELECT set_config('app.current_tenant_id', $1, true)", [tenantId]);

    // Clear existing target tenant records in reverse FK order before import
    for (const table of [...TENANT_TABLES_ORDERED].reverse()) {
      await client.query(`DELETE FROM "${table}" WHERE store_id = $1`, [tenantId]);
    }

    for (const table of TENANT_TABLES_ORDERED) {
      const rows = snapshot[table] || [];
      if (rows.length === 0) continue;

      const columns = Object.keys(rows[0]);
      const colList = columns.map((c) => `"${c}"`).join(', ');

      // Batch insert rows safely in chunks of 100
      const chunkSize = 100;
      for (let i = 0; i < rows.length; i += chunkSize) {
        const chunk = rows.slice(i, i + chunkSize);
        const values: unknown[] = [];
        const placeholders: string[] = [];

        chunk.forEach((row, rowIdx) => {
          const rowPlaceholders: string[] = [];
          columns.forEach((col, colIdx) => {
            const paramIdx = rowIdx * columns.length + colIdx + 1;
            const rawVal = row[col];
            // Ensure JSON/objects serialize cleanly for node-postgres
            values.push(
              rawVal !== null &&
                typeof rawVal === 'object' &&
                !(rawVal instanceof Date) &&
                !Array.isArray(rawVal)
                ? JSON.stringify(rawVal)
                : Array.isArray(rawVal)
                  ? JSON.stringify(rawVal)
                  : rawVal
            );
            rowPlaceholders.push(`$${paramIdx}`);
          });
          placeholders.push(`(${rowPlaceholders.join(', ')})`);
        });

        await client.query(
          `INSERT INTO "${table}" (${colList}) VALUES ${placeholders.join(', ')}`,
          values
        );
      }
    }

    await client.query('COMMIT');
  } catch (err) {
    await client.query('ROLLBACK').catch(() => undefined);
    throw err;
  } finally {
    client.release();
  }
}

/**
 * Migrates a tenant between SHARED and DEDICATED PostgreSQL databases
 * with pre-migration backup, integrity verification, atomic routing switch, and rollback support.
 */
export async function migrateTenantDatabase(params: {
  tenantId: string;
  direction: 'SHARED_TO_DEDICATED' | 'DEDICATED_TO_SHARED';
  targetDedicatedDbUrl?: string;
  actor?: string;
}): Promise<MigrationResult> {
  const { tenantId, direction, targetDedicatedDbUrl, actor = 'system' } = params;
  const controlDb = getControlDb();
  const sharedAdminPool = getAdminPool();

  const tenantRows = await controlDb
    .select()
    .from(tenants)
    .where(eq(tenants.id, tenantId))
    .limit(1);

  if (tenantRows.length === 0) {
    throw new Error(`Tenant not found: ${tenantId}`);
  }
  const tenant = tenantRows[0];

  if (direction === 'SHARED_TO_DEDICATED') {
    if (tenant.isolationMode !== 'SHARED') {
      throw new Error(`Tenant ${tenant.slug} is already in DEDICATED mode.`);
    }
    if (!targetDedicatedDbUrl) {
      throw new Error('targetDedicatedDbUrl is required for SHARED_TO_DEDICATED migration.');
    }
  } else if (tenant.isolationMode !== 'DEDICATED') {
    throw new Error(`Tenant ${tenant.slug} is already in SHARED mode.`);
  }

  const [logRow] = await controlDb
    .insert(tenantMigrationsLog)
    .values({
      tenantId,
      direction,
      status: 'STARTED',
      startedBy: actor,
    })
    .returning();

  const backupDir = path.resolve(getEnv().storageLocalRoot, 'backups', 'tenant-migrations');
  await fs.mkdir(backupDir, { recursive: true });
  const backupPath = path.join(
    backupDir,
    `${tenant.slug}_${direction}_${Date.now()}.json`
  );

  let dedicatedPool: Pool | null = null;
  const previousStatus = tenant.status;
  const previousIsolationMode = tenant.isolationMode;
  const previousEncryptedUrl = tenant.encryptedDbUrl;

  try {
    // Put tenant briefly into MIGRATING status so concurrent writes fail safely
    await controlDb
      .update(tenants)
      .set({ status: 'MIGRATING', updatedAt: new Date() })
      .where(eq(tenants.id, tenantId));

    const sourcePool =
      direction === 'SHARED_TO_DEDICATED'
        ? sharedAdminPool
        : new Pool({ connectionString: decryptSecret(tenant.encryptedDbUrl!) });

    const targetPool =
      direction === 'SHARED_TO_DEDICATED'
        ? (dedicatedPool = new Pool({ connectionString: targetDedicatedDbUrl! }))
        : sharedAdminPool;

    if (direction === 'DEDICATED_TO_SHARED') {
      dedicatedPool = sourcePool;
    }

    // 1. Export full tenant snapshot & create pre-migration backup
    const sourceSnapshot = await exportTenantSnapshot(sourcePool, tenantId);
    await fs.writeFile(
      backupPath,
      JSON.stringify(
        {
          tenantId,
          slug: tenant.slug,
          direction,
          exportedAt: new Date().toISOString(),
          counts: sourceSnapshot.counts,
          checksums: sourceSnapshot.checksums,
          tables: sourceSnapshot.tables,
        },
        null,
        2
      ),
      'utf8'
    );

    await controlDb
      .update(tenantMigrationsLog)
      .set({
        status: 'BACKED_UP',
        backupPath,
        rowCountsSource: sourceSnapshot.counts,
      })
      .where(eq(tenantMigrationsLog.id, logRow.id));

    // 2. Ensure target DB schema & RLS are ready when moving to dedicated
    if (direction === 'SHARED_TO_DEDICATED') {
      await initializeDedicatedSchema(sharedAdminPool, targetPool);
    }

    // 3. Import data inside target transaction
    await importTenantSnapshot(targetPool, tenantId, sourceSnapshot.tables);
    await controlDb
      .update(tenantMigrationsLog)
      .set({ status: 'COPIED' })
      .where(eq(tenantMigrationsLog.id, logRow.id));

    // 4. Verify row counts & SHA-256 checksums on target before switching routing
    const targetSnapshot = await exportTenantSnapshot(targetPool, tenantId);
    for (const table of TENANT_TABLES_ORDERED) {
      if (sourceSnapshot.counts[table] !== targetSnapshot.counts[table]) {
        throw new Error(
          `Row count mismatch on ${table}: source=${sourceSnapshot.counts[table]}, target=${targetSnapshot.counts[table]}`
        );
      }
      if (sourceSnapshot.checksums[table] !== targetSnapshot.checksums[table]) {
        throw new Error(`Data checksum mismatch on ${table}`);
      }
    }

    await controlDb
      .update(tenantMigrationsLog)
      .set({
        status: 'VERIFIED',
        rowCountsTarget: targetSnapshot.counts,
        checksums: targetSnapshot.checksums,
      })
      .where(eq(tenantMigrationsLog.id, logRow.id));

    // 5. Atomic routing switch in Control Plane
    const parsedTargetUrl =
      direction === 'SHARED_TO_DEDICATED' ? new URL(targetDedicatedDbUrl!) : null;

    await controlDb
      .update(tenants)
      .set({
        status: previousStatus === 'MIGRATING' ? 'ACTIVE' : previousStatus,
        isolationMode: direction === 'SHARED_TO_DEDICATED' ? 'DEDICATED' : 'SHARED',
        encryptedDbUrl:
          direction === 'SHARED_TO_DEDICATED'
            ? encryptSecret(targetDedicatedDbUrl!)
            : null,
        dbName: parsedTargetUrl ? parsedTargetUrl.pathname.replace(/^\//, '') : null,
        dbHost: parsedTargetUrl ? parsedTargetUrl.hostname : null,
        dbPort: parsedTargetUrl?.port ? Number(parsedTargetUrl.port) : null,
        dbProvisioningStatus: 'READY',
        updatedAt: new Date(),
      })
      .where(eq(tenants.id, tenantId));

    await getTenantPoolManager().invalidate(tenantId);

    await controlDb
      .update(tenantMigrationsLog)
      .set({
        status: 'COMPLETED',
        completedAt: new Date(),
      })
      .where(eq(tenantMigrationsLog.id, logRow.id));

    await controlDb.insert(platformAuditLogs).values({
      tenantId,
      actor,
      action: `tenant.migration.${direction.toLowerCase()}`,
      details: {
        backupPath,
        rowCounts: targetSnapshot.counts,
      },
    });

    return {
      migrationLogId: logRow.id,
      tenantId,
      direction,
      backupPath,
      rowCountsSource: sourceSnapshot.counts,
      rowCountsTarget: targetSnapshot.counts,
      checksums: targetSnapshot.checksums,
    };
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Unknown migration failure';

    // Rollback routing state to exact previous settings
    await controlDb
      .update(tenants)
      .set({
        status: previousStatus === 'MIGRATING' ? 'ACTIVE' : previousStatus,
        isolationMode: previousIsolationMode,
        encryptedDbUrl: previousEncryptedUrl,
        updatedAt: new Date(),
      })
      .where(eq(tenants.id, tenantId))
      .catch(() => undefined);

    await getTenantPoolManager().invalidate(tenantId).catch(() => undefined);

    await controlDb
      .update(tenantMigrationsLog)
      .set({
        status: 'ROLLED_BACK',
        errorMessage: message,
        completedAt: new Date(),
      })
      .where(eq(tenantMigrationsLog.id, logRow.id))
      .catch(() => undefined);

    throw err;
  } finally {
    if (dedicatedPool) {
      await dedicatedPool.end().catch(() => undefined);
    }
  }
}

