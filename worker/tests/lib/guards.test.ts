import { describe, it, expect } from 'vitest';
import { deltaFraction, deltaGuardTripped, tileIntegrityFailed, belowMinimum } from '../../src/lib/guards';

describe('deltaFraction', () => {
  it('computes signed fractional change', () => {
    expect(deltaFraction(110, 100)).toBeCloseTo(0.1, 5);
    expect(deltaFraction(90, 100)).toBeCloseTo(-0.1, 5);
    expect(deltaFraction(100, 100)).toBe(0);
  });

  it('returns 0 when previous is non-positive (no baseline)', () => {
    expect(deltaFraction(100, 0)).toBe(0);
    expect(deltaFraction(100, -5)).toBe(0);
  });
});

describe('deltaGuardTripped', () => {
  const LIMIT = 0.05; // ±5%

  it('does not trip for small changes within the limit', () => {
    expect(deltaGuardTripped(102_000, 100_000, LIMIT)).toBe(false); // +2%
    expect(deltaGuardTripped(96_000, 100_000, LIMIT)).toBe(false);  // -4%
    expect(deltaGuardTripped(105_000, 100_000, LIMIT)).toBe(false); // exactly +5% (not > limit)
  });

  it('trips for a large drop (the partial-failure case)', () => {
    expect(deltaGuardTripped(50_000, 100_000, LIMIT)).toBe(true);   // -50%
    expect(deltaGuardTripped(94_000, 100_000, LIMIT)).toBe(true);   // -6%
  });

  it('trips for a large spike', () => {
    expect(deltaGuardTripped(107_000, 62_000, LIMIT)).toBe(true);   // +73% (the migration jump)
  });

  it('never trips when there is no previous baseline', () => {
    expect(deltaGuardTripped(0, null, LIMIT)).toBe(false);
    expect(deltaGuardTripped(100_000, null, LIMIT)).toBe(false);
    expect(deltaGuardTripped(100_000, 0, LIMIT)).toBe(false);
  });
});

describe('tileIntegrityFailed', () => {
  const TOL = 0.10; // tile must deliver >= 90% of its probed count

  it('passes when the tile delivers what the probe promised', () => {
    expect(tileIntegrityFailed(5000, 5000, TOL)).toBe(false);
    expect(tileIntegrityFailed(4800, 5000, TOL)).toBe(false); // -4%, within tolerance
    expect(tileIntegrityFailed(5200, 5000, TOL)).toBe(false); // more than expected is fine
  });

  it('fails when the tile returns far fewer features than probed', () => {
    expect(tileIntegrityFailed(0, 5000, TOL)).toBe(true);     // empty response, should have data
    expect(tileIntegrityFailed(2500, 5000, TOL)).toBe(true);  // half — partial response
    expect(tileIntegrityFailed(4000, 5000, TOL)).toBe(true);  // -20%, beyond tolerance
  });

  it('does not flag genuinely empty tiles (probe was 0)', () => {
    expect(tileIntegrityFailed(0, 0, TOL)).toBe(false);
  });
});

describe('belowMinimum', () => {
  it('is true when the count is under the floor', () => {
    expect(belowMinimum(49_999, 50_000)).toBe(true);
  });
  it('is false at or above the floor', () => {
    expect(belowMinimum(50_000, 50_000)).toBe(false);
    expect(belowMinimum(60_000, 50_000)).toBe(false);
  });
  it('never blocks when the floor is 0 (no baseline yet)', () => {
    expect(belowMinimum(0, 0)).toBe(false);
    expect(belowMinimum(5, 0)).toBe(false);
  });
});
