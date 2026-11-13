import { NextRequest } from 'next/server';
import { getRequestTenant } from '@/core/tenancy/context';
import { requireAdmin } from '@/core/auth/admin-session';
import { subscribeTenantNotifications } from '@/core/jobs/pubsub';

export const dynamic = 'force-dynamic';

export async function GET(req: NextRequest) {
  try {
    const tenant = await getRequestTenant();
    await requireAdmin(tenant);

    const encoder = new TextEncoder();
    let unsubscribe: (() => Promise<void>) | null = null;
    let heartbeatTimer: ReturnType<typeof setInterval> | null = null;

    const stream = new ReadableStream({
      async start(controller) {
        controller.enqueue(
          encoder.encode(`event: connected\ndata: ${JSON.stringify({ storeId: tenant.id })}\n\n`)
        );

        unsubscribe = await subscribeTenantNotifications(tenant.id, (payload) => {
          try {
            controller.enqueue(
              encoder.encode(`event: notification\ndata: ${JSON.stringify(payload)}\n\n`)
            );
          } catch {
            // Stream closed
          }
        });

        heartbeatTimer = setInterval(() => {
          try {
            controller.enqueue(encoder.encode(`: ping\n\n`));
          } catch {
            // Ignore
          }
        }, 20_000);

        req.signal.addEventListener('abort', async () => {
          if (heartbeatTimer) clearInterval(heartbeatTimer);
          if (unsubscribe) await unsubscribe();
          try {
            controller.close();
          } catch {
            // Already closed
          }
        });
      },
      async cancel() {
        if (heartbeatTimer) clearInterval(heartbeatTimer);
        if (unsubscribe) await unsubscribe();
      },
    });

    return new Response(stream, {
      headers: {
        'Content-Type': 'text/event-stream',
        'Cache-Control': 'no-cache, no-transform',
        Connection: 'keep-alive',
        'X-Accel-Buffering': 'no',
      },
    });
  } catch {
    return new Response('Unauthorized', { status: 401 });
  }
}

