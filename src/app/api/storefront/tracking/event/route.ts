import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { getRequestTenant } from '@/core/tenancy/context';
import { enqueueJob } from '@/core/jobs/queue';
import { getClientIp } from '@/core/security/csrf';

const TrackingEventSchema = z.object({
  eventName: z.enum(['ViewContent', 'AddToCart', 'InitiateCheckout', 'Lead']),
  eventId: z.string().min(8).max(120),
  eventSourceUrl: z.string().url().optional(),
  value: z.number().optional(),
  currency: z.string().max(10).optional(),
  contentIds: z.array(z.string()).optional(),
});

export async function POST(req: NextRequest) {
  try {
    const body = TrackingEventSchema.parse(await req.json());
    const tenant = await getRequestTenant();

    await enqueueJob({
      name: 'send-meta-capi',
      tenantId: tenant.id,
      eventName: body.eventName,
      eventId: body.eventId,
      eventSourceUrl: body.eventSourceUrl,
      clientIp: getClientIp(req),
      userAgent: req.headers.get('user-agent') || undefined,
      value: body.value,
      currency: body.currency || 'MAD',
      contentIds: body.contentIds,
    });

    return NextResponse.json({ accepted: true });
  } catch {
    return NextResponse.json({ accepted: false }, { status: 400 });
  }
}

