import type { GeoJSON } from '../types';

export function pointFeature(
  lon: number,
  lat: number,
  properties: Record<string, unknown>
): GeoJSON.Feature {
  return {
    type: 'Feature',
    geometry: {
      type: 'Point',
      coordinates: [lon, lat],
    },
    properties,
  };
}

export function buildFeatureCollection(
  features: GeoJSON.Feature[]
): GeoJSON.FeatureCollection {
  return {
    type: 'FeatureCollection',
    features,
  };
}
