import React, { Suspense } from 'react';
import { and, asc, eq } from 'drizzle-orm';
import { categories } from '@/db/schema/tenant';
import { getRequestTenant, withTenantDb } from '@/core/tenancy/context';
import { StorefrontShell } from '@/components/storefront/StorefrontShell';
import {
  ShopListingClient,
  type ShopCategoryOption,
} from '@/components/storefront/ShopListingClient';

export const dynamic = 'force-dynamic';

export default async function ShopPage() {
  let categoryList: ShopCategoryOption[] = [];
  try {
    const tenant = await getRequestTenant();
    categoryList = await withTenantDb(tenant, (db) =>
      db
        .select({
          id: categories.id,
          slug: categories.slug,
          nameI18n: categories.nameI18n,
        })
        .from(categories)
        .where(and(eq(categories.storeId, tenant.id), eq(categories.isActive, true)))
        .orderBy(asc(categories.sortOrder))
    );
  } catch {
    categoryList = [];
  }

  return (
    <StorefrontShell>
      <Suspense fallback={<div className="p-12 text-center text-sm">...</div>}>
        <ShopListingClient categories={categoryList} />
      </Suspense>
    </StorefrontShell>
  );
}

