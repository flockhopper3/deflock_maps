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
