export type CameraRenderMode = 'tiles' | 'filter-tiles' | 'geojson';

export interface RenderModeInputs {
  filterTilesFailed: boolean;
  /** Any brand/operator/zone/mount filter applied (filters.showAll === false). */
  attributeFiltersActive: boolean;
  /** Timeline date cutoff set — needs per-camera timestamps (GeoJSON only). */
  timelineActive: boolean;
  appMode: string;
  mapModeViz: string;
  manifestPhase: 'idle' | 'loading' | 'ready' | 'error';
  /** Full GeoJSON dataset hydrated (cameraStore.isInitialized). */
  geojsonReady: boolean;
}

export interface RenderModeResult {
  renderMode: CameraRenderMode;
  needsGeojson: boolean;
  needsManifest: boolean;
}

/**
 * The only modes that legitimately need per-camera attributes at all zooms,
 * which tiles cannot provide: Timeline/Explore (per-camera timestamps) and the
 * heatmap visualization. This is the SOLE gate for loading the full GeoJSON.
 * Tile and filter failures deliberately do NOT appear here — the plain map and
 * route views never load GeoJSON; a failure surfaces a retry pill instead.
 */
export function isGeojsonMode(
  i: Pick<RenderModeInputs, 'appMode' | 'mapModeViz' | 'timelineActive'>
): boolean {
  return (
    i.timelineActive ||
    i.appMode === 'explore' ||
    (i.appMode === 'map' && i.mapModeViz === 'heatmap')
  );
}

/**
 * Decides the camera rendering path. Precedence:
 * 1. GeoJSON-only modes (Explore, heatmap, timeline) → geojson.
 * 2. Attribute filters → filter-tiles when manifest + filter tileset are
 *    healthy; degrade to plain unfiltered tiles when either failed (never
 *    geojson); hold plain tiles while the manifest is still loading.
 * 3. Otherwise plain tiles.
 * A geojson decision renders as 'tiles' until hydration completes so the swap
 * never blanks the map. Tile/filter failures no longer route to geojson: they
 * are surfaced as a retry pill by the UI (see CameraTileStatusPill).
 */
export function resolveCameraRenderMode(i: RenderModeInputs): RenderModeResult {
  if (isGeojsonMode(i)) {
    return {
      renderMode: i.geojsonReady ? 'geojson' : 'tiles',
      needsGeojson: true,
      needsManifest: false,
    };
  }

  if (i.attributeFiltersActive) {
    // Filter tileset or manifest broken → show all cameras unfiltered; the UI
    // shows a "filters unavailable" pill. GeoJSON is never used here.
    if (i.manifestPhase === 'error' || i.filterTilesFailed) {
      return { renderMode: 'tiles', needsGeojson: false, needsManifest: false };
    }
    if (i.manifestPhase === 'ready') {
      return { renderMode: 'filter-tiles', needsGeojson: false, needsManifest: true };
    }
    // idle/loading: stay unfiltered briefly; effect below kicks off the load
    return { renderMode: 'tiles', needsGeojson: false, needsManifest: true };
  }

  return { renderMode: 'tiles', needsGeojson: false, needsManifest: false };
}
