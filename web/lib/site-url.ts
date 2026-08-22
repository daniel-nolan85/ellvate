// Single source of truth for the site's canonical URL -- used by
// metadataBase (for resolving OG image/canonical URLs), sitemap.ts, and
// robots.ts. No real domain exists yet (see conversation, 2026-08-21), so
// this falls back to the Vercel-assigned preview/production URL Vercel sets
// automatically, and only needs NEXT_PUBLIC_SITE_URL set once a real domain
// is live -- nothing else here needs to change when that happens.
export const SITE_URL = process.env.NEXT_PUBLIC_SITE_URL
  ? process.env.NEXT_PUBLIC_SITE_URL
  : process.env.VERCEL_URL
    ? `https://${process.env.VERCEL_URL}`
    : 'http://localhost:3001';
