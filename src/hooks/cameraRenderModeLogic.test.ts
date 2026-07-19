import { describe, it, expect } from 'vitest';
import { resolveCameraRenderMode, isGeojsonMode, type RenderModeInputs } from './cameraRenderModeLogic';

const base: RenderModeInputs = {
  filterTilesFailed: false,
  attributeFiltersActive: false,
  timelineActive: false,
  appMode: 'map',
  mapModeViz: 'dots',
  manifestPhase: 'idle',
  geojsonReady: false,
};

describe('isGeojsonMode', () => {
  it('is true only for explore, heatmap, and timeline', () => {
    expect(isGeojsonMode({ appMode: 'explore', mapModeViz: 'dots', timelineActive: false })).toBe(true);
    expect(isGeojsonMode({ appMode: 'map', mapModeViz: 'heatmap', timelineActive: false })).toBe(true);
    expect(isGeojsonMode({ appMode: 'map', mapModeViz: 'dots', timelineActive: true })).toBe(true);
  });

  it('is false for plain map and route views', () => {
    expect(isGeojsonMode({ appMode: 'map', mapModeViz: 'dots', timelineActive: false })).toBe(false);
    expect(isGeojsonMode({ appMode: 'route', mapModeViz: 'dots', timelineActive: false })).toBe(false);
    // heatmap viz forces geojson only in map mode, not route
    expect(isGeojsonMode({ appMode: 'route', mapModeViz: 'heatmap', timelineActive: false })).toBe(false);
  });
});

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

  it('degrades to unfiltered tiles (never geojson) when manifest errored', () => {
    expect(resolveCameraRenderMode({
      ...base, attributeFiltersActive: true, manifestPhase: 'error', geojsonReady: true,
    })).toEqual({ renderMode: 'tiles', needsGeojson: false, needsManifest: false });
  });

  it('degrades to unfiltered tiles (never geojson) when filter tiles failed', () => {
    expect(resolveCameraRenderMode({
      ...base, attributeFiltersActive: true, manifestPhase: 'ready',
      filterTilesFailed: true, geojsonReady: true,
    })).toEqual({ renderMode: 'tiles', needsGeojson: false, needsManifest: false });
  });

  it('timeline date forces geojson even with manifest ready', () => {
    const r = resolveCameraRenderMode({
      ...base, timelineActive: true, manifestPhase: 'ready', geojsonReady: true,
    });
    expect(r.renderMode).toBe('geojson');
    expect(r.needsGeojson).toBe(true);
  });

  it('explore and heatmap force geojson', () => {
    for (const patch of [
      { appMode: 'explore' },
      { mapModeViz: 'heatmap' },
    ] as Partial<RenderModeInputs>[]) {
      const r = resolveCameraRenderMode({ ...base, ...patch, geojsonReady: true });
      expect(r.renderMode).toBe('geojson');
      expect(r.needsGeojson).toBe(true);
    }
  });

  it('holds tiles until geojson hydrates for a genuine geojson mode', () => {
    const r = resolveCameraRenderMode({ ...base, appMode: 'explore', geojsonReady: false });
    expect(r.renderMode).toBe('tiles');
    expect(r.needsGeojson).toBe(true);
  });
});
