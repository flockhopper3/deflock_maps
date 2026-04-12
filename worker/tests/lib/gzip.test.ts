import { describe, it, expect } from 'vitest';
import { gzipCompress } from '../../src/lib/gzip';

describe('gzipCompress', () => {
  it('compresses a string to a smaller ArrayBuffer', async () => {
    const input = JSON.stringify({ hello: 'world' }).repeat(100);
    const compressed = await gzipCompress(input);

    expect(compressed).toBeInstanceOf(ArrayBuffer);
    expect(compressed.byteLength).toBeLessThan(new TextEncoder().encode(input).byteLength);
  });

  it('produces valid gzip that can be decompressed', async () => {
    const input = JSON.stringify({ type: 'FeatureCollection', features: [] });
    const compressed = await gzipCompress(input);

    // Decompress using DecompressionStream
    const ds = new DecompressionStream('gzip');
    const writer = ds.writable.getWriter();
    writer.write(new Uint8Array(compressed));
    writer.close();

    const decompressedResponse = new Response(ds.readable);
    const text = await decompressedResponse.text();
    expect(text).toBe(input);
  });
});
