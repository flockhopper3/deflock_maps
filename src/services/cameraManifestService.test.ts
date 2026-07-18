import { describe, it, expect, vi, beforeEach } from 'vitest';
import {
  loadCameraManifest,
  _resetManifestCacheForTests,
} from './cameraManifestService';

const validManifest = {
  version: '2026-07-17',
  generatedAt: '2026-07-17T00:00:00Z',
  total: 114000,
  brands: [{ id: 1, label: 'Flock Safety', count: 81234 }],
  operators: [{ id: 1, label: 'City of Atlanta', count: 120 }],
  zones: [{ id: 1, label: 'traffic', count: 90000 }],
  mounts: [{ id: 1, label: 'pole', count: 100000 }],
};

beforeEach(() => {
  _resetManifestCacheForTests();
  vi.unstubAllGlobals();
});

describe('loadCameraManifest', () => {
  it('fetches and returns the manifest', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(
      new Response(JSON.stringify(validManifest), { status: 200 })
    ));
    const m = await loadCameraManifest();
    expect(m.brands[0].label).toBe('Flock Safety');
  });

  it('caches after first load (single fetch)', async () => {
    const fetchMock = vi.fn().mockResolvedValue(
      new Response(JSON.stringify(validManifest), { status: 200 })
    );
    vi.stubGlobal('fetch', fetchMock);
    await loadCameraManifest();
    await loadCameraManifest();
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it('dedupes concurrent calls into one fetch', async () => {
    const fetchMock = vi.fn().mockResolvedValue(
      new Response(JSON.stringify(validManifest), { status: 200 })
    );
    vi.stubGlobal('fetch', fetchMock);
    await Promise.all([loadCameraManifest(), loadCameraManifest()]);
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it('throws on HTTP error and allows retry', async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(new Response('nope', { status: 404 }))
      .mockResolvedValueOnce(
        new Response(JSON.stringify(validManifest), { status: 200 })
      );
    vi.stubGlobal('fetch', fetchMock);
    await expect(loadCameraManifest()).rejects.toThrow();
    const m = await loadCameraManifest();
    expect(m.total).toBe(114000);
  });

  it('throws on malformed payload', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(
      new Response(JSON.stringify({ hello: 'world' }), { status: 200 })
    ));
    await expect(loadCameraManifest()).rejects.toThrow();
  });
});
