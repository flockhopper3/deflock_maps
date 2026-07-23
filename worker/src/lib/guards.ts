// Pure, deterministic safety checks for the data pipeline. Kept dependency-free so
// they can be unit-tested without any network or Cloudflare bindings.

/** Signed fractional change from `previous` to `next` (e.g. +0.07 means +7%). */
export function deltaFraction(next: number, previous: number): number {
  if (previous <= 0) return 0;
  return (next - previous) / previous;
}

/**
 * Cross-run sanity check: true if the new total moved more than ±maxPct from the
 * previous total. Returns false when there is no usable baseline (first run), so a
 * fresh deploy isn't blocked by a missing previous count.
 */
export function deltaGuardTripped(
  next: number,
  previous: number | null,
  maxPct: number
): boolean {
  if (previous === null || previous <= 0) return false;
  return Math.abs(deltaFraction(next, previous)) > maxPct;
}

/**
 * Per-tile integrity check: true if a tile's fetched feature count fell short of
 * what its count-probe promised (beyond `tolerance`). Catches a tile that returns
 * HTTP 200 but partial/empty data — the silent-failure case tiling introduces.
 */
export function tileIntegrityFailed(
  produced: number,
  probed: number,
  tolerance: number
): boolean {
  if (probed <= 0) return false;
  return produced < probed * (1 - tolerance);
}

/** Per-country write floor: true if a dataset's count is below its minimum acceptable value. */
export function belowMinimum(count: number, min: number): boolean {
  return count < min;
}
