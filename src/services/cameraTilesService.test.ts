import { describe, it, expect } from 'vitest';
import { archiveKey } from './cameraTilesService';

describe('archiveKey', () => {
  it('matches the main US/CA camera archives', () => {
    expect(archiveKey('pmtiles://tiles.dontgetflocked.com/cameras-us-hourly.pmtiles/9/1/2'))
      .toBe('cameras-us-hourly.pmtiles');
    expect(archiveKey('pmtiles://tiles.dontgetflocked.com/cameras-ca-hourly.pmtiles'))
      .toBe('cameras-ca-hourly.pmtiles');
  });
  it('matches the filter companions', () => {
    expect(archiveKey('pmtiles://tiles.dontgetflocked.com/cameras-us-hourly-filter.pmtiles/10/5/6'))
      .toBe('cameras-us-hourly-filter.pmtiles');
  });
  it('returns null for non-camera / basemap urls', () => {
    expect(archiveKey('https://tiles.dontgetflocked.com/planet.json')).toBeNull();
    expect(archiveKey('pmtiles://example.com/something-else.pmtiles')).toBeNull();
  });
});
