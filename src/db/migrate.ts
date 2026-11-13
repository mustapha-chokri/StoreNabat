import '@/core/load-env';
import fs from 'node:fs/promises';
import path from 'node:path';
import { getAdminPool } from '@/db/pools';
import { applyTenantRlsPolicies, ensureRuntimeRole } from '@/db/rls';
import { getEnv } from '@/core/env';

async function main() {
  const adminPool = getAdminPool();
  const env = getEnv();

  console.log('Ensuring control_plane schema exists...');
  await adminPool.query('CREATE SCHEMA IF NOT EXISTS control_plane;');

  const drizzleDir = path.resolve(process.cwd(), 'drizzle');
  const files = (await fs.readdir(drizzleDir).catch(() => []))
    .filter((f) => f.endsWith('.sql'))
    .sort();

  if (files.length === 0) {
    throw new Error(
      'No SQL migrations found in ./drizzle. Run `npm run db:generate` first.'
    );
  }

  await adminPool.query(`
    CREATE TABLE IF NOT EXISTS control_plane.schema_migrations (
      filename varchar(255) PRIMARY KEY,
      applied_at timestamptz NOT NULL DEFAULT now()
    );
  `);

  for (const file of files) {
    const already = await adminPool.query(
      'SELECT 1 FROM control_plane.schema_migrations WHERE filename = $1',
      [file]
    );
    if (already.rows.length > 0) {
      console.log(`Skipping already applied migration: ${file}`);
      continue;
    }

    console.log(`Applying migration: ${file}...`);
    const sqlContent = await fs.readFile(path.join(drizzleDir, file), 'utf8');
    const statements = sqlContent
      .split('--> statement-breakpoint')
      .map((s) => s.trim())
      .filter((s) => s.length > 0);

    const client = await adminPool.connect();
    try {
      await client.query('BEGIN');
      for (const rawStmt of statements) {
        const stmt = rawStmt.replace(
          /^CREATE SCHEMA\s+"([^"]+)"/i,
          'CREATE SCHEMA IF NOT EXISTS "$1"'
        );
        await client.query(stmt);
      }
      await client.query(
        'INSERT INTO control_plane.schema_migrations (filename) VALUES ($1)',
        [file]
      );
      await client.query('COMMIT');
      console.log(`Applied ${file} successfully.`);
    } catch (err) {
      await client.query('ROLLBACK');
      throw err;
    } finally {
      client.release();
    }
  }

  // Ensure restricted NOBYPASSRLS runtime user if DATABASE_URL specifies one
  const runtimeUrl = new URL(env.databaseUrl);
  const runtimeRole = decodeURIComponent(runtimeUrl.username || 'app_runtime');
  const runtimePass = decodeURIComponent(runtimeUrl.password || '');
  const adminUrl = new URL(env.databaseAdminUrl);
  const adminUser = decodeURIComponent(adminUrl.username || 'postgres');

  if (runtimeRole && runtimeRole !== adminUser && runtimePass) {
    console.log(`Configuring restricted runtime role "${runtimeRole}" (NOBYPASSRLS)...`);
    await ensureRuntimeRole(adminPool, runtimeRole, runtimePass);
  }

  console.log('Applying Row-Level Security (RLS) policies to all tenant tables...');
  await applyTenantRlsPolicies(adminPool);

  console.log('Database migrations and RLS setup complete.');
  await adminPool.end();
}

main().catch((err) => {
  console.error('Migration failed:', err);
  process.exit(1);
});
