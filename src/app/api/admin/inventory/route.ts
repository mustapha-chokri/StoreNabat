import { NextRequest, NextResponse } from 'next/server';
import { desc, eq } from 'drizzle-orm';
import { z } from 'zod';
import { inventoryMovements, products, productVariants } from '@/db/schema/tenant';
import { getRequestTenant, withTenantDb } from '@/core/tenancy/context';
import { requireAdmin } from '@/core/auth/admin-session';
import { adjustManualStock } from '@/services/inventory';
import { assertSameOrigin, errorResponse } from '@/core/http/api';

const AdjustStockSchema = z.object({
  productId: z.string().uuid(),
  variantId: z.string().uuid().nullable().optional(),
  newQuantity: z.number().int().min(0).max(1_000_000),
  note: z.string().max(400).optional(),
});

export async function GET() {
  try {
    const tenant = await getRequestTenant();
    await requireAdmin(tenant, 'products.read');

    const data = await withTenantDb(tenant, async (db) => {
      const productList = await db
        .select()
        .from(products)
        .where(eq(products.storeId, tenant.id))
        .orderBy(desc(products.createdAt));

      const variantList = await db
        .select()
        .from(productVariants)
        .where(eq(productVariants.storeId, tenant.id));

      const movements = await db
        .select()
        .from(inventoryMovements)
        .where(eq(inventoryMovements.storeId, tenant.id))
        .orderBy(desc(inventoryMovements.createdAt))
        .limit(100);

      return { products: productList, variants: variantList, movements };
    });

    return NextResponse.json(data);
  } catch (err) {
    return errorResponse(err);
  }
}

export async function POST(req: NextRequest) {
  const csrfErr = assertSameOrigin(req);
  if (csrfErr) return csrfErr;

  try {
    const tenant = await getRequestTenant();
    const admin = await requireAdmin(tenant, 'inventory.write');
    const body = AdjustStockSchema.parse(await req.json());

    await withTenantDb(tenant, async (db) => {
      await adjustManualStock(db, {
        storeId: tenant.id,
        productId: body.productId,
        variantId: body.variantId || null,
        newQuantity: body.newQuantity,
        note: body.note,
        actorEmail: admin.email,
      });
    });

    return NextResponse.json({ ok: true });
  } catch (err) {
    return errorResponse(err);
  }
}

