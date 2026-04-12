import { create } from 'zustand';
import { loadBoundaryData, type BoundaryLevel } from '../services/boundaryDataService';

export type MapVisualization = 'auto' | 'heatmap' | 'clusters' | 'individual';
export type ActiveView = 'heatmap' | 'clusters' | 'individual';

export interface OverlayState {
  stateBoundaries: boolean;
  countyBoundaries: boolean;
  municipalBoundaries: boolean;
}

export type BoundaryLoadStatus = 'idle' | 'loading' | 'loaded' | 'error';

export interface BoundaryLoadingState {
  state: BoundaryLoadStatus;
  county: BoundaryLoadStatus;
  municipal: BoundaryLoadStatus;
}

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
  overlays: OverlayState;
  setVisualization: (viz: MapVisualization, currentZoom?: number) => void;
  setActiveView: (view: ActiveView) => void;
  toggleOverlay: (key: keyof OverlayState) => void;
  boundaryLoading: BoundaryLoadingState;
  boundaryData: Record<BoundaryLevel, GeoJSON.FeatureCollection | null>;
  fetchBoundary: (level: BoundaryLevel) => Promise<void>;
}

export const useMapModeStore = create<MapModeState>()((set, get) => ({
  visualization: 'auto',
  activeView: 'heatmap', // default for zoomed-out view
  overlays: {
    stateBoundaries: false,
    countyBoundaries: false,
    municipalBoundaries: false,
  },
  boundaryLoading: {
    state: 'idle',
    county: 'idle',
    municipal: 'idle',
  },
  boundaryData: {
    state: null,
    county: null,
    municipal: null,
  },
  setVisualization: (viz, currentZoom) =>
    set(() => {
      if (viz === 'auto') {
        const zoom = currentZoom ?? 5;
        return { visualization: viz, activeView: getActiveViewForZoom(zoom) };
      }
      return { visualization: viz, activeView: viz as ActiveView };
    }),
  setActiveView: (view) => set({ activeView: view }),
  toggleOverlay: (key) =>
    set((state) => ({
      overlays: { ...state.overlays, [key]: !state.overlays[key] },
    })),
  fetchBoundary: async (level) => {
    const current = get().boundaryLoading[level];
    if (current === 'loading' || current === 'loaded') return;

    set((s) => ({
      boundaryLoading: { ...s.boundaryLoading, [level]: 'loading' },
    }));

    try {
      const data = await loadBoundaryData(level);
      set((s) => ({
        boundaryLoading: { ...s.boundaryLoading, [level]: 'loaded' },
        boundaryData: { ...s.boundaryData, [level]: data },
      }));
    } catch (error) {
      if (import.meta.env.DEV) {
        console.error(`[MapModeStore] Failed to fetch ${level} boundaries:`, error);
      }
      set((s) => ({
        boundaryLoading: { ...s.boundaryLoading, [level]: 'error' },
      }));
    }
  },
}));
