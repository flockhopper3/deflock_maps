import { describe, it, expect } from 'vitest';
import { formatBytes } from './formatting';

describe('formatBytes', () => {
  it('formats sub-MB sizes as whole KB with a 1 KB floor', () => {
    expect(formatBytes(500)).toBe('1 KB');
    expect(formatBytes(640_000)).toBe('640 KB');
  });

  it('formats MB sizes with one decimal', () => {
    expect(formatBytes(2_100_000)).toBe('2.1 MB');
    expect(formatBytes(9_000_000)).toBe('9.0 MB');
  });
});
