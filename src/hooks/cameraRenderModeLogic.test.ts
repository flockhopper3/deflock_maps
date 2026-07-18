import { describe, it, expect } from 'vitest';
import { resolveCameraRenderMode, type RenderModeInputs } from './cameraRenderModeLogic';

const base: RenderModeInputs = {
  tilesFailed: false,
  filterTilesFailed: false,
  country: 'us',
  attributeFiltersActive: false,
  timelineActive: false,
  appMode: 'map',
  mapModeViz: 'dots',
  manifestPhase: 'idle',
  geojsonReady: false,
};

describe('resolveCameraRenderMode', () => {
  it('defaults to tiles', () => {
    expect(resolveCameraRenderMode(base)).toEqual({
      renderMode: 'tiles', needsGeojson: false, needsManifest: false,
    });
  });

  it('uses filter-tiles when filters active and manifest ready', () => {
    expect(resolveCameraRenderMode({
      ...base, attributeFiltersActive: true, manifestPhase: 'ready',
    })).toEqual({ renderMode: 'filter-tiles', needsGeojson: false, needsManifest: true });
  });

  it('stays on tiles (unfiltered) while manifest loads, requesting it', () => {
    expect(resolveCameraRenderMode({
      ...base, attributeFiltersActive: true, manifestPhase: 'loading',
    })).toEqual({ renderMode: 'tiles', needsGeojson: false, needsManifest: true });
  });

  it('falls back to geojson when manifest errored', () => {
    const r = resolveCameraRenderMode({
      ...base, attributeFiltersActive: true, manifestPhase: 'error', geojsonReady: true,
    });
    expect(r.renderMode).toBe('geojson');
    expect(r.needsGeojson).toBe(true);
  });

  it('falls back to geojson when filter tiles failed', () => {
    const r = resolveCameraRenderMode({
      ...base, attributeFiltersActive: true, manifestPhase: 'ready',
      filterTilesFailed: true, geojsonReady: true,
    });
    expect(r.renderMode).toBe('geojson');
    expect(r.needsGeojson).toBe(true);
  });

  it('holds tiles during geojson fallback hydration (never blanks the map)', () => {
    const r = resolveCameraRenderMode({
      ...base, attributeFiltersActive: true, manifestPhase: 'error', geojsonReady: false,
    });
    expect(r.renderMode).toBe('tiles');
    expect(r.needsGeojson).toBe(true);
  });

  it('timeline date forces geojson even with manifest ready', () => {
    const r = resolveCameraRenderMode({
      ...base, timelineActive: true, manifestPhase: 'ready', geojsonReady: true,
    });
    expect(r.renderMode).toBe('geojson');
  });

  it('explore, heatmap, canada, and tilesFailed force geojson', () => {
    for (const patch of [
      { appMode: 'explore' },
      { mapModeViz: 'heatmap' },
      { country: 'ca' },
      { tilesFailed: true },
    ] as Partial<RenderModeInputs>[]) {
      const r = resolveCameraRenderMode({ ...base, ...patch, geojsonReady: true });
      expect(r.renderMode).toBe('geojson');
      expect(r.needsGeojson).toBe(true);
    }
  });
});
