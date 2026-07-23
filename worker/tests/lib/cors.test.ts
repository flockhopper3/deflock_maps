import { describe, it, expect } from 'vitest';
import { getAllowedOrigin, corsHeaders } from '../../src/lib/cors';

describe('getAllowedOrigin', () => {
  it('allows dontgetflocked.com in production', () => {
    expect(getAllowedOrigin('https://dontgetflocked.com', 'production')).toBe('https://dontgetflocked.com');
  });

  it('allows www.dontgetflocked.com in production', () => {
    expect(getAllowedOrigin('https://www.dontgetflocked.com', 'production')).toBe('https://www.dontgetflocked.com');
  });

  it('allows localhost', () => {
    expect(getAllowedOrigin('http://localhost:3000', 'production')).toBe('http://localhost:3000');
  });

  it('allows maps.deflock.org', () => {
    expect(getAllowedOrigin('https://maps.deflock.org', 'production')).toBe('https://maps.deflock.org');
  });

  it('allows preview branches on flockhopper.workers.dev', () => {
    expect(getAllowedOrigin('https://redesign-compact-homepage-flockhopper.flockhopper.workers.dev', 'production'))
      .toBe('https://redesign-compact-homepage-flockhopper.flockhopper.workers.dev');
    expect(getAllowedOrigin('https://stage-flockhopper.flockhopper.workers.dev', 'production'))
      .toBe('https://stage-flockhopper.flockhopper.workers.dev');
  });

  it('allows preview branches on deflock-maps.deflock.workers.dev', () => {
    expect(getAllowedOrigin('https://test-deflock-maps.deflock.workers.dev', 'production'))
      .toBe('https://test-deflock-maps.deflock.workers.dev');
    expect(getAllowedOrigin('https://main-deflock-maps.deflock.workers.dev', 'production'))
      .toBe('https://main-deflock-maps.deflock.workers.dev');
  });

  it('rejects lookalike workers.dev domains', () => {
    expect(getAllowedOrigin('https://flockhopper.workers.dev.evil.com', 'production')).toBeNull();
    expect(getAllowedOrigin('https://evil-flockhopper.workers.dev', 'production')).toBeNull();
    expect(getAllowedOrigin('http://foo.flockhopper.workers.dev', 'production')).toBeNull();
    expect(getAllowedOrigin('https://foo.deflock.workers.dev', 'production')).toBeNull();
    expect(getAllowedOrigin('https://deflock-maps.deflock.workers.dev', 'production')).toBeNull();
  });

  it('rejects unknown origins', () => {
    expect(getAllowedOrigin('https://evil.com', 'production')).toBeNull();
  });

  it('returns null for missing origin', () => {
    expect(getAllowedOrigin(null, 'production')).toBeNull();
  });
});

describe('corsHeaders', () => {
  it('includes origin when allowed', () => {
    const headers = corsHeaders('https://dontgetflocked.com', 'production');
    expect(headers['Access-Control-Allow-Origin']).toBe('https://dontgetflocked.com');
  });

  it('omits origin header when not allowed', () => {
    const headers = corsHeaders('https://evil.com', 'production');
    expect(headers['Access-Control-Allow-Origin']).toBeUndefined();
  });
});
