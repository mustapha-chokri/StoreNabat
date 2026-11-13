import { NextRequest } from 'next/server';

/**
 * Verifies Origin / Referer against the request Host header to guard against
 * cross-site request forgery (CSRF) on state-changing routes.
 */
export function verifySameOrigin(req: NextRequest): boolean {
  const method = req.method.toUpperCase();
  if (method === 'GET' || method === 'HEAD' || method === 'OPTIONS') {
    return true;
  }

  const host = (req.headers.get('x-forwarded-host') || req.headers.get('host') || '')
    .split(':')[0]
    .toLowerCase();
  const origin = req.headers.get('origin');
  const referer = req.headers.get('referer');

  if (origin) {
    try {
      const originHost = new URL(origin).hostname.toLowerCase();
      return originHost === host;
    } catch {
      return false;
    }
  }

  if (referer) {
    try {
      const refHost = new URL(referer).hostname.toLowerCase();
      return refHost === host;
    } catch {
      return false;
    }
  }

  // Non-browser API calls (e.g. curl/webhooks) without Origin/Referer are checked via auth/signature
  return true;
}

export function getClientIp(req: NextRequest): string {
  const fwd = req.headers.get('x-forwarded-for');
  if (fwd) return fwd.split(',')[0].trim();
  return req.headers.get('x-real-ip') || '127.0.0.1';
}

