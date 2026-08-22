/**
 * Canonical site URL, resolved once for metadata, sitemap and robots.
 * NEXT_PUBLIC_SITE_URL wins; Vercel's production URL is the deploy fallback.
 */
export const siteUrl =
  process.env.NEXT_PUBLIC_SITE_URL ??
  (process.env.VERCEL_PROJECT_PRODUCTION_URL
    ? `https://${process.env.VERCEL_PROJECT_PRODUCTION_URL}`
    : "https://cartaoideal.com");
