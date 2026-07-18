import { describe, it, expect, beforeEach } from 'vitest';
import { useAppModeStore } from './appModeStore';
import { TIMELINE_START } from '../modes/timeline/timelineUtils';

beforeEach(() => {
  useAppModeStore.setState({
    appMode: 'map',
    mapVisualization: 'heatmap',
    timelineSettings: { currentDate: '2025-01-01', isPlaying: true, playSpeed: 14 },
  });
});

describe('enterTimeline', () => {
  it('enters explore at the timeline start with playback stopped', () => {
    useAppModeStore.getState().enterTimeline();
    const s = useAppModeStore.getState();
    expect(s.appMode).toBe('explore');
    expect(s.mapVisualization).toBe('dots');
    expect(s.timelineSettings).toEqual({
      currentDate: TIMELINE_START,
      isPlaying: false,
      playSpeed: 45,
    });
  });

  it('honors an explicit visualization', () => {
    useAppModeStore.getState().enterTimeline('heatmap');
    expect(useAppModeStore.getState().mapVisualization).toBe('heatmap');
  });
});

describe('setAppMode', () => {
  it('sets the mode, stops playback, and preserves the scrubbed date', () => {
    useAppModeStore.getState().setAppMode('route');
    const s = useAppModeStore.getState();
    expect(s.appMode).toBe('route');
    expect(s.timelineSettings.currentDate).toBe('2025-01-01');
    expect(s.timelineSettings.isPlaying).toBe(false);
    expect(s.timelineSettings.playSpeed).toBe(14);
  });
});
