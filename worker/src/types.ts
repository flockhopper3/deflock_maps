export interface Env {
  DATA_BUCKET: R2Bucket;
  ENVIRONMENT: string;
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
