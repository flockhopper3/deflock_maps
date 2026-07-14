import { useEffect } from 'react';
import { useCameraStore } from '../store/cameraStore';
import { useAppModeStore } from '../store/appModeStore';
import { useMapModeStore } from '../store/mapModeStore';

export type CameraRenderMode = 'tiles' | 'geojson';

/**
 * Decides which camera rendering path is active.
 *
 * geojson is needed when a feature depends on per-camera attributes at all
 * zooms (tiles only carry attributes at z11+):
 * - brand/operator/zone/mount filters active
 * - Explore mode (timeline playback / heatmap / dots)
 * - map-mode heatmap visualization
 * - Canada (not in the tileset yet)
 * - tile source failed (resilience fallback)
 *
 * renderMode stays 'tiles' until the JSON dataset is hydrated so the swap
 * never blanks the map mid-download.
 */
export function useCameraRenderMode(): {
  renderMode: CameraRenderMode;
  needsGeojson: boolean;
} {
  const country = useCameraStore(s => s.country);
  const filters = useCameraStore(s => s.filters);
  const isInitialized = useCameraStore(s => s.isInitialized);
  const tilesFailed = useCameraStore(s => s.tilesFailed);
  const appMode = useAppModeStore(s => s.appMode);
  const mapModeViz = useMapModeStore(s => s.visualization);

  const filtersActive = !filters.showAll || !!filters.timelineDate;
  const needsGeojson =
    tilesFailed ||
    country === 'ca' ||
    filtersActive ||
    appMode === 'explore' ||
    (appMode === 'map' && mapModeViz === 'heatmap');

  // Lazily hydrate the JSON dataset the moment anything needs it
  useEffect(() => {
    if (needsGeojson) {
      void useCameraStore.getState().ensureCamerasLoaded();
    }
  }, [needsGeojson]);

  return {
    renderMode: needsGeojson && isInitialized ? 'geojson' : 'tiles',
    needsGeojson,
  };
}
