/**
 * Cumulative growth chart for the timeline scrubber.
 *
 * Two identical paths: one dim, one accent-colored and clipped to the current
 * progress. The path never changes during playback, so React diffs both as
 * unchanged and only the clip rect's width is written to the DOM per tick —
 * matching the performance of the imperative per-bar coloring this replaces.
 */

// Static: exactly one TimelineBar is mounted at a time. useId() would emit ':r0:',
// whose colons are hostile to url(#...) references.
const CLIP_ID = 'timeline-sparkline-clip';

interface TimelineSparklineProps {
  /** SVG path in a 0 0 1000 100 viewBox — see buildSparklinePath */
  path: string;
  /** Scrubber position, 0-100 */
  progressPercent: number;
}

export function TimelineSparkline({ path, progressPercent }: TimelineSparklineProps) {
  if (!path) return null;

  return (
    <svg
      viewBox="0 0 1000 100"
      preserveAspectRatio="none"
      className="absolute inset-0 w-full h-full"
      aria-hidden="true"
    >
      <defs>
        <clipPath id={CLIP_ID}>
          {/* viewBox is 1000 wide, so percent maps to units at 10x */}
          <rect x="0" y="0" width={progressPercent * 10} height="100" />
        </clipPath>
      </defs>
      <path d={path} fill="rgba(255,255,255,0.1)" />
      <path d={path} fill="rgba(34,211,238,0.6)" clipPath={`url(#${CLIP_ID})`} />
    </svg>
  );
}
