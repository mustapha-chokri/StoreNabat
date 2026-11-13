import type { MetadataRoute } from 'next';
import { and, eq } from 'drizzle-orm';
import { categories, landingPages, products } from '@/db/schema/tenant';
import { withRequestTenantDb } from '@/core/tenancy/context';
import { getEnv } from '@/core/env';

export const dynamic = 'force-dynamic';

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const baseUrl = getEnv().appUrl.replace(/\/$/, '');
  const entries: MetadataRoute.Sitemap = [
    { url: `${baseUrl}/`, changeFrequency: 'daily', priority: 1 },
    { url: `${baseUrl}/shop`, changeFrequency: 'daily', priority: 0.9 },
    { url: `${baseUrl}/track-order`, changeFrequency: 'monthly', priority: 0.5 },
  ];

  try {
    await withRequestTenantDb(async (db, tenant) => {
      const prods = await db
        .select({ slug: products.slug, updatedAt: products.updatedAt })
        .from(products)
        .where(and(eq(products.storeId, tenant.id), eq(products.isPublished, true)));

      for (const p of prods) {
        entries.push({
          url: `${baseUrl}/products/${p.slug}`,
          lastModified: p.updatedAt,
          changeFrequency: 'weekly',
          priority: 0.85,
        });
      }

      const cats = await db
        .select({ slug: categories.slug, updatedAt: categories.updatedAt })
        .from(categories)
        .where(and(eq(categories.storeId, tenant.id), eq(categories.isActive, true)));

      for (const c of cats) {
        entries.push({
          url: `${baseUrl}/shop?category=${c.slug}`,
          lastModified: c.updatedAt,
          changeFrequency: 'weekly',
          priority: 0.7,
        });
      }

      const lps = await db
        .select({ slug: landingPages.slug, updatedAt: landingPages.updatedAt })
        .from(landingPages)
        .where(and(eq(landingPages.storeId, tenant.id), eq(landingPages.isPublished, true)));

      for (const lp of lps) {
        entries.push({
          url: `${baseUrl}/lp/${lp.slug}`,
          lastModified: lp.updatedAt,
          changeFrequency: 'weekly',
          priority: 0.8,
        });
      }
    });
  } catch {
    // Fallback if DB uninitialized during static checks
  }

  return entries;
}

