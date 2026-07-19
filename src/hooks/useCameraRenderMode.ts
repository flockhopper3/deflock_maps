import { useEffect } from 'react';
import { useCameraStore } from '../store/cameraStore';
import { useAppModeStore } from '../store/appModeStore';
import { useMapModeStore } from '../store/mapModeStore';
import { resolveCameraRenderMode, isGeojsonMode, type CameraRenderMode } from './cameraRenderModeLogic';

export type { CameraRenderMode };

/**
 * Decides which camera rendering path is active — see resolveCameraRenderMode
 * for the decision table. Wires the stores in and lazily hydrates whichever
 * dataset the decision needs (manifest for filter-tiles, full GeoJSON for the
 * geojson path). GeoJSON hydration is gated on isGeojsonMode so it is
 * structurally unreachable from the plain map/route views.
 */
export function useCameraRenderMode(): {
  renderMode: CameraRenderMode;
  needsGeojson: boolean;
} {
  const filters = useCameraStore(s => s.filters);
  const isInitialized = useCameraStore(s => s.isInitialized);
  const filterTilesFailed = useCameraStore(s => s.filterTilesFailed);
  const manifestPhase = useCameraStore(s => s.manifestPhase);
  const appMode = useAppModeStore(s => s.appMode);
  const mapModeViz = useMapModeStore(s => s.visualization);

  const timelineActive = !!filters.timelineDate;

  const { renderMode, needsGeojson, needsManifest } = resolveCameraRenderMode({
    filterTilesFailed,
    attributeFiltersActive: !filters.showAll,
    timelineActive,
    appMode,
    mapModeViz,
    manifestPhase,
    geojsonReady: isInitialized,
  });

  // Guard: the full dataset is only ever hydrated from a genuine geojson mode.
  // Gating on isGeojsonMode (not merely needsGeojson) keeps GeoJSON
  // structurally unreachable from the plain map/route views even if a future
  // edit re-routes a failure into needsGeojson.
  useEffect(() => {
    if (needsGeojson && isGeojsonMode({ appMode, mapModeViz, timelineActive })) {
      void useCameraStore.getState().ensureCamerasLoaded();
    }
  }, [needsGeojson, appMode, mapModeViz, timelineActive]);

  useEffect(() => {
    if (needsManifest) void useCameraStore.getState().ensureManifestLoaded();
  }, [needsManifest]);

  return { renderMode, needsGeojson };
}
