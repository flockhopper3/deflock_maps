const ALLOWED_ORIGINS = [
  'https://dontgetflocked.com',
  'https://www.dontgetflocked.com',
  'https://deflock-maps.flockhopper.workers.dev',
  'http://localhost:3000',
];

export function getAllowedOrigin(
  origin: string | null,
  _environment: string
): string | null {
  if (!origin) return null;
  if (ALLOWED_ORIGINS.includes(origin)) return origin;
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
