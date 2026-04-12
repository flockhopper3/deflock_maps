import type { Env } from './types';
import { corsHeaders } from './lib/cors';
import { readFromR2, listDatasets, writeToR2 } from './lib/r2';
import { gzipCompress } from './lib/gzip';
import { getFetchersForSchedule } from './fetchers/registry';

export async function handleFetchRequest(
  request: Request,
  env: { DATA_BUCKET: R2Bucket; ENVIRONMENT: string },
  _ctx?: ExecutionContext
): Promise<Response> {
  const url = new URL(request.url);
  const origin = request.headers.get('Origin');
  const cors = corsHeaders(origin, env.ENVIRONMENT);

  // Handle CORS preflight
  if (request.method === 'OPTIONS') {
    return new Response(null, { status: 204, headers: cors });
  }

  // Only allow GET
  if (request.method !== 'GET') {
    return new Response('Method not allowed', { status: 405, headers: cors });
  }

  // Index endpoint
  if (url.pathname === '/' || url.pathname === '') {
    const datasets = await listDatasets(env.DATA_BUCKET);
    return new Response(JSON.stringify({ datasets }), {
      status: 200,
      headers: {
        'Content-Type': 'application/json',
        'Cache-Control': 'public, max-age=60',
        ...cors,
      },
    });
  }

  // Dataset endpoint — strip leading slash
  const key = url.pathname.slice(1);
  if (!key.endsWith('.geojson.gz') && !key.endsWith('.geojson')) {
    return new Response('Not found', { status: 404, headers: cors });
  }

  const obj = await readFromR2(env.DATA_BUCKET, key);
  if (!obj) {
    return new Response('Not found', { status: 404, headers: cors });
  }

  // ETag conditional response
  const ifNoneMatch = request.headers.get('If-None-Match');
  if (ifNoneMatch && ifNoneMatch === obj.etag) {
    return new Response(null, {
      status: 304,
      headers: { ETag: obj.etag, ...cors },
    });
  }

  return new Response(obj.body, {
    status: 200,
    headers: {
      'Content-Type': 'application/geo+json',
      'Cache-Control': 'public, max-age=3600, s-maxage=86400',
      ETag: obj.etag,
      ...cors,
    },
  });
}

async function handleScheduled(
  event: ScheduledEvent,
  env: Env
): Promise<void> {
  const fetchers = getFetchersForSchedule(event.cron);

  for (const fetcher of fetchers) {
    try {
      console.log(`Running fetcher: ${fetcher.name}`);
      const { featureCollection, featureCount } = await fetcher.fetch();

      const json = JSON.stringify(featureCollection);
      const encoded = new TextEncoder().encode(json);

      await writeToR2(env.DATA_BUCKET, fetcher.r2Key, encoded.buffer, {
        lastUpdated: new Date().toISOString(),
        featureCount,
        source: fetcher.source,
      });

      console.log(`${fetcher.name}: wrote ${featureCount} features to R2 (${encoded.byteLength} bytes)`);
    } catch (error) {
      console.error(`Fetcher ${fetcher.name} failed:`, error);
      // Continue with other fetchers — don't let one failure stop the rest
    }
  }
}

export default {
  fetch: handleFetchRequest,
  scheduled: handleScheduled,
} satisfies ExportedHandler<Env>;
