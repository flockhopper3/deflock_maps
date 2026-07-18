import { describe, it, expect } from 'vitest';
import { parseAppUrl, parseCountryParam } from './urlState';

describe('parseAppUrl — mode from path', () => {
  it.each([
    ['/', 'map'],
    ['/map', 'map'],
    ['/route', 'route'],
    ['/timeline', 'explore'],
    ['/explore', 'explore'],
    ['/analysis', 'density'],
    ['/network', 'network'],
  ])('%s parses as %s', (path, mode) => {
    expect(parseAppUrl(path, '').mode).toBe(mode);
  });

  it('canonical path beats legacy ?mode=', () => {
    expect(parseAppUrl('/timeline', '?mode=route').mode).toBe('explore');
    expect(parseAppUrl('/network', '?mode=explore').mode).toBe('network');
  });

  it('legacy ?mode= applies on map paths', () => {
    expect(parseAppUrl('/', '?mode=route').mode).toBe('route');
    expect(parseAppUrl('/map', '?mode=density').mode).toBe('density');
    expect(parseAppUrl('/', '?mode=network').mode).toBe('network');
    expect(parseAppUrl('/', '?mode=explore').mode).toBe('explore');
    expect(parseAppUrl('/', '?mode=bogus').mode).toBe('map');
  });
});

describe('parseAppUrl — state filter', () => {
  it('parses /state/texas as map mode with TX filter', () => {
    const r = parseAppUrl('/state/texas', '');
    expect(r.mode).toBe('map');
    expect(r.stateFilter).toBe('TX');
  });

  it('accepts a trailing slash and postal slugs', () => {
    expect(parseAppUrl('/state/texas/', '').stateFilter).toBe('TX');
    expect(parseAppUrl('/state/tx', '').stateFilter).toBe('TX');
  });

  it('accepts legacy ?state= param', () => {
    expect(parseAppUrl('/', '?state=tx').stateFilter).toBe('TX');
  });

  it('returns null for unknown states', () => {
    expect(parseAppUrl('/state/atlantis', '').stateFilter).toBeNull();
    expect(parseAppUrl('/', '?state=zz').stateFilter).toBeNull();
  });
});

describe('parseAppUrl — viewport', () => {
  it('parses a full viewport', () => {
    expect(parseAppUrl('/', '?lat=33.7&lng=-84.4&zoom=10.55').viewport)
      .toEqual({ lat: 33.7, lng: -84.4, zoom: 10.55 });
  });

  it('defaults zoom to 4 and clamps to [1, 20]', () => {
    expect(parseAppUrl('/', '?lat=33.7&lng=-84.4').viewport?.zoom).toBe(4);
    expect(parseAppUrl('/', '?lat=33.7&lng=-84.4&zoom=99').viewport?.zoom).toBe(20);
    expect(parseAppUrl('/', '?lat=33.7&lng=-84.4&zoom=0.1').viewport?.zoom).toBe(1);
  });

  it('rejects missing or out-of-range coordinates', () => {
    expect(parseAppUrl('/', '?lat=33.7').viewport).toBeNull();
    expect(parseAppUrl('/', '?lat=91&lng=0').viewport).toBeNull();
    expect(parseAppUrl('/', '?lat=0&lng=181').viewport).toBeNull();
    expect(parseAppUrl('/', '').viewport).toBeNull();
  });
});

describe('parseAppUrl — country and viz', () => {
  it('parses country=ca and rejects everything else', () => {
    expect(parseAppUrl('/', '?country=ca').country).toBe('ca');
    expect(parseAppUrl('/', '?country=us').country).toBeNull();
    expect(parseAppUrl('/', '').country).toBeNull();
  });

  it('parses viz values and rejects unknowns', () => {
    expect(parseAppUrl('/timeline', '?viz=heatmap').viz).toBe('heatmap');
    expect(parseAppUrl('/timeline', '?viz=dots').viz).toBe('dots');
    expect(parseAppUrl('/timeline', '?viz=lava').viz).toBeNull();
  });
});

describe('parseCountryParam', () => {
  it('extracts ca from a raw search string', () => {
    expect(parseCountryParam('?country=ca')).toBe('ca');
    expect(parseCountryParam('?country=us')).toBeNull();
    expect(parseCountryParam('')).toBeNull();
  });
});
