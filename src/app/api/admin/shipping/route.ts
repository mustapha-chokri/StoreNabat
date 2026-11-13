import { NextRequest, NextResponse } from 'next/server';
import { and, asc, eq } from 'drizzle-orm';
import {
  shippingCities,
  shippingProviders,
  shippingZones,
} from '@/db/schema/tenant';
import { getRequestTenant, withTenantDb } from '@/core/tenancy/context';
import { requireAdmin } from '@/core/auth/admin-session';
import { assertSameOrigin, errorResponse } from '@/core/http/api';
import { encryptJsonSecret } from '@/core/crypto';

export async function GET() {
  try {
    const tenant = await getRequestTenant();
    await requireAdmin(tenant, 'orders.read');

    const data = await withTenantDb(tenant, async (db) => {
      const zones = await db
        .select()
        .from(shippingZones)
        .where(eq(shippingZones.storeId, tenant.id));

      const cities = await db
        .select()
        .from(shippingCities)
        .where(eq(shippingCities.storeId, tenant.id))
        .orderBy(asc(shippingCities.sortOrder));

      const providers = await db
        .select({
          id: shippingProviders.id,
          code: shippingProviders.code,
          name: shippingProviders.name,
          isEnabled: shippingProviders.isEnabled,
          config: shippingProviders.config,
          hasCredentials: shippingProviders.encryptedCredentials,
        })
        .from(shippingProviders)
        .where(eq(shippingProviders.storeId, tenant.id));

      return {
        zones,
        cities,
        providers: providers.map((p) => ({
          ...p,
          hasCredentials: Boolean(p.hasCredentials),
        })),
      };
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
    await requireAdmin(tenant, 'shipping.write');
    const body = (await req.json()) as {
      entity: 'CITY' | 'ZONE' | 'PROVIDER';
      id?: string;
      data: Record<string, unknown>;
    };

    const res = await withTenantDb(tenant, async (db) => {
      if (body.entity === 'CITY') {
        const d = body.data;
        const payload = {
          zoneId: (d.zoneId as string) || null,
          regionCode: String(d.regionCode || 'CUSTOM'),
          regionNameI18n: (d.regionNameI18n as Record<string, string>) || { ar: '', fr: '' },
          cityNameI18n: (d.cityNameI18n as Record<string, string>) || { ar: '', fr: '' },
          deliveryFee: Number(d.deliveryFee || 0).toFixed(2),
          codFee: Number(d.codFee || 0).toFixed(2),
          codEnabled: d.codEnabled !== false,
          freeShippingMinOrder:
            d.freeShippingMinOrder !== null &&
            d.freeShippingMinOrder !== undefined &&
            d.freeShippingMinOrder !== ''
              ? Number(d.freeShippingMinOrder).toFixed(2)
              : null,
          estimatedDaysI18n: (d.estimatedDaysI18n as Record<string, string>) || {
            ar: '24 - 48 ساعة',
            fr: '24 - 48h',
          },
          isActive: d.isActive !== false,
        };

        if (body.id) {
          const [updated] = await db
            .update(shippingCities)
            .set(payload)
            .where(and(eq(shippingCities.storeId, tenant.id), eq(shippingCities.id, body.id)))
            .returning();
          return updated;
        }
        const [created] = await db
          .insert(shippingCities)
          .values({ storeId: tenant.id, ...payload })
          .returning();
        return created;
      }

      if (body.entity === 'ZONE') {
        const d = body.data;
        const payload = {
          nameI18n: (d.nameI18n as Record<string, string>) || { ar: 'منطقة جديدة' },
          defaultFee: Number(d.defaultFee || 35).toFixed(2),
          codFee: Number(d.codFee || 0).toFixed(2),
          freeShippingThreshold:
            d.freeShippingThreshold !== null &&
            d.freeShippingThreshold !== undefined &&
            d.freeShippingThreshold !== ''
              ? Number(d.freeShippingThreshold).toFixed(2)
              : null,
          codEnabled: d.codEnabled !== false,
          isActive: d.isActive !== false,
        };
        if (body.id) {
          const [updated] = await db
            .update(shippingZones)
            .set(payload)
            .where(and(eq(shippingZones.storeId, tenant.id), eq(shippingZones.id, body.id)))
            .returning();
          return updated;
        }
        const [created] = await db
          .insert(shippingZones)
          .values({ storeId: tenant.id, ...payload })
          .returning();
        return created;
      }

      if (body.entity === 'PROVIDER' && body.id) {
        const d = body.data;
        const [updated] = await db
          .update(shippingProviders)
          .set({
            isEnabled: Boolean(d.isEnabled),
            config: (d.config as Record<string, unknown>) || {},
            ...(d.credentials
              ? { encryptedCredentials: encryptJsonSecret(d.credentials) }
              : {}),
            updatedAt: new Date(),
          })
          .where(and(eq(shippingProviders.storeId, tenant.id), eq(shippingProviders.id, body.id)))
          .returning();
        return updated;
      }

      throw new Error('Invalid shipping payload');
    });

    return NextResponse.json({ item: res });
  } catch (err) {
    return errorResponse(err);
  }
}

export async function DELETE(req: NextRequest) {
  const csrfErr = assertSameOrigin(req);
  if (csrfErr) return csrfErr;

  try {
    const tenant = await getRequestTenant();
    await requireAdmin(tenant, 'shipping.write');
    const id = req.nextUrl.searchParams.get('id');
    const entity = req.nextUrl.searchParams.get('entity') || 'CITY';
    if (!id) return NextResponse.json({ error: 'id required' }, { status: 400 });

    await withTenantDb(tenant, async (db) => {
      if (entity === 'ZONE') {
        await db
          .delete(shippingZones)
          .where(and(eq(shippingZones.storeId, tenant.id), eq(shippingZones.id, id)));
      } else {
        await db
          .delete(shippingCities)
          .where(and(eq(shippingCities.storeId, tenant.id), eq(shippingCities.id, id)));
      }
    });

    return NextResponse.json({ ok: true });
  } catch (err) {
    return errorResponse(err);
  }
}

