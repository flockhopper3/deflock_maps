import { useMapStore } from '@/store/mapStore';
import { useAppModeStore } from '@/store/appModeStore';
import { useCameraStore } from '@/store/cameraStore';
import type { AppMode } from '@/store/appModeStore';
import type { CameraCountry } from '@/services/cameraDataService';
import { normalizeStateCode } from '@/services/stateFilterService';

interface ViewportParams {
  lat: number;
  lng: number;
  zoom: number;
}

const MODE_PATHS: Record<AppMode, string> = {
  map: '/',
  route: '/route',
  explore: '/timeline',
  density: '/analysis',
  network: '/network',
};

/**
 * Parse viewport params (lat, lng, zoom) from URL search params.
 * Returns null if lat/lng are missing or out of range.
 */
export function parseViewportFromURL(searchParams: URLSearchParams): ViewportParams | null {
  const lat = parseFloat(searchParams.get('lat') ?? '');
  const lng = parseFloat(searchParams.get('lng') ?? '');
  const zoom = parseFloat(searchParams.get('zoom') ?? '');

  if (isNaN(lat) || isNaN(lng)) return null;
  if (lat < -90 || lat > 90 || lng < -180 || lng > 180) return null;

  return {
    lat,
    lng,
    zoom: isNaN(zoom) ? 4 : Math.max(1, Math.min(20, zoom)),
  };
}

/**
 * Write viewport params (lat/lng/zoom, plus viz in explore mode) onto the given
 * URLSearchParams, mutating and returning it. Single source of truth used by
 * both the live URL sync and the Share button so their output stays identical.
 */
export function writeViewportParams(params: URLSearchParams): URLSearchParams {
  const { center, zoom } = useMapStore.getState();
  const { appMode, mapVisualization } = useAppModeStore.getState();

  params.set('lat', center[0].toFixed(4));
  params.set('lng', center[1].toFixed(4));
  params.set('zoom', zoom.toFixed(2));
  if (appMode === 'explore') {
    params.set('viz', mapVisualization);
  } else {
    params.delete('viz');
  }

  const { country, filters } = useCameraStore.getState();
  if (country !== 'us') {
    params.set('country', country);
  } else {
    params.delete('country');
  }

  // State filter (map mode) — makes filtered views shareable: ?state=TX
  if (filters.state && appMode === 'map') {
    params.set('state', filters.state);
  } else {
    params.delete('state');
  }

  return params;
}

/**
 * Parse the state filter param from URL search params. Returns the validated
 * two-letter postal code, or null when absent/unknown.
 */
export function parseStateFromURL(searchParams: URLSearchParams): string | null {
  return normalizeStateCode(searchParams.get('state'));
}

/**
 * Parse the country param from URL search params. Returns null when absent
 * or not a supported country.
 */
export function parseCountryFromURL(searchParams: URLSearchParams): CameraCountry | null {
  const country = searchParams.get('country');
  return country === 'ca' ? 'ca' : null;
}

/**
 * Build a shareable URL from current Zustand store state.
 * Reads directly from stores — no React subscription, no re-renders.
 */
export function buildShareURL(): string {
  const { appMode } = useAppModeStore.getState();
  const path = MODE_PATHS[appMode] ?? '/';
  const params = writeViewportParams(new URLSearchParams());
  return `${window.location.origin}${path}?${params.toString()}`;
}
