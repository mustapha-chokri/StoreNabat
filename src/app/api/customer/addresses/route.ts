import { NextRequest, NextResponse } from 'next/server';
import { and, eq } from 'drizzle-orm';
import { z } from 'zod';
import { customerAddresses } from '@/db/schema/tenant';
import { getRequestTenant, withTenantDb } from '@/core/tenancy/context';
import { getAuthenticatedCustomer } from '@/core/auth/customer-session';
import { assertSameOrigin, errorResponse } from '@/core/http/api';

const AddressSchema = z.object({
  label: z.string().trim().min(1).max(60).default('Home'),
  cityId: z.string().uuid().nullable().optional(),
  cityName: z.string().trim().min(2).max(120),
  regionName: z.string().trim().max(120).optional(),
  addressLine: z.string().trim().min(4).max(400),
  isDefault: z.boolean().optional(),
});

export async function POST(req: NextRequest) {
  const csrfErr = assertSameOrigin(req);
  if (csrfErr) return csrfErr;

  try {
    const tenant = await getRequestTenant();
    const customer = await getAuthenticatedCustomer(tenant);
    if (!customer) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const body = AddressSchema.parse(await req.json());
    const created = await withTenantDb(tenant, async (db) => {
      if (body.isDefault) {
        await db
          .update(customerAddresses)
          .set({ isDefault: false })
          .where(
            and(
              eq(customerAddresses.storeId, tenant.id),
              eq(customerAddresses.customerId, customer.id)
            )
          );
      }
      const [row] = await db
        .insert(customerAddresses)
        .values({
          storeId: tenant.id,
          customerId: customer.id,
          label: body.label,
          cityId: body.cityId || null,
          cityName: body.cityName,
          regionName: body.regionName || null,
          addressLine: body.addressLine,
          isDefault: Boolean(body.isDefault),
        })
        .returning();
      return row;
    });

    return NextResponse.json({ address: created }, { status: 201 });
  } catch (err) {
    return errorResponse(err);
  }
}

export async function DELETE(req: NextRequest) {
  const csrfErr = assertSameOrigin(req);
  if (csrfErr) return csrfErr;

  try {
    const tenant = await getRequestTenant();
    const customer = await getAuthenticatedCustomer(tenant);
    if (!customer) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const id = req.nextUrl.searchParams.get('id');
    if (!id) return NextResponse.json({ error: 'id required' }, { status: 400 });

    await withTenantDb(tenant, async (db) => {
      await db
        .delete(customerAddresses)
        .where(
          and(
            eq(customerAddresses.storeId, tenant.id),
            eq(customerAddresses.customerId, customer.id),
            eq(customerAddresses.id, id)
          )
        );
    });

    return NextResponse.json({ ok: true });
  } catch (err) {
    return errorResponse(err);
  }
}

