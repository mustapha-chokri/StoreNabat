import crypto from 'node:crypto';
import { Pool } from 'pg';
import { decryptSecret } from '@/core/crypto';

interface CachedPoolEntry {
  pool: Pool;
  urlHash: string;
  lastUsedAt: number;
}

/**
 * Bounded LRU connection pool manager for DEDICATED tenant PostgreSQL databases.
 * Prevents socket exhaustion when scaling to many dedicated stores.
 */
class TenantPoolManager {
  private readonly pools = new Map<string, CachedPoolEntry>();
  private readonly maxPools: number;

  constructor(maxPools = 25) {
    this.maxPools = maxPools;
  }

  getPool(tenantId: string, encryptedDbUrl: string): Pool {
    const dbUrl = decryptSecret(encryptedDbUrl);
    const urlHash = crypto.createHash('sha256').update(dbUrl).digest('hex');

    const existing = this.pools.get(tenantId);
    if (existing) {
      if (existing.urlHash === urlHash) {
        existing.lastUsedAt = Date.now();
        // Refresh insertion order for LRU
        this.pools.delete(tenantId);
        this.pools.set(tenantId, existing);
        return existing.pool;
      }
      // Connection string changed (e.g. post-migration); close old pool safely
      void existing.pool.end().catch(() => undefined);
      this.pools.delete(tenantId);
    }

    if (this.pools.size >= this.maxPools) {
      const oldestKey = this.pools.keys().next().value;
      if (oldestKey) {
        const oldest = this.pools.get(oldestKey);
        this.pools.delete(oldestKey);
        if (oldest) {
          void oldest.pool.end().catch(() => undefined);
        }
      }
    }

    const pool = new Pool({
      connectionString: dbUrl,
      max: 10,
      idleTimeoutMillis: 30_000,
      connectionTimeoutMillis: 5_000,
    });

    this.pools.set(tenantId, {
      pool,
      urlHash,
      lastUsedAt: Date.now(),
    });

    return pool;
  }

  async invalidate(tenantId: string): Promise<void> {
    const existing = this.pools.get(tenantId);
    if (existing) {
      this.pools.delete(tenantId);
      await existing.pool.end().catch(() => undefined);
    }
  }

  async shutdownAll(): Promise<void> {
    const closing = Array.from(this.pools.values()).map((entry) =>
      entry.pool.end().catch(() => undefined)
    );
    this.pools.clear();
    await Promise.all(closing);
  }
}

const globalForPools = globalThis as unknown as {
  __tenantPoolManager?: TenantPoolManager;
};

export function getTenantPoolManager(): TenantPoolManager {
  if (!globalForPools.__tenantPoolManager) {
    globalForPools.__tenantPoolManager = new TenantPoolManager(25);
  }
  return globalForPools.__tenantPoolManager;
}

