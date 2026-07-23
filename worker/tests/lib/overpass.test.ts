import { describe, it, expect, vi, beforeEach } from 'vitest';
import { queryOverpass, OVERPASS_ENDPOINTS, OVERPASS_USER_AGENT } from '../../src/lib/overpass';

describe('queryOverpass', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  it('returns parsed data and the successful endpoint', async () => {
    const mockData = { version: 0.6, elements: [{ type: 'node', id: 1, lat: 38.9, lon: -77.0 }] };

    global.fetch = vi.fn().mockResolvedValueOnce(
      new Response(JSON.stringify(mockData), { status: 200 })
    );

    const result = await queryOverpass('[out:json];node(1);out;');
    expect(result.data).toEqual(mockData);
    expect(result.endpoint).toBe(OVERPASS_ENDPOINTS[0]);
  });

  it('falls back to next endpoint on failure and reports the one that worked', async () => {
    const mockData = { version: 0.6, elements: [{ type: 'node', id: 1, lat: 38.9, lon: -77.0 }] };

    global.fetch = vi.fn()
      .mockRejectedValueOnce(new Error('Network error'))
      .mockResolvedValueOnce(new Response(JSON.stringify(mockData), { status: 200 }));

    const result = await queryOverpass('[out:json];node(1);out;');
    expect(result.data).toEqual(mockData);
    expect(result.endpoint).toBe(OVERPASS_ENDPOINTS[1]);
    expect(global.fetch).toHaveBeenCalledTimes(2);
  });

  it('sends a contact-bearing User-Agent on every request', async () => {
    const mockData = { version: 0.6, elements: [{ type: 'node', id: 1, lat: 38.9, lon: -77.0 }] };
    const fetchMock = vi.fn().mockResolvedValueOnce(
      new Response(JSON.stringify(mockData), { status: 200 })
    );
    global.fetch = fetchMock;

    await queryOverpass('[out:json];node(1);out;');

    const init = fetchMock.mock.calls[0][1] as RequestInit;
    const headers = init.headers as Record<string, string>;
    expect(headers['User-Agent']).toBe(OVERPASS_USER_AGENT);
    expect(headers['User-Agent']).toMatch(/dontgetflocked\.com/);
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
