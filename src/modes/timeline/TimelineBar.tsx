import { useEffect, useCallback, useMemo, useRef } from 'react';
import { useCameraStore } from '../../store';
import { useAppModeStore } from '../../store/appModeStore';
import { Play, Pause } from 'lucide-react';
import {
  DAY_MS,
  VISIBLE_START,
  buildSparklinePath,
  dayIndexToDate,
  dateToDayIndex,
  formatDateFixed,
  totalDays,
} from './timelineUtils';
import { TimelineSparkline } from './TimelineSparkline';
import { useTimelineTicker } from './useTimelineTicker';

export function TimelineBar() {
  const {
    cameras,
    timelineMinDay,
    timelineMaxDay,
    timelineDailyCounts,
    timelineWeeklyCounts,
    timelineMinWeek,
    timelineMaxWeek,
  } = useCameraStore();
  const { timelineSettings, updateTimelineSettings } = useAppModeStore();

  const { currentDate, isPlaying, playSpeed } = timelineSettings;

  const maxIndex = totalDays(timelineMinDay, timelineMaxDay);
  const currentIndex = dateToDayIndex(currentDate, timelineMinDay);
  const clampedIndex = Math.max(0, Math.min(currentIndex, maxIndex));

  const ticker = useTimelineTicker({ timelineMinDay, maxIndex, isPlaying, playSpeed });
  const { dispatchTick, flushTick } = ticker;

  // Visible range starts at Jan 2024 (or timelineMinDay if later)
  const visibleStartIndex = useMemo(
    () => Math.max(0, dateToDayIndex(VISIBLE_START, timelineMinDay)),
    [timelineMinDay]
  );

  // Sparkline: cumulative total per week, clipped to VISIBLE_START onward
  const sparklineData = useMemo(() => {
    const WEEK_MS = 7 * DAY_MS;
    const clipMs = new Date(VISIBLE_START + 'T00:00:00Z').getTime();
    const minWeekMs = new Date(timelineMinWeek + 'T00:00:00Z').getTime();
    const maxWeekMs = new Date(timelineMaxWeek + 'T00:00:00Z').getTime();
    const totalWeeks = Math.round((maxWeekMs - minWeekMs) / WEEK_MS);

    // First pass: accumulate running total across ALL weeks
    let runningTotal = 0;
    const cumulativeAll: number[] = [];
    for (let i = 0; i <= totalWeeks; i++) {
      const d = new Date(minWeekMs + i * WEEK_MS);
      const yyyy = d.getUTCFullYear();
      const mm = String(d.getUTCMonth() + 1).padStart(2, '0');
      const dd = String(d.getUTCDate()).padStart(2, '0');
      const week = `${yyyy}-${mm}-${dd}`;
      runningTotal += timelineWeeklyCounts.get(week) || 0;
      cumulativeAll.push(runningTotal);
    }

    // Second pass: clip to visible range
    const bars: number[] = [];
    for (let i = 0; i <= totalWeeks; i++) {
      const weekMs = minWeekMs + i * WEEK_MS;
      if (weekMs < clipMs) continue;
      bars.push(cumulativeAll[i]);
    }

    const peak = bars.length > 0 ? bars[bars.length - 1] : 0;
    return { bars, peak };
  }, [timelineMinWeek, timelineMaxWeek, timelineWeeklyCounts]);

  // Scrubber position as a percentage of the visible (clipped) range
  const progressPercent = useMemo(() => {
    const visibleRange = maxIndex - visibleStartIndex;
    if (visibleRange <= 0) return 0;
    const ratio = (clampedIndex - visibleStartIndex) / visibleRange;
    return Math.max(0, Math.min(1, ratio)) * 100;
  }, [clampedIndex, visibleStartIndex, maxIndex]);

  const sparklinePath = useMemo(
    () => buildSparklinePath(sparklineData.bars, sparklineData.peak),
    [sparklineData]
  );

  // Precomputed prefix sum — O(1) lookup instead of O(n) loop per scrub
  const cumulativePrefixSum = useMemo(() => {
    const dayCount = totalDays(timelineMinDay, timelineMaxDay);
    const sums = new Int32Array(dayCount + 1);
    let running = 0;
    for (let i = 0; i <= dayCount; i++) {
      const day = dayIndexToDate(i, timelineMinDay);
      running += timelineDailyCounts.get(day) || 0;
      sums[i] = running;
    }
    return sums;
  }, [timelineMinDay, timelineMaxDay, timelineDailyCounts]);

  // Cumulative count up to currentDate — O(1) via prefix sum
  const cumulativeCount = useMemo(() => {
    const idx = Math.min(clampedIndex, cumulativePrefixSum.length - 1);
    const countUpToDate = idx >= 0 ? cumulativePrefixSum[idx] : 0;
    const totalWithTimestamps = cumulativePrefixSum[cumulativePrefixSum.length - 1];
    const noTimestampCount = cameras.length - totalWithTimestamps;
    return countUpToDate + noTimestampCount;
  }, [clampedIndex, cumulativePrefixSum, cameras.length]);

  // --- Scrubber via pointer events (maps to visible range) ---
  const trackRef = useRef<HTMLDivElement>(null);
  const isDraggingRef = useRef(false);
  const pendingDateRef = useRef<string | null>(null);
  const rafRef = useRef<number>(0);

  // Cleanup RAF on unmount
  useEffect(() => {
    return () => {
      if (rafRef.current) cancelAnimationFrame(rafRef.current);
    };
  }, []);

  const indexFromPointer = useCallback(
    (clientX: number) => {
      const track = trackRef.current;
      if (!track) return visibleStartIndex;
      const rect = track.getBoundingClientRect();
      const ratio = Math.max(0, Math.min(1, (clientX - rect.left) / rect.width));
      return Math.round(visibleStartIndex + ratio * (maxIndex - visibleStartIndex));
    },
    [maxIndex, visibleStartIndex]
  );

  const applyIndex = useCallback(
    (index: number) => {
      const newDate = dayIndexToDate(index, timelineMinDay);

      // Coalesce map filter + React state into a single RAF so both happen
      // in the same frame. This throttles 120Hz+ pointer events to ~60fps.
      pendingDateRef.current = newDate;
      if (!rafRef.current) {
        rafRef.current = requestAnimationFrame(() => {
          const date = pendingDateRef.current;
          if (date) {
            dispatchTick(date);
            updateTimelineSettings({ currentDate: date });
            pendingDateRef.current = null;
          }
          rafRef.current = 0;
        });
      }
    },
    [timelineMinDay, updateTimelineSettings, dispatchTick]
  );

  const onPointerDown = useCallback(
    (e: React.PointerEvent) => {
      isDraggingRef.current = true;
      (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
      applyIndex(indexFromPointer(e.clientX));
      if (isPlaying) updateTimelineSettings({ isPlaying: false });
    },
    [applyIndex, indexFromPointer, isPlaying, updateTimelineSettings]
  );

  const onPointerMove = useCallback(
    (e: React.PointerEvent) => {
      if (!isDraggingRef.current) return;
      applyIndex(indexFromPointer(e.clientX));
    },
    [applyIndex, indexFromPointer]
  );

  const onPointerUp = useCallback(() => {
    isDraggingRef.current = false;
    // Cancel any pending RAF and flush synchronously so final position is exact
    if (rafRef.current) {
      cancelAnimationFrame(rafRef.current);
      rafRef.current = 0;
    }
    if (pendingDateRef.current) {
      flushTick(pendingDateRef.current);
      updateTimelineSettings({ currentDate: pendingDateRef.current });
      pendingDateRef.current = null;
    }
  }, [updateTimelineSettings, flushTick]);

  // Play / pause
  const handlePlayPause = useCallback(() => {
    if (isPlaying) {
      updateTimelineSettings({ isPlaying: false });
    } else {
      if (clampedIndex >= maxIndex) {
        // Reset to visible start
        const startDate = dayIndexToDate(visibleStartIndex, timelineMinDay);
        updateTimelineSettings({ isPlaying: true, currentDate: startDate });
        flushTick(startDate);
      } else {
        updateTimelineSettings({ isPlaying: true });
      }
    }
  }, [isPlaying, clampedIndex, maxIndex, visibleStartIndex, timelineMinDay, updateTimelineSettings, flushTick]);

  // Speed cycle (desktop only)
  const handleSpeedCycle = useCallback(() => {
    const speeds = [7, 14, 28, 45];
    const idx = speeds.indexOf(playSpeed);
    const next = speeds[(idx + 1) % speeds.length];
    updateTimelineSettings({ playSpeed: next });
  }, [playSpeed, updateTimelineSettings]);

  const dateLabel = formatDateFixed(dayIndexToDate(clampedIndex, timelineMinDay));

  return (
    <div className="flex items-center gap-2 lg:gap-3 h-full px-3 lg:px-4 select-none">
      {/* Play / Pause */}
      <button
        onClick={handlePlayPause}
        className="flex-shrink-0 flex items-center justify-center w-8 h-8 rounded-full bg-white/10 hover:bg-white/15 active:bg-white/20 transition-colors"
        aria-label={isPlaying ? 'Pause' : 'Play'}
      >
        {isPlaying ? (
          <Pause className="w-3.5 h-3.5 text-white/90" />
        ) : (
          <Play className="w-3.5 h-3.5 text-white/90 ml-px" />
        )}
      </button>

      {/* Sparkline + Scrubber */}
      <div
        ref={trackRef}
        className="flex-1 h-8 lg:h-9 relative cursor-pointer"
        style={{ touchAction: 'none' }}
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={onPointerUp}
      >
        <TimelineSparkline path={sparklinePath} progressPercent={progressPercent} />

        {/* Scrubber handle */}
        <div
          className="absolute top-0 bottom-0 w-px bg-accent/80 pointer-events-none"
          style={{ left: `${progressPercent}%` }}
        >
          <div className="absolute -bottom-0.5 left-1/2 -translate-x-1/2 w-2 h-2 rounded-full bg-accent" />
        </div>
      </div>

      {/* Date · count — single flat line, fixed width to prevent shifting */}
      <span className="flex-shrink-0 text-xs lg:text-sm text-white/90 tabular-nums font-mono tracking-tight whitespace-nowrap w-[90px] lg:w-[180px] text-right">
        {dateLabel}
        <span className="hidden lg:inline text-white/30"> · {cumulativeCount.toLocaleString()}</span>
      </span>

      {/* Speed button — desktop only */}
      <button
        onClick={handleSpeedCycle}
        className="hidden lg:inline-flex flex-shrink-0 items-center justify-center px-2 py-1 rounded-md bg-white/8 hover:bg-white/12 active:bg-white/16 border border-white/[0.06] text-xs font-medium text-white/50 hover:text-white/70 transition-colors tabular-nums"
      >
        {playSpeed}d/s
      </button>
    </div>
  );
}
