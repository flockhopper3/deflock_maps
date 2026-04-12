import { describe, it, expect } from 'vitest';
import { buildFeatureCollection, pointFeature } from '../../src/lib/geojson';

describe('pointFeature', () => {
  it('creates a GeoJSON point feature with properties', () => {
    const feature = pointFeature(-77.03, 38.89, { osmId: 123, operator: 'Flock' });

    expect(feature.type).toBe('Feature');
    expect(feature.geometry.type).toBe('Point');
    expect(feature.geometry.coordinates).toEqual([-77.03, 38.89]);
    expect(feature.properties.osmId).toBe(123);
    expect(feature.properties.operator).toBe('Flock');
  });
});

describe('buildFeatureCollection', () => {
  it('wraps features in a FeatureCollection', () => {
    const features = [
      pointFeature(-77.03, 38.89, { osmId: 1 }),
      pointFeature(-118.24, 34.05, { osmId: 2 }),
    ];

    const fc = buildFeatureCollection(features);

    expect(fc.type).toBe('FeatureCollection');
    expect(fc.features).toHaveLength(2);
  });

  it('returns empty FeatureCollection for no features', () => {
    const fc = buildFeatureCollection([]);
    expect(fc.type).toBe('FeatureCollection');
    expect(fc.features).toHaveLength(0);
  });
});
