import { create } from 'zustand';
import { loadDensityData } from '../services/densityDataService';
import type { DownloadProgress } from '../services/cameraDataService';
import type { DensityFeatureProperties } from '../types';

export type DensityLoadPhase = 'idle' | 'fetching' | 'ready' | 'error';

let _loadPromise: Promise<void> | null = null;

interface DensityState {
  /** States lifecycle. 'ready' means the states choropleth can render; counties may still be streaming (countiesData null until committed). */
  loadPhase: DensityLoadPhase;
  dataVersion: number;
  statesData: GeoJSON.FeatureCollection | null;
  countiesData: GeoJSON.FeatureCollection | null;
  statesProgress: DownloadProgress | null;
  countiesProgress: DownloadProgress | null;
  selectedFeature: DensityFeatureProperties | null;
  hoveredFeatureId: string | null;
  error: string | null;

  // Actions
  loadAllLevels: () => Promise<void>;
  retryLoad: () => Promise<void>;
  setSelectedFeature: (feature: DensityFeatureProperties | null) => void;
  setHoveredFeatureId: (id: string | null) => void;
}

export const useDensityStore = create<DensityState>((set, get) => ({
  loadPhase: 'idle',
  dataVersion: 0,
  statesData: null,
  countiesData: null,
  statesProgress: null,
  countiesProgress: null,
  selectedFeature: null,
  hoveredFeatureId: null,
  error: null,

  loadAllLevels: async () => {
    if (_loadPromise) return _loadPromise;

    const { statesData, countiesData } = get();
    const needStates = !statesData;
    const needCounties = !countiesData;
    if (!needStates && !needCounties) return;

    _loadPromise = (async () => {
      set({ error: null, ...(needStates ? { loadPhase: 'fetching' as const } : {}) });

      // Each level commits as it lands: states (260 KB) unlock the panel and
      // the choropleth fast; counties (2.7 MB) stream in behind.
      const statesTask = needStates
        ? loadDensityData('state', (percent, loadedBytes) => {
            set({ statesProgress: { percent, loadedBytes } });
          }).then((states) => {
            set((state) => ({
              statesData: states,
              loadPhase: 'ready',
              statesProgress: null,
              dataVersion: state.dataVersion + 1,
            }));
          })
        : Promise.resolve();

      const countiesTask = needCounties
        ? loadDensityData('county', (percent, loadedBytes) => {
            set({ countiesProgress: { percent, loadedBytes } });
          }).then((counties) => {
            set((state) => ({
              countiesData: counties,
              countiesProgress: null,
              dataVersion: state.dataVersion + 1,
            }));
          })
        : Promise.resolve();

      const [statesResult, countiesResult] = await Promise.allSettled([statesTask, countiesTask]);

      const failure = [statesResult, countiesResult].find(
        (r): r is PromiseRejectedResult => r.status === 'rejected'
      );
      if (failure) {
        console.error('[DensityStore] Failed to load density data:', failure.reason);
        set((state) => ({
          error: failure.reason instanceof Error ? failure.reason.message : 'Failed to load density data',
          // Failed counties after committed states leave the states layer usable
          loadPhase: statesResult.status === 'rejected' ? 'error' : state.loadPhase,
          statesProgress: null,
          countiesProgress: null,
        }));
      }
    })();

    try {
      return await _loadPromise;
    } finally {
      _loadPromise = null;
    }
  },

  retryLoad: async () => {
    // Keep whatever committed; the service caches per level, so only the
    // missing level(s) refetch.
    set({ loadPhase: get().statesData ? 'ready' : 'idle', error: null });
    return get().loadAllLevels();
  },

  setSelectedFeature: (feature) => set({ selectedFeature: feature }),
  setHoveredFeatureId: (id) => set({ hoveredFeatureId: id }),
}));
