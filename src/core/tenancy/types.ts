import type { TenantIsolationMode, TenantStatus } from '@/db/schema/types';

export interface ResolvedTenant {
  id: string;
  slug: string;
  name: string;
  status: TenantStatus;
  isolationMode: TenantIsolationMode;
  encryptedDbUrl: string | null;
  migrationVersion: string;
  planTier: string;
  isDefault: boolean;
}

