import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { withTenantDb, getRequestTenant } from '@/core/tenancy/context';
import {
  CART_TOKEN_COOKIE,
  getAuthenticatedCustomer,
} from '@/core/auth/customer-session';
import { assertSameOrigin, errorResponse } from '@/core/http/api';
import { checkRateLimit } from '@/core/security/rate-limit';
import { getClientIp } from '@/core/security/csrf';
import { createTenantOrder } from '@/services/orders';
import { cookies } from 'next/headers';

const CheckoutSchema = z.object({
  checkoutType: z.enum(['QUICK_ORDER', 'CART', 'LANDING_PAGE']),
  landingPageId: z.string().uuid().nullable().optional(),
  locale: z.string().min(2).max(10).default('ar'),
  customerName: z.string().trim().min(2).max(160),
  customerEmail: z.string().trim().email().nullable().optional().or(z.literal('')),
  phone: z.string().trim().min(8).max(40),
  whatsappNumber: z.string().trim().max(40).nullable().optional(),
  cityId: z.string().uuid().nullable().optional(),
  cityName: z.string().trim().max(120).optional(),
  shippingAddress: z.string().trim().min(2).max(500),
  customerNotes: z.string().trim().max(1000).nullable().optional(),
  customFields: z.record(z.unknown()).optional(),
  couponCode: z.string().trim().max(60).nullable().optional(),
  paymentMethod: z.enum(['COD', 'STRIPE', 'PAYPAL', 'CMI']).default('COD'),
  trackingEventId: z.string().max(120).optional(),
  items: z
    .array(
      z.object({
        productId: z.string().uuid(),
        variantId: z.string().uuid().nullable().optional(),
        quantity: z.number().int().min(1).max(200),
      })
    )
    .min(1),
});

export async function POST(req: NextRequest) {
  const csrfErr = assertSameOrigin(req);
  if (csrfErr) return csrfErr;

  let locale = 'ar';
  try {
    const ip = getClientIp(req);
    const rl = await checkRateLimit({ key: `checkout:${ip}`, limit: 20, windowSeconds: 600 });
    if (!rl.allowed) {
      return NextResponse.json(
        { error: 'تم إرسال عدة طلبات بسرعة. يرجى الانتظار قليلاً.' },
        { status: 429 }
      );
    }

    const body = CheckoutSchema.parse(await req.json());
    locale = body.locale;

    const tenant = await getRequestTenant();
    const customer = await getAuthenticatedCustomer(tenant);
    const cookieStore = await cookies();
    const cartToken = cookieStore.get(CART_TOKEN_COOKIE)?.value || null;

    const proto = req.headers.get('x-forwarded-proto') || 'http';
    const host = req.headers.get('x-forwarded-host') || req.headers.get('host');
    const baseUrl = host ? `${proto}://${host}` : undefined;

    const result = await withTenantDb(tenant, async (db) =>
      createTenantOrder(db, {
        storeId: tenant.id,
        checkoutType: body.checkoutType,
        landingPageId: body.landingPageId || null,
        cartToken,
        authenticatedCustomerId: customer?.id || null,
        locale: body.locale,
        customerName: body.customerName,
        customerEmail: body.customerEmail || null,
        phone: body.phone,
        whatsappNumber: body.whatsappNumber || null,
        cityId: body.cityId || null,
        cityName: body.cityName,
        shippingAddress: body.shippingAddress,
        customerNotes: body.customerNotes || null,
        customFields: body.customFields,
        couponCode: body.couponCode || null,
        paymentMethod: body.paymentMethod,
        items: body.items,
        ipAddress: ip,
        userAgent: req.headers.get('user-agent') || undefined,
        baseUrl,
        trackingEventId: body.trackingEventId,
      })
    );

    return NextResponse.json(result, { status: 201 });
  } catch (err) {
    return errorResponse(err, locale);
  }
}

