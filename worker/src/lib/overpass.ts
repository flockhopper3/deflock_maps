import type { OverpassResponse } from '../types';

export const OVERPASS_ENDPOINTS = [
  'https://overpass.deflock.org/api/interpreter',
  'https://overpass-api.de/api/interpreter',
  'https://overpass.kumi.systems/api/interpreter',
];

// DeFlock's Overpass sits behind a reverse proxy that returns 504 at ~60s of
// wall-clock, regardless of the [timeout:N] in the query. Abort below that so a
// stuck request fails fast to the next endpoint instead of hanging the pipeline.
const TIMEOUT_MS = 55_000;

// Overpass mirrors (especially deflock.org) reject or rate-limit requests without
// a User-Agent that identifies the app and provides a contact channel.
export const OVERPASS_USER_AGENT =
  'FlockHopper-Data/1.0 (+https://dontgetflocked.com; alerts@dontgetflocked.com)';

export interface OverpassQueryResult {
  data: OverpassResponse;
  endpoint: string;
}

interface RunOptions {
  /** Treat an empty `elements` array as a valid result instead of a failure. */
  allowEmpty?: boolean;
}

async function runOverpass(query: string, opts: RunOptions = {}): Promise<OverpassQueryResult> {
  const errors: Error[] = [];

  for (const endpoint of OVERPASS_ENDPOINTS) {
    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), TIMEOUT_MS);

      const response = await fetch(endpoint, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded',
          'User-Agent': OVERPASS_USER_AGENT,
          Accept: 'application/json',
        },
        body: new URLSearchParams({ data: query }),
        signal: controller.signal,
      });

      clearTimeout(timeoutId);

      if (!response.ok) {
        throw new Error(`HTTP ${response.status} from ${endpoint}`);
      }

      const data: OverpassResponse = await response.json();

      if (!opts.allowEmpty && (!data.elements || data.elements.length === 0)) {
        throw new Error(`Empty response from ${endpoint}`);
      }

      return { data, endpoint };
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

/**
 * Run an Overpass query, falling back across endpoints. Rejects on an empty
 * result — use for queries that must return data (a national fetch, a known
 * non-empty region).
 */
export function queryOverpass(query: string): Promise<OverpassQueryResult> {
  return runOverpass(query);
}

/**
 * Run an Overpass query for a single map tile. An empty result is valid here
 * (ocean / unpopulated tiles legitimately have zero cameras), so it is not
 * treated as a failure.
 */
export function queryOverpassTile(query: string): Promise<OverpassQueryResult> {
  return runOverpass(query, { allowEmpty: true });
}
