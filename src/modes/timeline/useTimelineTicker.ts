import { useCallback, useEffect, useRef } from 'react';
import { useMapStore } from '../../store/mapStore';
import { useAppModeStore } from '../../store/appModeStore';
import { dateToDayIndex, dayIndexToDate } from './timelineUtils';

/**
 * Map filter updates are throttled to ~12fps while the UI stays at 60fps.
 * Every setFilter drives a render cycle across 71 Protomaps vector layers, so
 * this ceiling is load-bearing on low-end devices — do not raise it casually.
 */
const TICK_THROTTLE_MS = 80;

export interface TimelineTicker {
  /** Throttled — for continuous updates (drag, playback) */
  dispatchTick: (date: string) => void;
  /**
   * Immediate — for exact final positions. Drops any pending throttled tick,
   * so callers never need to clear the throttle themselves.
   */
  flushTick: (date: string) => void;
}

interface TimelineTickerArgs {
  timelineMinDay: string;
  maxIndex: number;
  isPlaying: boolean;
  playSpeed: number;
}

/**
 * Owns the throttled tick dispatch and the RAF playback loop. They live together
 * because playback dispatches through the same throttle state that scrubbing does.
 */
export function useTimelineTicker({
  timelineMinDay,
  maxIndex,
  isPlaying,
  playSpeed,
}: TimelineTickerArgs): TimelineTicker {
  const tickCallback = useMapStore((s) => s._timelineTickCallback);

  const lastTickTimeRef = useRef(0);
  const pendingDateRef = useRef<string | null>(null);
  const flushTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const clearThrottle = useCallback(() => {
    pendingDateRef.current = null;
    if (flushTimerRef.current) {
      clearTimeout(flushTimerRef.current);
      flushTimerRef.current = null;
    }
  }, []);

  const dispatchTick = useCallback(
    (date: string) => {
      const now = performance.now();
      const elapsed = now - lastTickTimeRef.current;

      if (elapsed >= TICK_THROTTLE_MS) {
        // Enough time has passed — fire immediately
        lastTickTimeRef.current = now;
        clearThrottle();
        tickCallback?.(date);
        return;
      }

      // Too soon — store pending and schedule a flush
      pendingDateRef.current = date;
      if (!flushTimerRef.current) {
        flushTimerRef.current = setTimeout(() => {
          flushTimerRef.current = null;
          if (pendingDateRef.current) {
            lastTickTimeRef.current = performance.now();
            tickCallback?.(pendingDateRef.current);
            pendingDateRef.current = null;
          }
        }, TICK_THROTTLE_MS - elapsed);
      }
    },
    [tickCallback, clearThrottle]
  );

  const flushTick = useCallback(
    (date: string) => {
      clearThrottle();
      lastTickTimeRef.current = performance.now();
      tickCallback?.(date);
    },
    [tickCallback, clearThrottle]
  );

  useEffect(() => clearThrottle, [clearThrottle]);

  // Playback loop
  useEffect(() => {
    if (!isPlaying) return;

    const msPerTick = 1000 / playSpeed;
    let lastTickTime = -1; // -1 = uninitialized, set on first frame
    let rafId: number;

    const tick = (timestamp: number) => {
      // Initialize on first frame to avoid a giant elapsed delta
      if (lastTickTime < 0) {
        lastTickTime = timestamp;
        rafId = requestAnimationFrame(tick);
        return;
      }

      const elapsed = timestamp - lastTickTime;
      if (elapsed >= msPerTick) {
        // Allow multi-day jumps when frames are slow (e.g. tab backgrounded)
        const daysToAdvance = Math.floor(elapsed / msPerTick);
        // Accumulate rather than assign — preserves fractional remainder
        lastTickTime += daysToAdvance * msPerTick;

        const { timelineSettings, updateTimelineSettings } = useAppModeStore.getState();
        const current = dateToDayIndex(timelineSettings.currentDate, timelineMinDay);
        const nextIndex = Math.min(current + daysToAdvance, maxIndex);

        if (nextIndex >= maxIndex) {
          const finalDate = dayIndexToDate(maxIndex, timelineMinDay);
          updateTimelineSettings({ currentDate: finalDate, isPlaying: false });
          flushTick(finalDate);
          return;
        }

        const nextDate = dayIndexToDate(nextIndex, timelineMinDay);
        updateTimelineSettings({ currentDate: nextDate });
        dispatchTick(nextDate);
      }

      rafId = requestAnimationFrame(tick);
    };

    rafId = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(rafId);
  }, [isPlaying, playSpeed, timelineMinDay, maxIndex, dispatchTick, flushTick]);

  return { dispatchTick, flushTick };
}
