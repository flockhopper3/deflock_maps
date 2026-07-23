export interface Env {
  DATA_BUCKET: R2Bucket;
  EMAIL: SendEmail;
  TRIGGER_SECRET: string;
  ENVIRONMENT: string;
  /** Optional override (fraction, e.g. "0.05") for the cross-run delta guard. */
  MAX_DELTA_PCT?: string;
}

/** ISO 3166-1 alpha-2 codes for the countries we publish datasets for. */
export type CountryCode = 'US' | 'CA';

/** One published dataset (one country's cameras) plus everything the pipeline needs to write it. */
export interface Dataset {
  country: CountryCode;
  r2Key: string;
  source: string;
  featureCollection: GeoJSON.FeatureCollection;
  featureCount: number;
  endpoint: string;
  /** Per-country minimum acceptable count. A run below this is blocked (unless forced). */
  minCount: number;
}

/** Optional overrides for a fetch run. `bboxOverride` restricts US tiling to a single box (dev only). */
export interface FetchOptions {
  bboxOverride?: [number, number, number, number]; // [s, w, n, e]
}

export interface Fetcher {
  name: string;
  r2Key: string;
  schedule: string;
  fetch(): Promise<GeoJSON.FeatureCollection>;
}

export interface DatasetMetadata {
  lastUpdated: string;
  featureCount: number;
  source: string;
}

// GeoJSON types (minimal, no external dependency needed)
export namespace GeoJSON {
  export interface FeatureCollection {
    type: 'FeatureCollection';
    features: Feature[];
  }

  export interface Feature {
    type: 'Feature';
    geometry: Point;
    properties: Record<string, unknown>;
  }

  export interface Point {
    type: 'Point';
    coordinates: [number, number]; // [lon, lat]
  }
}

// Overpass API response types
export interface OverpassResponse {
  version: number;
  generator: string;
  elements: OverpassElement[];
}

export interface OverpassElement {
  type: 'node' | 'way';
  id: number;
  lat?: number;
  lon?: number;
  timestamp?: string;
  version?: number;
  nodes?: number[];
  tags?: Record<string, string>;
}
