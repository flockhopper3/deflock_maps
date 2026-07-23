import { create } from 'zustand';

export type MapVisualization = 'auto' | 'heatmap' | 'clusters' | 'individual';
export type ActiveView = 'heatmap' | 'clusters' | 'individual';

// Zoom thresholds for auto mode
const AUTO_ZOOM_THRESHOLDS = {
  heatmapMax: 9,    // < 9 = heatmap, 9+ = individual points
} as const;

export function getActiveViewForZoom(zoom: number): ActiveView {
  if (zoom < AUTO_ZOOM_THRESHOLDS.heatmapMax) return 'heatmap';
  return 'individual';
}

interface MapModeState {
  visualization: MapVisualization;
  activeView: ActiveView;
  setVisualization: (viz: MapVisualization, currentZoom?: number) => void;
  setActiveView: (view: ActiveView) => void;
}

export const useMapModeStore = create<MapModeState>()((set) => ({
  visualization: 'auto',
  activeView: 'heatmap', // default for zoomed-out view
  setVisualization: (viz, currentZoom) =>
    set(() => {
      if (viz === 'auto') {
        const zoom = currentZoom ?? 5;
        return { visualization: viz, activeView: getActiveViewForZoom(zoom) };
      }
      return { visualization: viz, activeView: viz as ActiveView };
    }),
  setActiveView: (view) => set({ activeView: view }),
}));
