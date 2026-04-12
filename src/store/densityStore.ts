import { create } from 'zustand';
import { loadDensityData } from '../services/densityDataService';
import type { DensityFeatureProperties } from '../types';

export type DensityLoadPhase = 'idle' | 'fetching' | 'ready' | 'error';

interface DensityState {
  loadPhase: DensityLoadPhase;
  dataVersion: number;
  statesData: GeoJSON.FeatureCollection | null;
  countiesData: GeoJSON.FeatureCollection | null;
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
  selectedFeature: null,
  hoveredFeatureId: null,
  error: null,

  loadAllLevels: async () => {
    const { loadPhase, statesData, countiesData } = get();

    // Already loaded or loading
    if (loadPhase === 'fetching') return;
    if (statesData && countiesData) return;

    set({ loadPhase: 'fetching', error: null });

    try {
      const [states, counties] = await Promise.all([
        loadDensityData('state'),
        loadDensityData('county'),
      ]);

      set((state) => ({
        statesData: states,
        countiesData: counties,
        loadPhase: 'ready',
        dataVersion: state.dataVersion + 1,
      }));
    } catch (error) {
      console.error('[DensityStore] Failed to load density data:', error);
      set({
        error: error instanceof Error ? error.message : 'Failed to load density data',
        loadPhase: 'error',
      });
    }
  },

  retryLoad: async () => {
    set({ loadPhase: 'idle', error: null, statesData: null, countiesData: null });
    return get().loadAllLevels();
  },

  setSelectedFeature: (feature) => set({ selectedFeature: feature }),
  setHoveredFeatureId: (id) => set({ hoveredFeatureId: id }),
}));
