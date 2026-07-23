/**
 * US state geometry for the state filter. Backed by the bundled
 * /geo/states-metrics.geojson (52 pre-simplified polygons, ~4KB each — light
 * enough to evaluate as a MapLibre `within` filter expression). Loaded once,
 * cached; sync getters serve the store's synchronous filter scans and the
 * tile-filter expression builder.
 */

export interface USState {
  /** Two-letter postal code — the URL-facing id (?state=TX). */
  postal: string;
  /** Census FIPS code — matches GEOID in the boundary file. */
  fips: string;
  name: string;
}

export const US_STATES: USState[] = [
  { postal: 'AL', fips: '01', name: 'Alabama' },
  { postal: 'AK', fips: '02', name: 'Alaska' },
  { postal: 'AZ', fips: '04', name: 'Arizona' },
  { postal: 'AR', fips: '05', name: 'Arkansas' },
  { postal: 'CA', fips: '06', name: 'California' },
  { postal: 'CO', fips: '08', name: 'Colorado' },
  { postal: 'CT', fips: '09', name: 'Connecticut' },
  { postal: 'DE', fips: '10', name: 'Delaware' },
  { postal: 'DC', fips: '11', name: 'District of Columbia' },
  { postal: 'FL', fips: '12', name: 'Florida' },
  { postal: 'GA', fips: '13', name: 'Georgia' },
  { postal: 'HI', fips: '15', name: 'Hawaii' },
  { postal: 'ID', fips: '16', name: 'Idaho' },
  { postal: 'IL', fips: '17', name: 'Illinois' },
  { postal: 'IN', fips: '18', name: 'Indiana' },
  { postal: 'IA', fips: '19', name: 'Iowa' },
  { postal: 'KS', fips: '20', name: 'Kansas' },
  { postal: 'KY', fips: '21', name: 'Kentucky' },
  { postal: 'LA', fips: '22', name: 'Louisiana' },
  { postal: 'ME', fips: '23', name: 'Maine' },
  { postal: 'MD', fips: '24', name: 'Maryland' },
  { postal: 'MA', fips: '25', name: 'Massachusetts' },
  { postal: 'MI', fips: '26', name: 'Michigan' },
  { postal: 'MN', fips: '27', name: 'Minnesota' },
  { postal: 'MS', fips: '28', name: 'Mississippi' },
  { postal: 'MO', fips: '29', name: 'Missouri' },
  { postal: 'MT', fips: '30', name: 'Montana' },
  { postal: 'NE', fips: '31', name: 'Nebraska' },
  { postal: 'NV', fips: '32', name: 'Nevada' },
  { postal: 'NH', fips: '33', name: 'New Hampshire' },
  { postal: 'NJ', fips: '34', name: 'New Jersey' },
  { postal: 'NM', fips: '35', name: 'New Mexico' },
  { postal: 'NY', fips: '36', name: 'New York' },
  { postal: 'NC', fips: '37', name: 'North Carolina' },
  { postal: 'ND', fips: '38', name: 'North Dakota' },
  { postal: 'OH', fips: '39', name: 'Ohio' },
  { postal: 'OK', fips: '40', name: 'Oklahoma' },
  { postal: 'OR', fips: '41', name: 'Oregon' },
  { postal: 'PA', fips: '42', name: 'Pennsylvania' },
  { postal: 'PR', fips: '72', name: 'Puerto Rico' },
  { postal: 'RI', fips: '44', name: 'Rhode Island' },
  { postal: 'SC', fips: '45', name: 'South Carolina' },
  { postal: 'SD', fips: '46', name: 'South Dakota' },
  { postal: 'TN', fips: '47', name: 'Tennessee' },
  { postal: 'TX', fips: '48', name: 'Texas' },
  { postal: 'UT', fips: '49', name: 'Utah' },
  { postal: 'VT', fips: '50', name: 'Vermont' },
  { postal: 'VA', fips: '51', name: 'Virginia' },
  { postal: 'WA', fips: '53', name: 'Washington' },
  { postal: 'WV', fips: '54', name: 'West Virginia' },
  { postal: 'WI', fips: '55', name: 'Wisconsin' },
  { postal: 'WY', fips: '56', name: 'Wyoming' },
];

const stateByPostal = new Map(US_STATES.map((s) => [s.postal, s]));

/** Validates a candidate postal code (case-insensitive); null if unknown. */
export function normalizeStateCode(raw: string | null | undefined): string | null {
  if (!raw) return null;
  const upper = raw.toUpperCase();
  return stateByPostal.has(upper) ? upper : null;
}

export function getStateName(postal: string): string {
  return stateByPostal.get(postal)?.name ?? postal;
}

/** URL path slug for a state: kebab-case full name ("new-hampshire"). */
export function stateSlug(postal: string): string {
  return getStateName(postal).toLowerCase().replace(/\s+/g, '-');
}

/** Resolves a /state/:slug path segment — accepts the kebab-case name
 *  ("texas", "new-hampshire") or a postal code ("tx"). Null if unknown. */
export function stateFromSlug(slug: string | null | undefined): string | null {
  if (!slug) return null;
  const lower = slug.toLowerCase();
  const byPostal = normalizeStateCode(lower);
  if (byPostal) return byPostal;
  const match = US_STATES.find((s) => s.name.toLowerCase().replace(/\s+/g, '-') === lower);
  return match ? match.postal : null;
}

type StateFeature = GeoJSON.Feature<
  GeoJSON.Polygon | GeoJSON.MultiPolygon,
  { GEOID: string; name: string; cameraCount?: number }
>;

let collection: StateFeature[] | null = null;
let inFlight: Promise<StateFeature[]> | null = null;
const geometryByPostal = new Map<string, StateFeature>();

async function loadCollection(): Promise<StateFeature[]> {
  if (collection) return collection;
  if (inFlight) return inFlight;
  inFlight = (async () => {
    try {
      const res = await fetch('/geo/states-metrics.geojson');
      if (!res.ok) throw new Error(`State boundaries fetch failed: ${res.status}`);
      const gj = (await res.json()) as GeoJSON.FeatureCollection;
      collection = gj.features as StateFeature[];
      for (const s of US_STATES) {
        const f = collection.find((ft) => ft.properties.GEOID === s.fips);
        if (f) geometryByPostal.set(s.postal, f);
      }
      return collection;
    } finally {
      inFlight = null;
    }
  })();
  return inFlight;
}

/** Loads (and caches) the boundary feature for a state. */
export async function loadStateGeometry(postal: string): Promise<StateFeature | null> {
  await loadCollection();
  return geometryByPostal.get(postal) ?? null;
}

/** Sync getter — non-null only after loadStateGeometry resolved for any state. */
export function getCachedStateGeometry(postal: string): StateFeature | null {
  return geometryByPostal.get(postal) ?? null;
}

/** Per-state camera counts from the bundled metrics (for the picker UI). */
export async function loadStateCameraCounts(): Promise<Map<string, number>> {
  await loadCollection();
  const counts = new Map<string, number>();
  for (const [postal, f] of geometryByPostal) {
    if (typeof f.properties.cameraCount === 'number') counts.set(postal, f.properties.cameraCount);
  }
  return counts;
}

/** Bounding box of a state geometry as map bounds. */
export function getStateBounds(feature: StateFeature): {
  north: number; south: number; east: number; west: number;
} {
  let north = -90, south = 90, east = -180, west = 180;
  const scan = (ring: GeoJSON.Position[]) => {
    for (const [lon, lat] of ring) {
      if (lat > north) north = lat;
      if (lat < south) south = lat;
      if (lon > east) east = lon;
      if (lon < west) west = lon;
    }
  };
  if (feature.geometry.type === 'Polygon') {
    for (const ring of feature.geometry.coordinates) scan(ring);
  } else {
    for (const poly of feature.geometry.coordinates) for (const ring of poly) scan(ring);
  }
  return { north, south, east, west };
}

/** Point-in-state test for the GeoJSON filter path (ray casting). */
export function isPointInState(lon: number, lat: number, feature: StateFeature): boolean {
  const inRing = (ring: GeoJSON.Position[]): boolean => {
    let inside = false;
    for (let i = 0, j = ring.length - 1; i < ring.length; j = i++) {
      const [xi, yi] = ring[i];
      const [xj, yj] = ring[j];
      if (yi > lat !== yj > lat && lon < ((xj - xi) * (lat - yi)) / (yj - yi) + xi) {
        inside = !inside;
      }
    }
    return inside;
  };
  const inPolygon = (rings: GeoJSON.Position[][]): boolean => {
    if (rings.length === 0 || !inRing(rings[0])) return false;
    for (let i = 1; i < rings.length; i++) if (inRing(rings[i])) return false; // holes
    return true;
  };
  if (feature.geometry.type === 'Polygon') return inPolygon(feature.geometry.coordinates);
  return feature.geometry.coordinates.some(inPolygon);
}

/** Test hook — not for app code. */
export function _resetStateCacheForTests(): void {
  collection = null;
  inFlight = null;
  geometryByPostal.clear();
}
