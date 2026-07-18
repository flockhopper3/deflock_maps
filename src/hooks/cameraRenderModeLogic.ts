export type CameraRenderMode = 'tiles' | 'filter-tiles' | 'geojson';

export interface RenderModeInputs {
  tilesFailed: boolean;
  filterTilesFailed: boolean;
  country: string;
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
 * Decides the camera rendering path. Precedence:
 * 1. Anything needing per-camera data at all zooms that tiles can't provide
 *    (Explore, heatmap, timeline, Canada, main-tiles failure) → geojson.
 * 2. Attribute filters → filter-tiles when manifest + filter tileset are
 *    healthy; degrade to geojson when either failed; hold plain tiles while
 *    the manifest is still loading.
 * 3. Otherwise plain tiles.
 * A geojson decision renders as 'tiles' until hydration completes so the
 * swap never blanks the map (existing discipline).
 */
export function resolveCameraRenderMode(i: RenderModeInputs): RenderModeResult {
  const needsGeojsonBase =
    i.tilesFailed ||
    i.country === 'ca' ||
    i.timelineActive ||
    i.appMode === 'explore' ||
    (i.appMode === 'map' && i.mapModeViz === 'heatmap');

  if (needsGeojsonBase) {
    return {
      renderMode: i.geojsonReady ? 'geojson' : 'tiles',
      needsGeojson: true,
      needsManifest: false,
    };
  }

  if (i.attributeFiltersActive) {
    if (i.manifestPhase === 'error' || i.filterTilesFailed) {
      return {
        renderMode: i.geojsonReady ? 'geojson' : 'tiles',
        needsGeojson: true,
        needsManifest: false,
      };
    }
    if (i.manifestPhase === 'ready') {
      return { renderMode: 'filter-tiles', needsGeojson: false, needsManifest: true };
    }
    // idle/loading: stay unfiltered briefly; effect below kicks off the load
    return { renderMode: 'tiles', needsGeojson: false, needsManifest: true };
  }

  return { renderMode: 'tiles', needsGeojson: false, needsManifest: false };
}
