import { useMapStore } from '../../store';
import type { TileViewBrandStats } from '../../services/cameraIndexService';

/** Rank-slot blues. Unknown/Other never consume one; grays are reserved for
 *  "not a named brand" so the accent ramp always means identified vendors. */
const BLUE_RAMP = ['#0080BC', '#4db3e0', '#7dd0f2', '#b8e5fa'];
const UNKNOWN_GRAY = '#3f4550';
const OTHER_GRAY = '#6b7280';

interface Segment {
  label: string;
  count: number;
  pct: number;
  color: string;
}

function toSegments(stats: TileViewBrandStats): Segment[] {
  let blue = 0;
  const segs: Segment[] = stats.top.map((t) => ({
    label: t.label,
    count: t.count,
    pct: Math.round((100 * t.count) / stats.total),
    color: t.unknown ? UNKNOWN_GRAY : BLUE_RAMP[blue++],
  }));
  if (stats.otherCount > 0) {
    segs.push({
      label: `${stats.otherBrands} other${stats.otherBrands === 1 ? '' : 's'}`,
      count: stats.otherCount,
      pct: Math.round((100 * stats.otherCount) / stats.total),
      color: OTHER_GRAY,
    });
  }
  return segs;
}

function StackedBar({ segments }: { segments: Segment[] }) {
  return (
    <div className="flex h-2 rounded-full overflow-hidden bg-white/[0.06]">
      {segments.map((s, i) => (
        <div
          key={`${s.label}-${i}`}
          style={{ width: `${(100 * s.count) / segments.reduce((a, x) => a + x.count, 0)}%`, background: s.color }}
        />
      ))}
    </div>
  );
}

/**
 * Viewport brand composition from the positions index. Renders nothing when
 * stats are unavailable (filters active, geojson modes, index not loaded).
 * variant="full": stacked bar + two-column legend (desktop panel, mobile full sheet).
 * variant="strip": micro-label + leader summary + bar only (mobile minimized drawer).
 */
export function BrandBreakdown({ variant = 'full' }: { variant?: 'full' | 'strip' }) {
  const stats = useMapStore((s) => s.tileViewBrandStats);
  if (!stats || stats.total === 0 || stats.top.length === 0) return null;
  const segments = toSegments(stats);

  if (variant === 'strip') {
    const leader = segments[0];
    return (
      <div className="mt-2.5 animate-fade-in">
        <div className="flex items-center justify-between mb-1.5">
          <span className="text-2xs text-dark-500 uppercase">In view by brand</span>
          <span className="text-xs text-dark-400">
            <span className="text-dark-200 font-semibold tabular-nums">{leader.pct}%</span> {leader.label}
          </span>
        </div>
        <StackedBar segments={segments} />
      </div>
    );
  }

  return (
    <div>
      <StackedBar segments={segments} />
      <div className="grid grid-cols-2 gap-x-4 gap-y-1.5 mt-3">
        {segments.map((s, i) => (
          <div key={`${s.label}-${i}`} className="flex items-center gap-2 min-w-0">
            <span
              className="w-2 h-2 rounded-sm flex-shrink-0"
              style={{ background: s.color }}
              aria-hidden="true"
            />
            <span className="text-xs text-dark-400 truncate">{s.label}</span>
            <span className="ml-auto text-xs text-dark-200 font-semibold tabular-nums">{s.pct}%</span>
          </div>
        ))}
      </div>
    </div>
  );
}

/**
 * "Cameras in view" panel section: total + full breakdown, hairline below.
 * Collapses entirely when the breakdown is unavailable, so the Map panel
 * degrades to its current About-first layout.
 */
export function CamerasInViewSection() {
  const stats = useMapStore((s) => s.tileViewBrandStats);
  if (!stats || stats.total === 0 || stats.top.length === 0) return null;
  return (
    <div className="px-6 pt-5 pb-4 border-b border-dark-700/50">
      <div className="flex items-baseline justify-between mb-3">
        <span className="text-2xs text-dark-500 uppercase">Cameras in view</span>
        <span className="text-lg font-display font-bold text-accent tabular-nums">
          {stats.total.toLocaleString()}
        </span>
      </div>
      <BrandBreakdown variant="full" />
    </div>
  );
}
