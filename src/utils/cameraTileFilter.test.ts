import { describe, it, expect } from 'vitest';
import { buildCameraTileFilter, ZONE_CODES, MOUNT_CODES } from './cameraTileFilter';
import type { CameraFilters, CameraManifest } from '../types';

const manifest: CameraManifest = {
  version: 'v1',
  generatedAt: '2026-07-17T00:00:00Z',
  total: 100,
  brands: [
    { id: 1, label: 'Flock Safety', count: 80 },
    { id: 2, label: 'Genetec', count: 10 },
  ],
  operators: [{ id: 5, label: 'City of Atlanta', count: 7 }],
  zones: [{ id: 1, label: 'traffic', count: 50 }],
  mounts: [{ id: 1, label: 'pole', count: 60 }],
};

const baseFilters: CameraFilters = {
  operators: [],
  brands: [],
  surveillanceZones: [],
  mountTypes: [],
  showAll: true,
};

describe('buildCameraTileFilter', () => {
  it('returns undefined when no filters are active', () => {
    expect(buildCameraTileFilter(baseFilters, manifest)).toBeUndefined();
  });

  it('builds a single-facet brand match on b', () => {
    const f = { ...baseFilters, showAll: false, brands: ['Flock Safety', 'Genetec'] };
    expect(buildCameraTileFilter(f, manifest)).toEqual(
      ['match', ['get', 'b'], [1, 2], true, false]
    );
  });

  it('ANDs multiple facets', () => {
    const f = {
      ...baseFilters,
      showAll: false,
      brands: ['Flock Safety'],
      surveillanceZones: ['traffic'],
    };
    expect(buildCameraTileFilter(f, manifest)).toEqual([
      'all',
      ['match', ['get', 'b'], [1], true, false],
      ['match', ['get', 'z'], [ZONE_CODES.traffic], true, false],
    ]);
  });

  it('maps zones and mounts through the fixed code tables', () => {
    const f = {
      ...baseFilters,
      showAll: false,
      surveillanceZones: ['traffic', 'parking'],
      mountTypes: ['street_light'],
    };
    expect(buildCameraTileFilter(f, manifest)).toEqual([
      'all',
      ['match', ['get', 'z'], [1, 3], true, false],
      ['match', ['get', 'm'], [MOUNT_CODES.street_light], true, false],
    ]);
  });

  it('matches nothing (not everything) when selected labels resolve to no ids', () => {
    const f = { ...baseFilters, showAll: false, brands: ['Ghost Brand'] };
    expect(buildCameraTileFilter(f, manifest)).toEqual(
      ['match', ['get', 'b'], [-1], true, false]
    );
  });

  it('resolves operators against manifest labels', () => {
    const f = { ...baseFilters, showAll: false, operators: ['City of Atlanta'] };
    expect(buildCameraTileFilter(f, manifest)).toEqual(
      ['match', ['get', 'o'], [5], true, false]
    );
  });
});
