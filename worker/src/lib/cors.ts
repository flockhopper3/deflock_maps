const ALLOWED_ORIGINS = [
  'https://dontgetflocked.com',
  'https://www.dontgetflocked.com',
  'https://maps.deflock.org',
  'http://localhost:3000',
];

const ALLOWED_ORIGIN_PATTERNS = [
  /^https:\/\/[a-z0-9-]+-deflock-maps\.deflock\.workers\.dev$/,
  /^https:\/\/[a-z0-9-]+\.flockhopper\.workers\.dev$/,
];

export function getAllowedOrigin(
  origin: string | null,
  _environment: string
): string | null {
  if (!origin) return null;
  if (ALLOWED_ORIGINS.includes(origin)) return origin;
  if (ALLOWED_ORIGIN_PATTERNS.some((pattern) => pattern.test(origin))) return origin;
  return null;
}

export function corsHeaders(
  origin: string | null,
  environment: string
): Record<string, string> {
  const allowed = getAllowedOrigin(origin, environment);
  if (!allowed) return {};

  return {
    'Access-Control-Allow-Origin': allowed,
    'Access-Control-Allow-Methods': 'GET, OPTIONS',
    'Access-Control-Max-Age': '86400',
  };
}
