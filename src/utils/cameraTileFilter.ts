import type { FilterSpecification } from 'maplibre-gl';
import type { CameraFilters, CameraManifest, ManifestFacetEntry } from '../types';

/** Fixed vocab → tile code tables. Must mirror the pipeline's encoder
 *  (0 = missing is implicit: match-lists never include 0). */
export const ZONE_CODES: Record<string, number> = {
  traffic: 1,
  town: 2,
  parking: 3,
  other: 4,
};

export const MOUNT_CODES: Record<string, number> = {
  pole: 1,
  wall: 2,
  street_light: 3,
  other: 4,
};

/** -1 never appears as a tile code → a [-1] match list hides everything.
 *  Used when selected labels can't be resolved (stale state vs new build):
 *  showing nothing is honest; showing everything would be wrong. */
const MATCH_NOTHING = [-1];

function facetClause(
  attr: 'b' | 'o' | 'z' | 'm',
  ids: number[]
): FilterSpecification {
  return [
    'match',
    ['get', attr],
    ids.length > 0 ? ids : MATCH_NOTHING,
    true,
    false,
  ] as FilterSpecification;
}

function resolveIds(selected: string[], entries: ManifestFacetEntry[]): number[] {
  const byLabel = new Map(entries.map((e) => [e.label, e.id]));
  return selected
    .map((label) => byLabel.get(label))
    .filter((id): id is number => id != null);
}

function resolveCodes(selected: string[], table: Record<string, number>): number[] {
  return selected
    .map((label) => table[label])
    .filter((code): code is number => code != null);
}

/**
 * Builds the MapLibre layer filter for the filter tileset from the active
 * CameraFilters. Returns undefined when no attribute filters are active
 * (layers then render unfiltered). Selected values are canonical labels;
 * ids are build-scoped and resolved here through the manifest.
 */
export function buildCameraTileFilter(
  filters: CameraFilters,
  manifest: CameraManifest
): FilterSpecification | undefined {
  if (filters.showAll) return undefined;

  const clauses: FilterSpecification[] = [];
  if (filters.brands.length > 0) {
    clauses.push(facetClause('b', resolveIds(filters.brands, manifest.brands)));
  }
  if (filters.operators.length > 0) {
    clauses.push(facetClause('o', resolveIds(filters.operators, manifest.operators)));
  }
  if (filters.surveillanceZones.length > 0) {
    clauses.push(facetClause('z', resolveCodes(filters.surveillanceZones, ZONE_CODES)));
  }
  if (filters.mountTypes.length > 0) {
    clauses.push(facetClause('m', resolveCodes(filters.mountTypes, MOUNT_CODES)));
  }

  if (clauses.length === 0) return undefined;
  if (clauses.length === 1) return clauses[0];
  return ['all', ...clauses] as unknown as FilterSpecification;
}
