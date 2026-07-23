import { describe, it, expect, vi } from 'vitest';
import { readBodyWithProgress } from './cameraDataService';

function streamOf(chunks: string[]): ReadableStream<Uint8Array> {
  const encoder = new TextEncoder();
  return new ReadableStream({
    start(controller) {
      for (const c of chunks) controller.enqueue(encoder.encode(c));
      controller.close();
    },
  });
}

describe('readBodyWithProgress', () => {
  it('reports percent and loaded bytes when Content-Length is present and uncompressed', async () => {
    const onProgress = vi.fn();
    const body = streamOf(['hello', 'world']);
    const response = new Response(body, { headers: { 'Content-Length': '10' } });

    const text = await readBodyWithProgress(response, onProgress);

    expect(text).toBe('helloworld');
    // Final call reports completion with total decompressed bytes
    expect(onProgress).toHaveBeenLastCalledWith(100, 10);
    // Mid-stream calls carry a determinate percent and a running byte count
    const midCalls = onProgress.mock.calls.slice(1, -1);
    expect(midCalls.length).toBeGreaterThan(0);
    for (const [percent, loaded] of midCalls) {
      expect(percent).toBeGreaterThanOrEqual(0);
      expect(percent).toBeLessThanOrEqual(99);
      expect(loaded).toBeGreaterThan(0);
    }
  });

  it('reports null percent but real byte counts when Content-Encoding is set', async () => {
    const onProgress = vi.fn();
    const body = streamOf(['hello', 'world']);
    const response = new Response(body, {
      headers: { 'Content-Length': '6', 'Content-Encoding': 'br' },
    });

    const text = await readBodyWithProgress(response, onProgress);

    expect(text).toBe('helloworld');
    // Every mid-stream call: indeterminate percent, growing byte count
    const midCalls = onProgress.mock.calls.slice(1, -1);
    expect(midCalls.length).toBeGreaterThan(0);
    for (const [percent, loaded] of midCalls) {
      expect(percent).toBeNull();
      expect(loaded).toBeGreaterThan(0);
    }
    expect(onProgress).toHaveBeenLastCalledWith(100, 10);
  });
});
