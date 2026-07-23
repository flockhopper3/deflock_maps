import { fetchCameras } from './cameras';
import type { Dataset, FetchOptions } from '../types';

export interface RegisteredFetcher {
  name: string;
  /** Runs one fetch pass and returns one or more per-country datasets. */
  fetch(opts?: FetchOptions): Promise<Dataset[]>;
}

const fetchers: RegisteredFetcher[] = [
  { name: 'cameras', fetch: fetchCameras },
];

/** Get all fetchers that should run for a given cron schedule (all, for now). */
export function getFetchersForSchedule(_cron: string): RegisteredFetcher[] {
  return fetchers;
}

export function getAllFetchers(): RegisteredFetcher[] {
  return fetchers;
}
