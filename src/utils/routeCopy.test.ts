import { describe, expect, it } from 'vitest';
import { verdictLine } from './routeCopy';

describe('verdictLine', () => {
  it('returns null when the privacy route saves nothing', () => {
    expect(verdictLine(0)).toBeNull();
    expect(verdictLine(-3)).toBeNull();
  });

  it('uses the singular form for one camera', () => {
    expect(verdictLine(1)).toBe('1 fewer camera will scan your plates');
  });

  it('uses the plural form otherwise', () => {
    expect(verdictLine(20)).toBe('20 fewer cameras will scan your plates');
  });
});
