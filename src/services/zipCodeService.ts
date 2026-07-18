/**
 * Local ZIP Code Lookup Service
 * 
 * Uses bundled US ZIP code data for instant lookups without API calls.
 * Data: ~41,500 US ZIP codes (~538KB gzipped)
 */

export interface ZipCodeData {
  lat: number;
  lon: number;
  city: string;
  state: string;
}

// Cache the loaded data
let zipCodeCache: Record<string, [number, number, string, string]> | null = null;
let isLoading = false;
let loadPromise: Promise<Record<string, [number, number, string, string]>> | null = null;

/**
 * Load ZIP code data from bundled JSON file
 * Cached after first load for instant subsequent lookups
 */
async function loadZipCodes(): Promise<Record<string, [number, number, string, string]>> {
  if (zipCodeCache) {
    return zipCodeCache;
  }

  if (isLoading && loadPromise) {
    return loadPromise;
  }

  isLoading = true;

  loadPromise = (async () => {
    const startTime = performance.now();
    
    try {
      const response = await fetch('/zipcodes-us.json');
      
      if (!response.ok) {
        throw new Error(`Failed to load ZIP code data: ${response.status}`);
      }
      
      const data = await response.json();
      
      const loadTime = (performance.now() - startTime).toFixed(0);
      console.log(`Loaded ${Object.keys(data).length} ZIP codes in ${loadTime}ms`);
      
      zipCodeCache = data;
      isLoading = false;
      
      return data;
    } catch (error) {
      isLoading = false;
      loadPromise = null;
      throw error;
    }
  })();

  return loadPromise;
}

/**
 * Look up a ZIP code and get its geographic data
 * Returns null if ZIP code not found
 */
export async function lookupZipCode(zip: string): Promise<ZipCodeData | null> {
  const normalizedZip = zip.trim().replace(/\D/g, '').slice(0, 5);
  
  if (normalizedZip.length !== 5) {
    return null;
  }

  const data = await loadZipCodes();
  const entry = data[normalizedZip];
  
  if (!entry) {
    return null;
  }

  // Data format: [lat, lon, city, state]
  return {
    lat: entry[0],
    lon: entry[1],
    city: entry[2],
    state: entry[3],
  };
}

/**
 * Check if a ZIP code exists in the database
 */
export async function isValidZipCode(zip: string): Promise<boolean> {
  const result = await lookupZipCode(zip);
  return result !== null;
}

/**
 * Preload ZIP code data (call early to warm cache)
 */
export function preloadZipCodes(): void {
  loadZipCodes().catch(() => {
    // Silently fail on preload - will retry on actual use
  });
}

