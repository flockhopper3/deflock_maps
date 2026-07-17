import { describe, it, expect } from 'vitest';
import { parseDirections, transformOverpassToGeoJSON } from '../../src/fetchers/cameras';
import { queryOverpass } from '../../src/lib/overpass';

const baseNode = {
  type: 'node' as const,
  id: 13850939047,
  lat: 39.0559212,
  lon: -76.0483203,
};

describe('node 13850939047 — repro the field bug', () => {
  it('v1/v2 typo "45555555555555" is silently mod-360 into a fake bearing', () => {
    expect(parseDirections('45555555555555')).toEqual([195]);
  });

  it('v2 → baked snapshot direction = 195°', () => {
    const fc = transformOverpassToGeoJSON({
      version: 0.6,
      generator: 't',
      osm3s: { timestamp_osm_base: '', copyright: '' },
      elements: [
        {
          ...baseNode,
          tags: {
            'camera:direction': '45555555555555',
            'man_made': 'surveillance',
            'surveillance:type': 'ALPR',
          },
        },
      ],
    } as any);
    expect(fc.features[0].properties.direction).toBe(195);
  });

  it('v3 (direction=265 + bogus camera:direction) → 265°, NOT 300', () => {
    const fc = transformOverpassToGeoJSON({
      version: 0.6,
      generator: 't',
      osm3s: { timestamp_osm_base: '', copyright: '' },
      elements: [
        {
          ...baseNode,
          tags: {
            'camera:direction': '45555555555555',
            'direction': '265',
            'man_made': 'surveillance',
            'surveillance:type': 'ALPR',
          },
        },
      ],
    } as any);
    expect(fc.features[0].properties.direction).toBe(265);
  });

  it('v4 (current OSM state: camera:direction=300, direction=265) → worker still picks 265', () => {
    const fc = transformOverpassToGeoJSON({
      version: 0.6,
      generator: 't',
      osm3s: { timestamp_osm_base: '', copyright: '' },
      elements: [
        {
          ...baseNode,
          tags: {
            'camera:direction': '300',
            'direction': '265',
            'man_made': 'surveillance',
            'surveillance:type': 'ALPR',
          },
        },
      ],
    } as any);
    expect(fc.features[0].properties.direction).toBe(265);
  });

  it('end-to-end against LIVE Overpass for node 13850939047', async () => {
    const data = await queryOverpass('[out:json][timeout:60];node(13850939047);out meta;');
    const fc = transformOverpassToGeoJSON(data);
    console.log('Live OSM tags:', (data.elements[0] as any).tags);
    console.log('Worker output direction:', fc.features[0].properties.direction);
    console.log('Full worker properties:', fc.features[0].properties);
    expect(fc.features[0].properties.direction).toBe(265);
  }, 30_000);
});
