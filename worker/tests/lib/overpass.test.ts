import { describe, it, expect, vi, beforeEach } from 'vitest';
import { queryOverpass, OVERPASS_ENDPOINTS } from '../../src/lib/overpass';

describe('queryOverpass', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  it('returns parsed JSON on successful response', async () => {
    const mockData = { version: 0.6, elements: [{ type: 'node', id: 1, lat: 38.9, lon: -77.0 }] };

    global.fetch = vi.fn().mockResolvedValueOnce(
      new Response(JSON.stringify(mockData), { status: 200 })
    );

    const result = await queryOverpass('[out:json];node(1);out;');
    expect(result).toEqual(mockData);
  });

  it('falls back to next endpoint on failure', async () => {
    const mockData = { version: 0.6, elements: [{ type: 'node', id: 1, lat: 38.9, lon: -77.0 }] };

    global.fetch = vi.fn()
      .mockRejectedValueOnce(new Error('Network error'))
      .mockResolvedValueOnce(new Response(JSON.stringify(mockData), { status: 200 }));

    const result = await queryOverpass('[out:json];node(1);out;');
    expect(result).toEqual(mockData);
    expect(global.fetch).toHaveBeenCalledTimes(2);
  });

  it('throws after all endpoints fail', async () => {
    global.fetch = vi.fn()
      .mockRejectedValueOnce(new Error('fail1'))
      .mockRejectedValueOnce(new Error('fail2'))
      .mockRejectedValueOnce(new Error('fail3'));

    await expect(queryOverpass('[out:json];node(1);out;')).rejects.toThrow(
      'All Overpass endpoints failed'
    );
  });

  it('throws on non-200 status', async () => {
    global.fetch = vi.fn()
      .mockResolvedValueOnce(new Response('error', { status: 429 }))
      .mockResolvedValueOnce(new Response('error', { status: 500 }))
      .mockResolvedValueOnce(new Response('error', { status: 503 }));

    await expect(queryOverpass('[out:json];node(1);out;')).rejects.toThrow(
      'All Overpass endpoints failed'
    );
  });

  it('exports the 3 known endpoints', () => {
    expect(OVERPASS_ENDPOINTS).toHaveLength(3);
  });
});
