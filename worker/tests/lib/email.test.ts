import { describe, it, expect } from 'vitest';
import { buildSuccessMime, buildFailureMime, buildBlockedMime } from '../../src/lib/email';

describe('MIME headers (required by Cloudflare send_email)', () => {
  it('includes a Message-ID, Date and MIME-Version on every message', () => {
    const mime = buildSuccessMime({
      featureCount: 100, previousCount: null, updatedAt: 'now',
      source: 'overpass', endpoint: 'x', r2Key: 'k', sizeBytes: 1,
    });
    expect(mime).toMatch(/Message-ID: <.+@dontgetflocked\.com>/);
    expect(mime).toMatch(/Date: .+/);
    expect(mime).toContain('MIME-Version: 1.0');
  });

  it('generates a unique Message-ID per message', () => {
    const a = buildFailureMime({ fetcherName: 'cameras', error: 'e', retriesAttempted: 3, maxRetries: 3, lastUpdated: null, now: 'now' });
    const b = buildFailureMime({ fetcherName: 'cameras', error: 'e', retriesAttempted: 3, maxRetries: 3, lastUpdated: null, now: 'now' });
    const idOf = (m: string) => m.match(/Message-ID: (<.+>)/)?.[1];
    expect(idOf(a)).not.toBe(idOf(b));
  });
});

describe('buildBlockedMime', () => {
  it('reports the delta, limit and force instructions', () => {
    const mime = buildBlockedMime({
      fetcherName: 'cameras',
      newCount: 50_000,
      previousCount: 107_000,
      deltaPct: -0.533,
      limitPct: 0.05,
      now: '2026-06-25T21:00:00Z',
    });
    expect(mime).toContain('Subject: FlockHopper Data BLOCKED: count moved -53.3% (R2 NOT updated)');
    expect(mime).toContain('New count:      50,000');
    expect(mime).toContain('Previous count: 107,000');
    expect(mime).toContain('-53.3% (allowed ±5.0%)');
    expect(mime).toContain('force=true');
  });
});

describe('buildSuccessMime', () => {
  it('includes feature count and delta in subject', () => {
    const mime = buildSuccessMime({
      featureCount: 62147,
      previousCount: 62100,
      updatedAt: '2026-04-06T03:00:12Z',
      source: 'overpass',
      endpoint: 'https://overpass.deflock.org/api/interpreter',
      r2Key: 'cameras.geojson.gz',
      sizeBytes: 24_500_000,
    });

    expect(mime).toContain('Subject: FlockHopper Data Updated: 62,147 cameras (+47)');
    expect(mime).toContain('From: alerts@dontgetflocked.com');
    expect(mime).toContain('To: flockhopper@proton.me');
    expect(mime).toContain('62,147 (+47 since last update)');
    expect(mime).toContain('Endpoint:   https://overpass.deflock.org/api/interpreter');
    expect(mime).toContain('Source:     overpass');
  });

  it('shows no delta when previous count is null', () => {
    const mime = buildSuccessMime({
      featureCount: 62147,
      previousCount: null,
      updatedAt: '2026-04-06T03:00:12Z',
      source: 'overpass',
      endpoint: 'overpass-api.de',
      r2Key: 'cameras.geojson.gz',
      sizeBytes: 24_500_000,
    });

    expect(mime).toContain('Subject: FlockHopper Data Updated: 62,147 cameras');
    expect(mime).toContain('62,147');
    expect(mime).not.toContain('since last update');
  });

  it('shows negative delta', () => {
    const mime = buildSuccessMime({
      featureCount: 62000,
      previousCount: 62100,
      updatedAt: '2026-04-06T03:00:12Z',
      source: 'overpass',
      endpoint: 'overpass-api.de',
      r2Key: 'cameras.geojson.gz',
      sizeBytes: 24_500_000,
    });

    expect(mime).toContain('(-100)');
  });
});

describe('buildFailureMime', () => {
  it('includes error and stale age in subject', () => {
    const mime = buildFailureMime({
      fetcherName: 'cameras',
      error: 'All Overpass endpoints failed: HTTP 429; timeout; HTTP 503',
      retriesAttempted: 3,
      maxRetries: 3,
      lastUpdated: '2026-04-03T04:00:33Z',
      now: '2026-04-06T03:00:00Z',
    });

    expect(mime).toContain('Subject: FlockHopper Data FAILED: cameras fetcher error');
    expect(mime).toContain('From: alerts@dontgetflocked.com');
    expect(mime).toContain('To: flockhopper@proton.me');
    expect(mime).toContain('All Overpass endpoints failed');
    expect(mime).toContain('3/3 exhausted');
    expect(mime).toContain('2026-04-03T04:00:33Z');
  });

  it('shows unknown when lastUpdated is null', () => {
    const mime = buildFailureMime({
      fetcherName: 'cameras',
      error: 'Timeout',
      retriesAttempted: 3,
      maxRetries: 3,
      lastUpdated: null,
      now: '2026-04-06T03:00:00Z',
    });

    expect(mime).toContain('Stale Since:    unknown');
  });
});
