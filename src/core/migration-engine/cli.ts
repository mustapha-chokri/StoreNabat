import '@/core/load-env';
import { migrateTenantDatabase } from './index';
import { resolveTenantBySlug } from '@/core/tenancy/resolver';

async function main() {
  const args = process.argv.slice(2);
  const slug = args[0];
  const direction = args[1] as 'SHARED_TO_DEDICATED' | 'DEDICATED_TO_SHARED' | undefined;
  const targetUrl = args[2];

  if (!slug || !direction) {
    console.error(
      'Usage: npm run tenant:migrate <tenant-slug> <SHARED_TO_DEDICATED|DEDICATED_TO_SHARED> [targetDedicatedDbUrl]'
    );
    process.exit(1);
  }

  const tenant = await resolveTenantBySlug(slug);
  const result = await migrateTenantDatabase({
    tenantId: tenant.id,
    direction,
    targetDedicatedDbUrl: targetUrl,
    actor: 'cli-operator',
  });

  console.log('Tenant migration completed successfully:', JSON.stringify(result, null, 2));
  process.exit(0);
}

main().catch((err) => {
  console.error('Tenant migration failed:', err);
  process.exit(1);
});
