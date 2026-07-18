import { useEffect } from 'react';
import { useCameraStore } from '../store/cameraStore';
import { useAppModeStore } from '../store/appModeStore';
import { useMapModeStore } from '../store/mapModeStore';
import { resolveCameraRenderMode, type CameraRenderMode } from './cameraRenderModeLogic';

export type { CameraRenderMode };

/**
 * Decides which camera rendering path is active — see
 * resolveCameraRenderMode for the decision table. This hook wires the
 * stores in and lazily hydrates whichever dataset the decision needs
 * (manifest for filter-tiles, full GeoJSON for the geojson path).
 */
export function useCameraRenderMode(): {
  renderMode: CameraRenderMode;
  needsGeojson: boolean;
} {
  const filters = useCameraStore(s => s.filters);
  const isInitialized = useCameraStore(s => s.isInitialized);
  const tilesFailed = useCameraStore(s => s.tilesFailed);
  const filterTilesFailed = useCameraStore(s => s.filterTilesFailed);
  const manifestPhase = useCameraStore(s => s.manifestPhase);
  const appMode = useAppModeStore(s => s.appMode);
  const mapModeViz = useMapModeStore(s => s.visualization);

  const { renderMode, needsGeojson, needsManifest } = resolveCameraRenderMode({
    tilesFailed,
    filterTilesFailed,
    attributeFiltersActive: !filters.showAll,
    timelineActive: !!filters.timelineDate,
    appMode,
    mapModeViz,
    manifestPhase,
    geojsonReady: isInitialized,
  });

  useEffect(() => {
    if (needsGeojson) void useCameraStore.getState().ensureCamerasLoaded();
  }, [needsGeojson]);

  useEffect(() => {
    if (needsManifest) void useCameraStore.getState().ensureManifestLoaded();
  }, [needsManifest]);

  return { renderMode, needsGeojson };
}
