/**
 * Boundary GeoJSON loader — fetches from R2 storage with caching and retry.
 * Follows the same singleton/deduplication pattern as densityDataService.ts.
 */

export type BoundaryLevel = 'state' | 'county' | 'municipal';

const BASE_URL = 'https://data.dontgetflocked.com/boundaries';

const BOUNDARY_URLS: Record<BoundaryLevel, string> = {
  state: `${BASE_URL}/states.geojson`,
  county: `${BASE_URL}/counties.geojson`,
  municipal: `${BASE_URL}/places.geojson`,
};

const MAX_ATTEMPTS = 3;
const RETRY_DELAY_MS = 1000;

// Module-scope caches
const dataCache: Record<BoundaryLevel, GeoJSON.FeatureCollection | null> = {
  state: null,
  county: null,
  municipal: null,
};

const promiseCache: Record<BoundaryLevel, Promise<GeoJSON.FeatureCollection> | null> = {
  state: null,
  county: null,
  municipal: null,
};

export async function loadBoundaryData(level: BoundaryLevel): Promise<GeoJSON.FeatureCollection> {
  if (dataCache[level]) return dataCache[level];
  if (promiseCache[level]) return promiseCache[level];

  const url = BOUNDARY_URLS[level];

  const promise = (async () => {
    let lastError: Error | null = null;

    for (let attempt = 1; attempt <= MAX_ATTEMPTS; attempt++) {
      try {
        const response = await fetch(url, { cache: 'default' });
        if (!response.ok) throw new Error(`Failed to load ${url}: ${response.status}`);

        const data = (await response.json()) as GeoJSON.FeatureCollection;

        if (data.type !== 'FeatureCollection' || !Array.isArray(data.features) || data.features.length === 0) {
          throw new Error(`Invalid GeoJSON from ${url}`);
        }

        if (import.meta.env.DEV) {
          console.log(`[BoundaryService] Loaded ${level}: ${data.features.length} features`);
        }

        dataCache[level] = data;
        promiseCache[level] = null;
        return data;
      } catch (error) {
        lastError = error instanceof Error ? error : new Error(String(error));
        if (import.meta.env.DEV) {
          console.warn(`[BoundaryService] ${level} attempt ${attempt}/${MAX_ATTEMPTS} failed:`, lastError.message);
        }
        if (attempt < MAX_ATTEMPTS) {
          await new Promise((resolve) => setTimeout(resolve, RETRY_DELAY_MS * attempt));
        }
      }
    }

    promiseCache[level] = null;
    throw lastError || new Error(`Failed to load ${level} boundary data`);
  })();

  promiseCache[level] = promise;
  return promise;
}

export function clearBoundaryCache(): void {
  for (const level of Object.keys(dataCache) as BoundaryLevel[]) {
    dataCache[level] = null;
    promiseCache[level] = null;
  }
}
