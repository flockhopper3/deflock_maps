export const DAY_MS = 24 * 60 * 60 * 1000;
export const MONTH_NAMES = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

/** Date the timeline scrubber starts at, and the `/timeline` route resets to. */
export const TIMELINE_START = '2024-07-01';

/** Only render the sparkline from this date forward — earlier data is a flat tail. */
export const VISIBLE_START = '2024-01-01';

/** Convert day index (0-based from minDay) to YYYY-MM-DD string */
export function dayIndexToDate(index: number, minDay: string): string {
  const d = new Date(minDay + 'T00:00:00Z');
  d.setUTCDate(d.getUTCDate() + index);
  const yyyy = d.getUTCFullYear();
  const mm = String(d.getUTCMonth() + 1).padStart(2, '0');
  const dd = String(d.getUTCDate()).padStart(2, '0');
  return `${yyyy}-${mm}-${dd}`;
}

/** Convert YYYY-MM-DD string to day index (0-based from minDay) */
export function dateToDayIndex(date: string, minDay: string): number {
  const d1 = new Date(minDay + 'T00:00:00Z').getTime();
  const d2 = new Date(date + 'T00:00:00Z').getTime();
  return Math.round((d2 - d1) / DAY_MS);
}

/** Format YYYY-MM-DD as "MMM DD, YYYY" */
export function formatDate(date: string): string {
  const [year, month, day] = date.split('-').map(Number);
  return `${MONTH_NAMES[month - 1]} ${day}, ${year}`;
}

/** Format YYYY-MM-DD as "MMM DD, YYYY" with zero-padded day for fixed width */
export function formatDateFixed(date: string): string {
  const [year, month, day] = date.split('-').map(Number);
  return `${MONTH_NAMES[month - 1]} ${String(day).padStart(2, '0')}, ${year}`;
}

/** Format YYYY-MM-DD as "MMM YYYY" (for range labels) */
export function formatMonthYear(date: string): string {
  const [year, month] = date.split('-').map(Number);
  return `${MONTH_NAMES[month - 1]} ${year}`;
}

/** Total days between two YYYY-MM-DD dates */
export function totalDays(minDay: string, maxDay: string): number {
  return dateToDayIndex(maxDay, minDay);
}

/**
 * Build an SVG area path for a cumulative series, normalized to a 0 0 1000 100
 * viewBox. The viewBox is what makes the chart resolution-independent: it renders
 * identically at 320px and 2560px, so bars can never fall below a pixel.
 *
 * Returns '' for an empty or all-zero series (nothing to draw before the camera
 * dataset hydrates).
 */
export function buildSparklinePath(bars: number[], peak: number): string {
  if (bars.length === 0 || peak <= 0) return '';
  const stepX = bars.length > 1 ? 1000 / (bars.length - 1) : 1000;
  let d = 'M 0 100';
  for (let i = 0; i < bars.length; i++) {
    const x = (i * stepX).toFixed(2);
    const y = (100 - (bars[i] / peak) * 100).toFixed(2);
    d += ` L ${x} ${y}`;
  }
  return `${d} L 1000 100 Z`;
}
