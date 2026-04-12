/**
 * Gzip compress a string using the Web Streams CompressionStream API.
 * Available in Cloudflare Workers runtime.
 */
export async function gzipCompress(input: string): Promise<ArrayBuffer> {
  const encoder = new TextEncoder();
  const data = encoder.encode(input);

  const cs = new CompressionStream('gzip');
  const writer = cs.writable.getWriter();
  writer.write(data);
  writer.close();

  const reader = cs.readable.getReader();
  const chunks: Uint8Array[] = [];

  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    chunks.push(value);
  }

  const totalLength = chunks.reduce((acc, c) => acc + c.byteLength, 0);
  const result = new Uint8Array(totalLength);
  let offset = 0;
  for (const chunk of chunks) {
    result.set(chunk, offset);
    offset += chunk.byteLength;
  }

  return result.buffer;
}
