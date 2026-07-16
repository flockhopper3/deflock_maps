import { useCallback, useEffect, useRef } from 'react';
import { useAppModeStore } from '../../store/appModeStore';
import { dayIndexToDate } from './timelineUtils';
import type { TimelineTicker } from './useTimelineTicker';

interface TimelineScrubberArgs {
  trackRef: React.RefObject<HTMLDivElement>;
  timelineMinDay: string;
  visibleStartIndex: number;
  maxIndex: number;
  currentIndex: number;
  ticker: TimelineTicker;
}

/** Days moved per arrow key press, and per shift+arrow. */
const STEP_DAY = 1;
const STEP_WEEK = 7;
const STEP_PAGE = 30;

/**
 * Pointer and keyboard input for the timeline scrubber.
 *
 * Pointer drags coalesce into one RAF so the map filter and React state land in
 * the same frame, which throttles 120Hz+ pointer streams to ~60fps.
 */
export function useTimelineScrubber({
  trackRef,
  timelineMinDay,
  visibleStartIndex,
  maxIndex,
  currentIndex,
  ticker,
}: TimelineScrubberArgs) {
  const { dispatchTick, flushTick } = ticker;

  const isDraggingRef = useRef(false);
  const pendingDateRef = useRef<string | null>(null);
  const rafRef = useRef(0);

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
      if (rect.width === 0) return visibleStartIndex;
      const ratio = Math.max(0, Math.min(1, (clientX - rect.left) / rect.width));
      return Math.round(visibleStartIndex + ratio * (maxIndex - visibleStartIndex));
    },
    [trackRef, visibleStartIndex, maxIndex]
  );

  const applyIndex = useCallback(
    (index: number) => {
      const clamped = Math.max(visibleStartIndex, Math.min(index, maxIndex));
      const newDate = dayIndexToDate(clamped, timelineMinDay);

      // Coalesce map filter + React state into a single RAF so both happen in
      // the same frame.
      pendingDateRef.current = newDate;
      if (!rafRef.current) {
        rafRef.current = requestAnimationFrame(() => {
          const date = pendingDateRef.current;
          if (date) {
            dispatchTick(date);
            useAppModeStore.getState().updateTimelineSettings({ currentDate: date });
            pendingDateRef.current = null;
          }
          rafRef.current = 0;
        });
      }
    },
    [timelineMinDay, visibleStartIndex, maxIndex, dispatchTick]
  );

  const pauseIfPlaying = useCallback(() => {
    const { timelineSettings, updateTimelineSettings } = useAppModeStore.getState();
    if (timelineSettings.isPlaying) updateTimelineSettings({ isPlaying: false });
  }, []);

  /**
   * Ends a drag from any terminal path — pointerup, pointercancel, or lost
   * capture. Without the cancel paths an interrupted touch left isDragging true
   * and the track kept scrubbing with no button held.
   */
  const endDrag = useCallback(() => {
    if (!isDraggingRef.current) return;
    isDraggingRef.current = false;

    // Cancel the pending RAF and flush synchronously so the final position is exact
    if (rafRef.current) {
      cancelAnimationFrame(rafRef.current);
      rafRef.current = 0;
    }
    if (pendingDateRef.current) {
      flushTick(pendingDateRef.current);
      useAppModeStore.getState().updateTimelineSettings({ currentDate: pendingDateRef.current });
      pendingDateRef.current = null;
    }
  }, [flushTick]);

  const onPointerDown = useCallback(
    (e: React.PointerEvent) => {
      isDraggingRef.current = true;
      (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
      applyIndex(indexFromPointer(e.clientX));
      pauseIfPlaying();
    },
    [applyIndex, indexFromPointer, pauseIfPlaying]
  );

  const onPointerMove = useCallback(
    (e: React.PointerEvent) => {
      if (!isDraggingRef.current) return;
      applyIndex(indexFromPointer(e.clientX));
    },
    [applyIndex, indexFromPointer]
  );

  const onKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      let next: number;
      switch (e.key) {
        case 'ArrowLeft':
        case 'ArrowDown':
          next = currentIndex - (e.shiftKey ? STEP_WEEK : STEP_DAY);
          break;
        case 'ArrowRight':
        case 'ArrowUp':
          next = currentIndex + (e.shiftKey ? STEP_WEEK : STEP_DAY);
          break;
        case 'PageDown':
          next = currentIndex - STEP_PAGE;
          break;
        case 'PageUp':
          next = currentIndex + STEP_PAGE;
          break;
        case 'Home':
          next = visibleStartIndex;
          break;
        case 'End':
          next = maxIndex;
          break;
        default:
          return;
      }
      e.preventDefault();
      pauseIfPlaying();
      applyIndex(next);
    },
    [currentIndex, visibleStartIndex, maxIndex, applyIndex, pauseIfPlaying]
  );

  return {
    onPointerDown,
    onPointerMove,
    onPointerUp: endDrag,
    onPointerCancel: endDrag,
    onLostPointerCapture: endDrag,
    onKeyDown,
  };
}
