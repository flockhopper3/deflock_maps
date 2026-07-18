import type { AppMode, MapVisualizationType } from '@/store/appModeStore';
import type { CameraCountry } from '@/services/cameraDataService';
import { normalizeStateCode, stateFromSlug } from '@/services/stateFilterService';

export interface UrlViewport {
  lat: number;
  lng: number;
  zoom: number;
}

export interface AppUrlState {
  mode: AppMode;
  stateFilter: string | null;
  viewport: UrlViewport | null;
  country: CameraCountry | null;
  viz: MapVisualizationType | null;
}

/** Canonical pathname per app mode — the only URL↔mode vocabulary. */
export const MODE_PATHS: Record<AppMode, string> = {
  map: '/',
  route: '/route',
  explore: '/timeline',
  density: '/analysis',
  network: '/network',
};

// Canonical paths plus legacy aliases, accepted as input only.
const PATH_MODES: Record<string, AppMode | undefined> = {
  '/': 'map',
  '/map': 'map',
  '/route': 'route',
  '/timeline': 'explore',
  '/explore': 'explore',
  '/analysis': 'density',
  '/network': 'network',
};

const LEGACY_MODE_PARAM: Record<string, AppMode | undefined> = {
  route: 'route',
  explore: 'explore',
  density: 'density',
  network: 'network',
};

/** Minimal country check for main.tsx's pre-React seeding. */
export function parseCountryParam(search: string): CameraCountry | null {
  return new URLSearchParams(search).get('country') === 'ca' ? 'ca' : null;
}

function parseViewport(params: URLSearchParams): UrlViewport | null {
  const lat = parseFloat(params.get('lat') ?? '');
  const lng = parseFloat(params.get('lng') ?? '');
  const zoom = parseFloat(params.get('zoom') ?? '');

  if (isNaN(lat) || isNaN(lng)) return null;
  if (lat < -90 || lat > 90 || lng < -180 || lng > 180) return null;

  return { lat, lng, zoom: isNaN(zoom) ? 4 : Math.max(1, Math.min(20, zoom)) };
}

/**
 * Parse any supported URL (canonical or legacy) into app state.
 * Pure — the single entry point for URL interpretation.
 */
export function parseAppUrl(pathname: string, search: string): AppUrlState {
  const params = new URLSearchParams(search);
  const path = pathname.length > 1 && pathname.endsWith('/')
    ? pathname.slice(0, -1)
    : pathname;

  const stateMatch = path.match(/^\/state\/([^/]+)$/);
  const stateFilter =
    stateFromSlug(stateMatch?.[1]) ?? normalizeStateCode(params.get('state'));

  let mode: AppMode = stateMatch ? 'map' : PATH_MODES[path] ?? 'map';
  if (path === '/' || path === '/map') {
    // Legacy ?mode= links — honored only where no canonical path competes
    const legacy = LEGACY_MODE_PARAM[params.get('mode') ?? ''];
    if (legacy) mode = legacy;
  }

  const vizParam = params.get('viz');

  return {
    mode,
    stateFilter,
    viewport: parseViewport(params),
    country: parseCountryParam(search),
    viz: vizParam === 'heatmap' ? 'heatmap' : vizParam === 'dots' ? 'dots' : null,
  };
}
