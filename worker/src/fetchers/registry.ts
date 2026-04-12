import { fetchCameras } from './cameras';
import type { GeoJSON } from '../types';

interface RegisteredFetcher {
  name: string;
  r2Key: string;
  source: string;
  fetch(): Promise<{ featureCollection: GeoJSON.FeatureCollection; featureCount: number }>;
}

const fetchers: RegisteredFetcher[] = [
  {
    name: 'cameras',
    r2Key: 'cameras.geojson.gz',
    source: 'overpass',
    fetch: fetchCameras,
  },
];

/**
 * Get all fetchers that should run for a given cron schedule.
 * For now, all fetchers run on every cron trigger (daily).
 */
export function getFetchersForSchedule(_cron: string): RegisteredFetcher[] {
  return fetchers;
}

export function getAllFetchers(): RegisteredFetcher[] {
  return fetchers;
}
