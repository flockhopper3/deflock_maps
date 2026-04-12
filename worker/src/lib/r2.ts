import type { DatasetMetadata } from '../types';

/**
 * Write data to R2 with custom metadata.
 * Data is stored uncompressed — Cloudflare handles edge compression transparently.
 */
export async function writeToR2(
  bucket: R2Bucket,
  key: string,
  data: ArrayBuffer,
  metadata: DatasetMetadata
): Promise<void> {
  await bucket.put(key, data, {
    httpMetadata: {
      contentType: 'application/geo+json',
    },
    customMetadata: {
      'x-last-updated': metadata.lastUpdated,
      'x-feature-count': String(metadata.featureCount),
      'x-source': metadata.source,
    },
  });
}

/**
 * Read an object from R2. Returns null if not found.
 */
export async function readFromR2(
  bucket: R2Bucket,
  key: string
): Promise<{ body: ReadableStream; etag: string; metadata: Record<string, string> } | null> {
  const obj = await bucket.get(key);
  if (!obj) return null;

  return {
    body: obj.body,
    etag: obj.etag,
    metadata: obj.customMetadata ?? {},
  };
}

/**
 * List all dataset objects and their metadata (for the index endpoint).
 * Uses head() per object because list() does not return customMetadata.
 */
export async function listDatasets(
  bucket: R2Bucket
): Promise<Array<{ name: string; path: string; lastUpdated: string | null }>> {
  const listed = await bucket.list({ prefix: '', limit: 100 });

  const geojsonKeys = listed.objects
    .filter((obj) => obj.key.endsWith('.geojson.gz'))
    .map((obj) => obj.key);

  const results: Array<{ name: string; path: string; lastUpdated: string | null }> = [];

  for (const key of geojsonKeys) {
    const head = await bucket.head(key);
    results.push({
      name: key.replace('.geojson.gz', ''),
      path: `/${key}`,
      lastUpdated: head?.customMetadata?.['x-last-updated'] ?? null,
    });
  }

  return results;
}
