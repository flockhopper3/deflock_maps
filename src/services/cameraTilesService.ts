import maplibregl from 'maplibre-gl';
import { Protocol } from 'pmtiles';

/**
 * Camera vector tiles served as a raw PMTiles archive from the
 * flockhopper-tiles worker (R2-backed, Range requests).
 *
 * Archive facts (from its TileJSON):
 * - source-layer: 'cameras', zooms 0-14
 * - z0-10 tiles are geometry-only (built with --exclude-all)
 * - z11+ tiles carry full attributes for popups/cones
 */
export const CAMERA_TILES_HOST = 'https://tiles.dontgetflocked.com';
export const CAMERA_TILES_ARCHIVE = `${CAMERA_TILES_HOST}/cameras.pmtiles`;
export const CAMERA_TILES_URL = `pmtiles://${CAMERA_TILES_ARCHIVE}`;
/**
 * Filter-enabled companion archive: same points, but with integer filter
 * codes (b/o/z/m) at ALL zooms — z11+ additionally carries the full
 * attributes, mirroring the main archive. Only attached to the map once a
 * filter activates; idle users never fetch it.
 */
export const CAMERA_FILTER_TILES_ARCHIVE = `${CAMERA_TILES_HOST}/cameras-filter.pmtiles`;
export const CAMERA_FILTER_TILES_URL = `pmtiles://${CAMERA_FILTER_TILES_ARCHIVE}`;
export const CAMERA_TILES_SOURCE_LAYER = 'cameras';
export const CAMERA_TILES_MAXZOOM = 14;
/** Below this zoom, tile features have no attributes (no osmId, no direction). */
export const CAMERA_METADATA_MINZOOM = 11;
/**
 * Zoom at which the full camera points layer takes over from the density dots.
 * The dots layer runs to maxzoom 12, so the two overlap on [11, 12).
 *
 * Shared so the viewport count can query whichever single layer covers the
 * current zoom: queryRenderedFeatures ignores paint opacity, so querying both
 * across the overlap returns every camera twice (measured +102.8% at z11).
 * Keep this equal to the points layer's minzoom in CameraTileLayers.
 */
export const CAMERA_POINTS_MINZOOM = 11;

let _protocol: Protocol | null = null;

/** Register the shared pmtiles protocol exactly once (basemap + camera tiles). */
export function ensurePMTilesProtocol(): Protocol {
  if (!_protocol) {
    _protocol = new Protocol();
    maplibregl.addProtocol('pmtiles', _protocol.tile.bind(_protocol));
  }
  return _protocol;
}
