import { describe, it, expect, vi } from 'vitest';
import { readBodyWithProgress } from './cameraDataService';

function chunkStream(chunks: Uint8Array[]): ReadableStream<Uint8Array> {
  return new ReadableStream({
    start(controller) {
      for (const c of chunks) controller.enqueue(c);
      controller.close();
    },
  });
}

const enc = new TextEncoder();

describe('readBodyWithProgress', () => {
  it('reports determinate percent when Content-Length is present and no Content-Encoding', async () => {
    const chunks = [enc.encode('{"a":'), enc.encode('1}')];
    const total = chunks.reduce((n, c) => n + c.byteLength, 0);
    const response = new Response(chunkStream(chunks), {
      headers: { 'Content-Length': String(total) },
    });
    const onProgress = vi.fn();

    const text = await readBodyWithProgress(response, onProgress);

    expect(text).toBe('{"a":1}');
    // starts at 0, ends at 100, intermediate values are numbers 0-100 ascending
    const calls = onProgress.mock.calls.map(c => c[0]);
    expect(calls[0]).toBe(0);
    expect(calls[calls.length - 1]).toBe(100);
    expect(calls.every(v => typeof v === 'number')).toBe(true);
  });

  it('reports null (indeterminate) when Content-Encoding is set', async () => {
    const response = new Response(chunkStream([enc.encode('{"a":1}')]), {
      headers: { 'Content-Length': '3', 'Content-Encoding': 'gzip' },
    });
    const onProgress = vi.fn();

    const text = await readBodyWithProgress(response, onProgress);

    expect(text).toBe('{"a":1}');
    const calls = onProgress.mock.calls.map(c => c[0]);
    expect(calls[0]).toBeNull();
    expect(calls[calls.length - 1]).toBe(100); // completion is always signalled
  });

  it('reports null when Content-Length is missing', async () => {
    const response = new Response(chunkStream([enc.encode('[]')]));
    const onProgress = vi.fn();
    await readBodyWithProgress(response, onProgress);
    expect(onProgress.mock.calls[0][0]).toBeNull();
  });

  it('works without a callback', async () => {
    const response = new Response(chunkStream([enc.encode('{"ok":true}')]));
    await expect(readBodyWithProgress(response)).resolves.toBe('{"ok":true}');
  });
});
