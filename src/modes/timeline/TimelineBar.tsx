import { useCallback, useEffect, useMemo, useRef } from 'react';
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
import { useTimelineScrubber } from './useTimelineScrubber';

export function TimelineBar({ bare = false, showCount = false }: { bare?: boolean; showCount?: boolean } = {}) {
  const cameraCount = useCameraStore((s) => s.cameras.length);
  const timelineMinDay = useCameraStore((s) => s.timelineMinDay);
  const timelineMaxDay = useCameraStore((s) => s.timelineMaxDay);
  const timelineDailyCounts = useCameraStore((s) => s.timelineDailyCounts);
  const timelineWeeklyCounts = useCameraStore((s) => s.timelineWeeklyCounts);
  const timelineMinWeek = useCameraStore((s) => s.timelineMinWeek);
  const timelineMaxWeek = useCameraStore((s) => s.timelineMaxWeek);

  const currentDate = useAppModeStore((s) => s.timelineSettings.currentDate);
  const isPlaying = useAppModeStore((s) => s.timelineSettings.isPlaying);
  const playSpeed = useAppModeStore((s) => s.timelineSettings.playSpeed);
  const updateTimelineSettings = useAppModeStore((s) => s.updateTimelineSettings);

  const maxIndex = totalDays(timelineMinDay, timelineMaxDay);
  const currentIndex = dateToDayIndex(currentDate, timelineMinDay);
  const clampedIndex = Math.max(0, Math.min(currentIndex, maxIndex));

  const ticker = useTimelineTicker({ timelineMinDay, maxIndex, isPlaying, playSpeed });
  const { flushTick } = ticker;

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
    const noTimestampCount = cameraCount - totalWithTimestamps;
    return countUpToDate + noTimestampCount;
  }, [clampedIndex, cumulativePrefixSum, cameraCount]);

  const trackRef = useRef<HTMLDivElement>(null);
  const scrubber = useTimelineScrubber({
    trackRef,
    timelineMinDay,
    visibleStartIndex,
    maxIndex,
    currentIndex: clampedIndex,
    ticker,
  });

  // Bind the scrubber's pointer handlers natively (ref + addEventListener)
  // instead of as onPointer* JSX props. When TimelineBar renders `bare`
  // inside the drawer peek, StopSheetDrag (an ancestor) calls native
  // stopPropagation() on 'pointerdown' so the BottomSheet's own native drag
  // listener (on the header, further out) never sees it. React's synthetic
  // dispatch relies on that same event bubbling all the way to the app
  // root — also further out than StopSheetDrag — so a plain onPointerDown
  // prop here would silently stop firing too. A listener attached directly
  // on the track fires at the target, before any ancestor's later
  // stopPropagation call, so it keeps working regardless.
  useEffect(() => {
    const el = trackRef.current;
    if (!el) return;
    const onDown = scrubber.onPointerDown as unknown as (e: PointerEvent) => void;
    const onMove = scrubber.onPointerMove as unknown as (e: PointerEvent) => void;
    const onUp = scrubber.onPointerUp as unknown as (e: PointerEvent) => void;
    const onCancel = scrubber.onPointerCancel as unknown as (e: PointerEvent) => void;
    const onLost = scrubber.onLostPointerCapture as unknown as (e: PointerEvent) => void;
    el.addEventListener('pointerdown', onDown);
    el.addEventListener('pointermove', onMove);
    el.addEventListener('pointerup', onUp);
    el.addEventListener('pointercancel', onCancel);
    el.addEventListener('lostpointercapture', onLost);
    return () => {
      el.removeEventListener('pointerdown', onDown);
      el.removeEventListener('pointermove', onMove);
      el.removeEventListener('pointerup', onUp);
      el.removeEventListener('pointercancel', onCancel);
      el.removeEventListener('lostpointercapture', onLost);
    };
  }, [scrubber.onPointerDown, scrubber.onPointerMove, scrubber.onPointerUp, scrubber.onPointerCancel, scrubber.onLostPointerCapture]);

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
    <div className={`flex items-center gap-2 lg:gap-3 h-full select-none ${bare ? '' : 'px-3 lg:px-4'}`}>
      {/* Play / Pause */}
      <button
        onClick={handlePlayPause}
        className="flex-shrink-0 flex items-center justify-center w-11 h-11 lg:w-8 lg:h-8 rounded-full bg-white/10 hover:bg-white/15 active:bg-white/20 transition-colors"
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
        role="slider"
        tabIndex={0}
        aria-label="Timeline date"
        aria-valuemin={visibleStartIndex}
        aria-valuemax={maxIndex}
        aria-valuenow={clampedIndex}
        aria-valuetext={dateLabel}
        className="flex-1 h-8 lg:h-9 relative cursor-pointer rounded-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent/70"
        style={{ touchAction: 'none' }}
        onKeyDown={scrubber.onKeyDown}
      >
        <TimelineSparkline path={sparklinePath} progressPercent={progressPercent} />

        {/* Scrubber handle */}
        <div
          className="absolute top-0 bottom-0 w-px bg-accent/80 pointer-events-none"
          style={{ left: `${progressPercent}%` }}
        >
          <div className="absolute -bottom-0.5 left-1/2 -translate-x-1/2 w-2.5 h-2.5 rounded-full bg-accent" />
        </div>
      </div>

      {/* Date · count — fixed width to prevent shifting as the date changes */}
      <span className={`flex-shrink-0 text-[11px] sm:text-xs lg:text-sm text-white/90 tabular-nums font-mono tracking-tight whitespace-nowrap text-right ${showCount ? 'w-[150px]' : 'w-[84px] sm:w-[92px]'} lg:w-[180px]`}>
        {dateLabel}
        <span className={`${showCount ? 'inline' : 'hidden lg:inline'} text-white/30`}> · {cumulativeCount.toLocaleString()}</span>
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
