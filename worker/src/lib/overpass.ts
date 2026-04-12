import type { OverpassResponse } from '../types';

export const OVERPASS_ENDPOINTS = [
  'https://overpass-api.de/api/interpreter',
  'https://overpass.kumi.systems/api/interpreter',
  'https://maps.mail.ru/osm/tools/overpass/api/interpreter',
];

const TIMEOUT_MS = 300_000; // 5 minutes

export async function queryOverpass(query: string): Promise<OverpassResponse> {
  const errors: Error[] = [];

  for (const endpoint of OVERPASS_ENDPOINTS) {
    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), TIMEOUT_MS);

      const response = await fetch(endpoint, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded',
          'User-Agent': 'FlockHopper/1.0 (ALPR Camera Router)',
        },
        body: new URLSearchParams({ data: query }),
        signal: controller.signal,
      });

      clearTimeout(timeoutId);

      if (!response.ok) {
        throw new Error(`HTTP ${response.status} from ${endpoint}`);
      }

      const data: OverpassResponse = await response.json();

      if (!data.elements || data.elements.length === 0) {
        throw new Error(`Empty response from ${endpoint}`);
      }

      return data;
    } catch (error) {
      const err = error instanceof Error ? error : new Error(String(error));
      errors.push(err);
      console.error(`Overpass endpoint ${endpoint} failed:`, err.message);
    }
  }

  throw new Error(
    `All Overpass endpoints failed: ${errors.map((e) => e.message).join('; ')}`
  );
}
