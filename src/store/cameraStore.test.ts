import { describe, it, expect, vi, beforeEach } from 'vitest';
import { useCameraStore } from './cameraStore';
import { _resetManifestCacheForTests } from '../services/cameraManifestService';
import type { ALPRCamera } from '../types';

const validManifest = {
  version: 'v1',
  generatedAt: '2026-07-17T00:00:00Z',
  total: 3,
  brands: [{ id: 1, label: 'Flock Safety', count: 2 }],
  operators: [],
  zones: [],
  mounts: [],
};

function cam(osmId: number, brand?: string, operator?: string): ALPRCamera {
  return { osmId, osmType: 'node', lat: 33.7, lon: -84.4, brand, operator };
}

beforeEach(() => {
  _resetManifestCacheForTests();
  vi.unstubAllGlobals();
  useCameraStore.setState({
    manifest: null,
    manifestPhase: 'idle',
    filterTilesFailed: false,
    cameras: [],
    filteredCameras: [],
    filters: {
      operators: [], brands: [], surveillanceZones: [], mountTypes: [], showAll: true,
    },
    pendingFilters: { brands: [], operators: [], surveillanceZones: [], mountTypes: [] },
  });
});

describe('ensureManifestLoaded', () => {
  it('loads the manifest and flips phase to ready', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(
      new Response(JSON.stringify(validManifest), { status: 200 })
    ));
    await useCameraStore.getState().ensureManifestLoaded();
    expect(useCameraStore.getState().manifestPhase).toBe('ready');
    expect(useCameraStore.getState().manifest?.brands[0].label).toBe('Flock Safety');
  });

  it('flips phase to error on failure without throwing to caller', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(new Response('x', { status: 404 })));
    await useCameraStore.getState().ensureManifestLoaded();
    expect(useCameraStore.getState().manifestPhase).toBe('error');
  });

  it('is idempotent once ready (no additional manifest fetch on re-invoke)', async () => {
    const fetchMock = vi.fn().mockResolvedValue(
      new Response(JSON.stringify(validManifest), { status: 200 })
    );
    vi.stubGlobal('fetch', fetchMock);
    await useCameraStore.getState().ensureManifestLoaded();
    // First call triggers the manifest fetch plus the fire-and-forget
    // build-skew check (TileJSON fetch) — let it settle before counting.
    await vi.waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(2));
    await useCameraStore.getState().ensureManifestLoaded();
    // Re-invoking after manifest is ready returns early — no new fetches.
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });

  it('degrades to the geojson path when the filter tileset build mismatches the manifest', async () => {
    const versionedManifest = { ...validManifest, version: 'abc123def4567890' };
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(
        new Response(JSON.stringify(versionedManifest), { status: 200 })
      )
      .mockResolvedValueOnce(
        new Response(JSON.stringify({ name: 'cameras-filter 1111111111111111' }), { status: 200 })
      );
    vi.stubGlobal('fetch', fetchMock);
    await useCameraStore.getState().ensureManifestLoaded();
    expect(useCameraStore.getState().filterTilesFailed).toBe(false);
    await vi.waitFor(() => {
      expect(useCameraStore.getState().filterTilesFailed).toBe(true);
    });
  });
});

describe('normalized filter matching (GeoJSON fallback path)', () => {
  it('applyPendingFilters matches brand typos against canonical labels', () => {
    useCameraStore.setState({
      cameras: [cam(1, 'Flock Saftey'), cam(2, 'Genetec'), cam(3, undefined)],
      pendingFilters: {
        brands: ['Flock Safety'], operators: [], surveillanceZones: [], mountTypes: [],
      },
    });
    useCameraStore.getState().applyPendingFilters();
    const ids = useCameraStore.getState().filteredCameras.map((c) => c.osmId);
    expect(ids).toEqual([1]);
  });

  it('setFilters matches operators case-insensitively', () => {
    useCameraStore.setState({
      cameras: [cam(1, undefined, ' city of atlanta '), cam(2, undefined, 'Elsewhere')],
    });
    useCameraStore.getState().setFilters({
      operators: ['City of Atlanta'], showAll: false,
    });
    const ids = useCameraStore.getState().filteredCameras.map((c) => c.osmId);
    expect(ids).toEqual([1]);
  });
});
