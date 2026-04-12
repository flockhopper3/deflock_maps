/**
 * Density GeoJSON data loader — singleton pattern matching cameraDataService.ts
 *
 * Loads states-metrics.geojson and counties-metrics.geojson from /geo/.
 * Deduplicates concurrent requests and retries with exponential backoff.
 */

const MAX_ATTEMPTS = 3;
const RETRY_DELAY_MS = 1000;

// Module-scope caches (one per level)
let statesData: GeoJSON.FeatureCollection | null = null;
let countiesData: GeoJSON.FeatureCollection | null = null;
let statesPromise: Promise<GeoJSON.FeatureCollection> | null = null;
let countiesPromise: Promise<GeoJSON.FeatureCollection> | null = null;

const FILE_MAP: Record<string, string> = {
  state: '/geo/states-metrics.geojson',
  county: '/geo/counties-metrics.geojson',
};

function getCache(level: string) {
  return level === 'state'
    ? { data: statesData, promise: statesPromise }
    : { data: countiesData, promise: countiesPromise };
}

function setCache(level: string, data: GeoJSON.FeatureCollection | null, promise: Promise<GeoJSON.FeatureCollection> | null) {
  if (level === 'state') {
    statesData = data;
    statesPromise = promise;
  } else {
    countiesData = data;
    countiesPromise = promise;
  }
}

export async function loadDensityData(level: 'state' | 'county'): Promise<GeoJSON.FeatureCollection> {
  const cache = getCache(level);

  // Return cached data
  if (cache.data) return cache.data;

  // Deduplicate in-flight requests
  if (cache.promise) return cache.promise;

  const url = FILE_MAP[level];

  const promise = (async () => {
    let lastError: Error | null = null;

    for (let attempt = 1; attempt <= MAX_ATTEMPTS; attempt++) {
      try {
        const response = await fetch(url, { cache: 'default' });
        if (!response.ok) throw new Error(`Failed to load ${url}: ${response.status}`);

        const data = await response.json() as GeoJSON.FeatureCollection;

        // Validate
        if (data.type !== 'FeatureCollection' || !Array.isArray(data.features) || data.features.length === 0) {
          throw new Error(`Invalid GeoJSON from ${url}`);
        }
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        if (!(data.features[0] as any).properties?.GEOID) {
          throw new Error(`Missing GEOID property in ${url}`);
        }

        // Filter out counties with population < 1000 as outliers
        if (level === 'county') {
          const before = data.features.length;
          data.features = data.features.filter(
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            (f) => (f.properties as any)?.population >= 1000
          );
          if (import.meta.env.DEV) {
            console.log(`[DensityService] Filtered counties: ${before} → ${data.features.length} (removed ${before - data.features.length} with pop < 1000)`);
          }
        }

        if (import.meta.env.DEV) {
          console.log(`[DensityService] Loaded ${level}: ${data.features.length} features`);
        }

        setCache(level, data, null);
        return data;
      } catch (error) {
        lastError = error instanceof Error ? error : new Error(String(error));
        if (import.meta.env.DEV) {
          console.warn(`[DensityService] ${level} attempt ${attempt}/${MAX_ATTEMPTS} failed:`, lastError.message);
        }
        if (attempt < MAX_ATTEMPTS) {
          await new Promise(resolve => setTimeout(resolve, RETRY_DELAY_MS * attempt));
        }
      }
    }

    // All attempts failed — clear promise so retry can work
    setCache(level, null, null);
    throw lastError || new Error(`Failed to load ${level} density data`);
  })();

  setCache(level, null, promise);
  return promise;
}

/** Clear cached data (for testing) */
export function clearDensityCache(): void {
  statesData = null;
  countiesData = null;
  statesPromise = null;
  countiesPromise = null;
}
