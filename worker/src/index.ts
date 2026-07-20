import { EmailMessage } from 'cloudflare:email';
import type { Env, Dataset, FetchOptions } from './types';
import { corsHeaders } from './lib/cors';
import { readFromR2, listDatasets, writeToR2 } from './lib/r2';
import { getFetchersForSchedule } from './fetchers/registry';
import { retryWithBackoff } from './lib/retry';
import { buildSuccessMime, buildFailureMime, buildBlockedMime } from './lib/email';
import { deltaGuardTripped, deltaFraction, belowMinimum } from './lib/guards';

const MAX_RETRIES = 3;
const RETRY_BASE_DELAY_MS = 15_000;

// Cross-run safety guard: if the new camera count moves more than this fraction
// from the previous run, the write is blocked (R2 keeps the old data) and an alert
// email is sent. Overridable per-env via MAX_DELTA_PCT, or bypassed for a single run
// with `?force=true` on /trigger (used for legitimate large changes / the first run).
const DEFAULT_MAX_DELTA_PCT = 0.05;

export async function handleFetchRequest(
  request: Request,
  env: Env,
  ctx?: ExecutionContext
): Promise<Response> {
  const url = new URL(request.url);
  const origin = request.headers.get('Origin');
  const cors = corsHeaders(origin, env.ENVIRONMENT);

  // Handle CORS preflight
  if (request.method === 'OPTIONS') {
    return new Response(null, { status: 204, headers: cors });
  }

  // Manual trigger endpoint
  if (request.method === 'POST' && url.pathname === '/trigger') {
    const auth = request.headers.get('Authorization');
    if (!auth || auth !== `Bearer ${env.TRIGGER_SECRET}`) {
      return new Response('Unauthorized', { status: 401, headers: cors });
    }

    // `?force=true` bypasses the delta guard AND per-country floor for this run.
    const forceParam = url.searchParams.get('force');
    const force = forceParam === 'true' || forceParam === '1';

    // Dev-only: `?bbox=s,w,n,e` restricts US tiling to a single box for fast local
    // testing (neighbour area queries still run in full). Ignored in production so a
    // scoped run can never write partial prod data.
    let bboxOverride: FetchOptions['bboxOverride'];
    if (env.ENVIRONMENT !== 'production') {
      const raw = url.searchParams.get('bbox');
      if (raw) {
        const p = raw.split(',').map(Number);
        if (p.length === 4 && p.every((n) => Number.isFinite(n))) {
          bboxOverride = [p[0], p[1], p[2], p[3]];
        }
      }
    }

    const result = await runPipeline(env, { force, bboxOverride });
    return new Response(JSON.stringify(result), {
      status: result.success ? 200 : 500,
      headers: { 'Content-Type': 'application/json', ...cors },
    });
  }

  // Allow GET and HEAD
  if (request.method !== 'GET' && request.method !== 'HEAD') {
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

  // Use Cloudflare Cache API — check edge cache before hitting R2
  const cache = caches.default;
  const cacheKey = new Request(url.toString(), { method: 'GET' });
  const cachedResponse = await cache.match(cacheKey);
  if (cachedResponse) {
    const response = new Response(cachedResponse.body, cachedResponse);
    response.headers.delete('Access-Control-Allow-Origin');
    response.headers.delete('Access-Control-Allow-Methods');
    response.headers.delete('Access-Control-Max-Age');
    Object.entries(cors).forEach(([k, v]) => response.headers.set(k, v));
    return response;
  }

  const obj = await readFromR2(env.DATA_BUCKET, key);
  if (!obj) {
    return new Response('Not found', { status: 404, headers: cors });
  }

  // ETag conditional response
  const ifNoneMatch = request.headers.get('If-None-Match');
  if (ifNoneMatch && (ifNoneMatch === obj.etag || ifNoneMatch === `"${obj.etag}"`)) {
    return new Response(null, {
      status: 304,
      headers: { ETag: `"${obj.etag}"`, ...cors },
    });
  }

  const response = new Response(obj.body, {
    status: 200,
    headers: {
      'Content-Type': 'application/geo+json',
      'Cache-Control': 'public, max-age=3600, s-maxage=86400',
      ETag: `"${obj.etag}"`,
      ...cors,
    },
  });

  // Store in edge cache WITHOUT CORS headers (they vary per origin)
  const cacheResponse = new Response(response.clone().body, response);
  cacheResponse.headers.delete('Access-Control-Allow-Origin');
  cacheResponse.headers.delete('Access-Control-Allow-Methods');
  cacheResponse.headers.delete('Access-Control-Max-Age');
  if (ctx) {
    ctx.waitUntil(cache.put(cacheKey, cacheResponse));
  }

  return response;
}

interface PipelineResult {
  success: boolean;
  fetchers: Array<{
    name: string;
    success: boolean;
    featureCount?: number;
    error?: string;
  }>;
}

async function runPipeline(
  env: Env,
  opts: { force?: boolean; bboxOverride?: FetchOptions['bboxOverride'] } = {}
): Promise<PipelineResult> {
  const force = opts.force ?? false;
  const maxDeltaPct = env.MAX_DELTA_PCT ? Number(env.MAX_DELTA_PCT) : DEFAULT_MAX_DELTA_PCT;
  const fetchers = getFetchersForSchedule('*');
  const results: PipelineResult['fetchers'] = [];
  let allSuccess = true;

  for (const fetcher of fetchers) {
    // One fetch pass yields one or more per-country datasets. A fetch failure (tiling /
    // area query / integrity) is retried; if it still fails, alert once for the fetcher.
    let datasets: Dataset[];
    try {
      console.log(`Running fetcher: ${fetcher.name} (with ${MAX_RETRIES} retries)`);
      datasets = await retryWithBackoff(
        () => fetcher.fetch({ bboxOverride: opts.bboxOverride }),
        MAX_RETRIES,
        RETRY_BASE_DELAY_MS
      );
    } catch (error) {
      allSuccess = false;
      const errMsg = error instanceof Error ? error.message : String(error);
      console.error(`Fetcher ${fetcher.name} failed after ${MAX_RETRIES} retries:`, errMsg);
      results.push({ name: fetcher.name, success: false, error: errMsg });
      try {
        const mime = buildFailureMime({
          fetcherName: fetcher.name,
          error: errMsg,
          retriesAttempted: MAX_RETRIES,
          maxRetries: MAX_RETRIES,
          lastUpdated: null,
          now: new Date().toISOString(),
        });
        await env.EMAIL.send(new EmailMessage('alerts@dontgetflocked.com', 'flockhopper@proton.me', mime));
      } catch (emailErr) {
        console.error(`${fetcher.name}: failed to send failure email:`, emailErr);
      }
      continue;
    }

    // Write each dataset independently: its own previous count, floor, delta guard, email.
    for (const ds of datasets) {
      const label = `${fetcher.name}:${ds.country}`;
      const existing = await env.DATA_BUCKET.head(ds.r2Key);
      const previousCount = existing?.customMetadata?.['x-feature-count']
        ? Number(existing.customMetadata['x-feature-count'])
        : null;
      const lastUpdated = existing?.customMetadata?.['x-last-updated'] ?? null;
      const now = new Date().toISOString();

      // Per-country floor. Bypassed by force (e.g. a legit small first run).
      if (!force && belowMinimum(ds.featureCount, ds.minCount)) {
        allSuccess = false;
        const errMsg = `Below floor: ${ds.featureCount} < ${ds.minCount}. Re-run with force=true to accept.`;
        console.warn(`${label}: ${errMsg}`);
        results.push({ name: label, success: false, featureCount: ds.featureCount, error: errMsg });
        try {
          const mime = buildFailureMime({
            fetcherName: label,
            error: errMsg,
            retriesAttempted: MAX_RETRIES,
            maxRetries: MAX_RETRIES,
            lastUpdated,
            now,
          });
          await env.EMAIL.send(new EmailMessage('alerts@dontgetflocked.com', 'flockhopper@proton.me', mime));
        } catch (emailErr) {
          console.error(`${label}: failed to send failure email:`, emailErr);
        }
        continue;
      }

      // Cross-run delta guard (unchanged behavior, keyed per country).
      if (deltaGuardTripped(ds.featureCount, previousCount, maxDeltaPct) && !force) {
        const deltaPct = deltaFraction(ds.featureCount, previousCount as number);
        allSuccess = false;
        console.warn(
          `${label}: delta guard tripped (${ds.featureCount} vs ${previousCount}, ` +
            `${(deltaPct * 100).toFixed(1)}%, limit ±${(maxDeltaPct * 100).toFixed(1)}%). R2 not updated.`
        );
        results.push({
          name: label,
          success: false,
          featureCount: ds.featureCount,
          error: `Delta guard: count moved ${(deltaPct * 100).toFixed(1)}% (limit ±${(maxDeltaPct * 100).toFixed(1)}%). Re-run with force=true to accept.`,
        });
        try {
          const mime = buildBlockedMime({
            fetcherName: label,
            newCount: ds.featureCount,
            previousCount: previousCount as number,
            deltaPct,
            limitPct: maxDeltaPct,
            now,
          });
          await env.EMAIL.send(new EmailMessage('alerts@dontgetflocked.com', 'flockhopper@proton.me', mime));
        } catch (emailErr) {
          console.error(`${label}: failed to send blocked-update email:`, emailErr);
        }
        continue;
      }

      // Write to R2 + success email.
      const json = JSON.stringify(ds.featureCollection);
      const encoded = new TextEncoder().encode(json);
      await writeToR2(env.DATA_BUCKET, ds.r2Key, encoded.buffer as ArrayBuffer, {
        lastUpdated: now,
        featureCount: ds.featureCount,
        source: ds.source,
      });
      console.log(`${label}: wrote ${ds.featureCount} features to ${ds.r2Key} (${encoded.byteLength} bytes)`);
      results.push({ name: label, success: true, featureCount: ds.featureCount });

      try {
        const mime = buildSuccessMime({
          featureCount: ds.featureCount,
          previousCount,
          updatedAt: now,
          source: ds.source,
          endpoint: ds.endpoint,
          r2Key: ds.r2Key,
          sizeBytes: encoded.byteLength,
        });
        await env.EMAIL.send(new EmailMessage('alerts@dontgetflocked.com', 'flockhopper@proton.me', mime));
      } catch (emailErr) {
        console.error(`${label}: failed to send success email:`, emailErr);
      }
    }
  }

  return { success: allSuccess, fetchers: results };
}

async function handleScheduled(
  _controller: ScheduledController,
  env: Env
): Promise<void> {
  await runPipeline(env);
}

export default {
  fetch: handleFetchRequest,
  scheduled: handleScheduled,
} satisfies ExportedHandler<Env>;
