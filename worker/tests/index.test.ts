import { describe, it, expect, vi, beforeEach } from 'vitest';

// Mock R2 bucket
function createMockBucket(objects: Record<string, { body: string; etag: string; metadata: Record<string, string> }>) {
  return {
    get: vi.fn(async (key: string) => {
      const obj = objects[key];
      if (!obj) return null;
      return {
        body: new ReadableStream({
          start(controller) {
            controller.enqueue(new TextEncoder().encode(obj.body));
            controller.close();
          },
        }),
        etag: obj.etag,
        customMetadata: obj.metadata,
        httpMetadata: { contentType: 'application/geo+json', contentEncoding: 'gzip' },
      };
    }),
    head: vi.fn(async (key: string) => {
      const obj = objects[key];
      if (!obj) return null;
      return {
        key,
        etag: obj.etag,
        customMetadata: obj.metadata,
      };
    }),
    list: vi.fn(async () => ({
      objects: Object.keys(objects).map((key) => ({
        key,
        // Note: R2 list() does NOT return customMetadata — head() is used instead
      })),
    })),
    put: vi.fn(),
  };
}

import { handleFetchRequest } from '../src/index';

describe('HTTP handler', () => {
  const mockBucket = createMockBucket({
    'cameras.geojson.gz': {
      body: 'gzipped-data',
      etag: '"abc123"',
      metadata: { 'x-last-updated': '2026-03-20T08:00:00Z', 'x-feature-count': '62000' },
    },
  });

  const env = { DATA_BUCKET: mockBucket as unknown as R2Bucket, ENVIRONMENT: 'production' };

  it('serves dataset from R2 with correct headers', async () => {
    const req = new Request('https://data.dontgetflocked.com/cameras.geojson.gz', {
      headers: { Origin: 'https://dontgetflocked.com' },
    });

    const res = await handleFetchRequest(req, env);

    expect(res.status).toBe(200);
    expect(res.headers.get('Content-Type')).toBe('application/geo+json');
    // Content-Encoding is handled by Cloudflare's edge, not the Worker
    expect(res.headers.get('Cache-Control')).toBe('public, max-age=3600, s-maxage=86400');
    expect(res.headers.get('ETag')).toBe('"abc123"');
    expect(res.headers.get('Access-Control-Allow-Origin')).toBe('https://dontgetflocked.com');
  });

  it('returns 404 for unknown paths', async () => {
    const req = new Request('https://data.dontgetflocked.com/unknown.geojson.gz');
    const res = await handleFetchRequest(req, env);
    expect(res.status).toBe(404);
  });

  it('returns 304 when ETag matches', async () => {
    const req = new Request('https://data.dontgetflocked.com/cameras.geojson.gz', {
      headers: { 'If-None-Match': '"abc123"', Origin: 'https://dontgetflocked.com' },
    });

    const res = await handleFetchRequest(req, env);
    expect(res.status).toBe(304);
  });

  it('returns dataset index at /', async () => {
    const req = new Request('https://data.dontgetflocked.com/', {
      headers: { Origin: 'https://dontgetflocked.com' },
    });

    const res = await handleFetchRequest(req, env);
    expect(res.status).toBe(200);

    const body = await res.json();
    expect(body.datasets).toHaveLength(1);
    expect(body.datasets[0].name).toBe('cameras');
  });

  it('handles CORS preflight', async () => {
    const req = new Request('https://data.dontgetflocked.com/cameras.geojson.gz', {
      method: 'OPTIONS',
      headers: { Origin: 'https://dontgetflocked.com' },
    });

    const res = await handleFetchRequest(req, env);
    expect(res.status).toBe(204);
    expect(res.headers.get('Access-Control-Allow-Origin')).toBe('https://dontgetflocked.com');
  });
});
