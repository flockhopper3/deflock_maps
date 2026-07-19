import { describe, it, expect, vi, beforeEach } from 'vitest';
import { useCameraStore } from './cameraStore';
import { _resetManifestCacheForTests } from '../services/cameraManifestService';
import { clearCameraCache } from '../services/cameraDataService';
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
    pendingFilters: { brands: [], operators: [], surveillanceZones: [], mountTypes: [], state: null },
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

  it('degrades to the geojson path when even a cache-busted pair mismatches', async () => {
    const versionedManifest = { ...validManifest, version: 'abc123def4567890' };
    const staleTilejson = new Response(
      JSON.stringify({ name: 'cameras-filter 1111111111111111' }), { status: 200 }
    );
    const fetchMock = vi
      .fn()
      // initial pair: mismatch
      .mockResolvedValueOnce(new Response(JSON.stringify(versionedManifest), { status: 200 }))
      .mockResolvedValueOnce(staleTilejson.clone())
      // cache-busted retry pair: still mismatched -> genuine failure
      .mockResolvedValueOnce(new Response(JSON.stringify(versionedManifest), { status: 200 }))
      .mockResolvedValueOnce(staleTilejson.clone());
    vi.stubGlobal('fetch', fetchMock);
    await useCameraStore.getState().ensureManifestLoaded();
    expect(useCameraStore.getState().filterTilesFailed).toBe(false);
    await vi.waitFor(() => {
      expect(useCameraStore.getState().filterTilesFailed).toBe(true);
    });
    expect(fetchMock).toHaveBeenCalledTimes(4);
  });

  it('recovers from CDN edge-cache skew via cache-busted refetch', async () => {
    // Edge served a manifest and TileJSON from different hourly builds;
    // origin (cache-busted) copies agree. Filters must survive.
    const staleManifest = { ...validManifest, version: 'aaaaaaaaaaaaaaaa' };
    const freshManifest = {
      ...validManifest,
      version: 'bbbbbbbbbbbbbbbb',
      brands: [{ id: 1, label: 'Fresh Brand', count: 5 }],
    };
    const fetchMock = vi
      .fn()
      // initial pair: skewed
      .mockResolvedValueOnce(new Response(JSON.stringify(staleManifest), { status: 200 }))
      .mockResolvedValueOnce(
        new Response(JSON.stringify({ name: 'cameras-filter bbbbbbbbbbbbbbbb' }), { status: 200 })
      )
      // cache-busted retry pair: coherent
      .mockResolvedValueOnce(new Response(JSON.stringify(freshManifest), { status: 200 }))
      .mockResolvedValueOnce(
        new Response(JSON.stringify({ name: 'cameras-filter bbbbbbbbbbbbbbbb' }), { status: 200 })
      );
    vi.stubGlobal('fetch', fetchMock);
    await useCameraStore.getState().ensureManifestLoaded();
    await vi.waitFor(() => {
      expect(useCameraStore.getState().manifest?.version).toBe('bbbbbbbbbbbbbbbb');
    });
    expect(useCameraStore.getState().filterTilesFailed).toBe(false);
    expect(useCameraStore.getState().manifest?.brands[0].label).toBe('Fresh Brand');
    // retry fetches must be cache-busted
    expect(String(fetchMock.mock.calls[2][0])).toContain('fresh=');
    expect(String(fetchMock.mock.calls[3][0])).toContain('fresh=');
  });
});

describe('retryFilterTiles', () => {
  it('clears filter failure state synchronously and re-requests the manifest', async () => {
    useCameraStore.setState({ filterTilesFailed: true, manifestPhase: 'error', manifest: null });
    const fetchMock = vi.fn().mockResolvedValue(
      new Response(JSON.stringify(validManifest), { status: 200 })
    );
    vi.stubGlobal('fetch', fetchMock);

    useCameraStore.getState().retryFilterTiles();

    // Failure flag is cleared immediately (synchronous reset)
    expect(useCameraStore.getState().filterTilesFailed).toBe(false);

    // The manifest is re-fetched and resolves
    await vi.waitFor(() => expect(useCameraStore.getState().manifestPhase).toBe('ready'));
    expect(useCameraStore.getState().manifest).not.toBeNull();
    expect(fetchMock).toHaveBeenCalled();
  });
});

describe('normalized filter matching (GeoJSON fallback path)', () => {
  it('applyPendingFilters matches brand typos against canonical labels', () => {
    useCameraStore.setState({
      cameras: [cam(1, 'Flock Saftey'), cam(2, 'Genetec'), cam(3, undefined)],
      pendingFilters: {
        brands: ['Flock Safety'], operators: [], surveillanceZones: [], mountTypes: [], state: null,
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

describe('downloadProgress', () => {
  it('tracks percent during a determinate fetch and resets to null on ready', async () => {
    clearCameraCache();
    useCameraStore.setState({
      isInitialized: false, isLoading: false, _initPromise: null,
      loadPhase: 'idle', error: null, cameras: [], country: 'us',
    });

    const body = JSON.stringify({
      type: 'FeatureCollection',
      features: [{
        type: 'Feature',
        geometry: { type: 'Point', coordinates: [-84.4, 33.7] },
        properties: { osmId: 1, osmType: 'node' },
      }],
    });
    const bytes = new TextEncoder().encode(body);
    const stream = new ReadableStream<Uint8Array>({
      start(c) { c.enqueue(bytes); c.close(); },
    });
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({
      ok: true,
      headers: new Headers({ 'Content-Length': String(bytes.byteLength) }),
      body: stream,
      text: async () => body,
    } as unknown as Response));

    const seen: Array<number | null> = [];
    const unsub = useCameraStore.subscribe((s) => { seen.push(s.downloadProgress); });

    await useCameraStore.getState().initializeCameras();
    unsub();

    expect(seen.some(v => typeof v === 'number')).toBe(true); // saw determinate progress
    expect(useCameraStore.getState().downloadProgress).toBeNull(); // reset when settled
    expect(useCameraStore.getState().loadPhase).toBe('ready');
  });
});
