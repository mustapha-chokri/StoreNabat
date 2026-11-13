import type { MetadataRoute } from 'next';
import { headers } from 'next/headers';

export const dynamic = 'force-dynamic';

export default async function robots(): Promise<MetadataRoute.Robots> {
  const hdrs = await headers();
  const host = hdrs.get('x-forwarded-host') || hdrs.get('host');
  const proto = hdrs.get('x-forwarded-proto') || 'https';
  const envUrl = (process.env.APP_URL || 'http://localhost:3000').replace(/\/$/, '');
  const baseUrl = host ? `${proto}://${host}` : envUrl;

  return {
    rules: [
      {
        userAgent: '*',
        allow: ['/', '/shop', '/products/', '/lp/'],
        disallow: ['/admin', '/api/', '/checkout', '/account'],
      },
    ],
    sitemap: `${baseUrl}/sitemap.xml`,
  };
}
