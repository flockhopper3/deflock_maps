import { useEffect, useState } from 'react';
import { useCameraStore } from '@/store';
import { useDelayedFlag } from '@/hooks/useDelayedFlag';
import { PILL_BASE } from './StatusPill';

/**
 * Non-blocking indicator for the lazy camera GeoJSON download, floating over
 * the map. Used when no side panel is visible to host a skeleton (mobile,
 * collapsed panel, heatmap/filter loads). Shows a determinate percent when
 * the transfer size is known, an error pill with retry on failure, and a
 * brief "N cameras ready" flash on completion.
 */
export function LoadingPill() {
  const loadPhase = useCameraStore(s => s.loadPhase);
  const downloadProgress = useCameraStore(s => s.downloadProgress);
  const error = useCameraStore(s => s.error);
  const retryCameraLoad = useCameraStore(s => s.retryCameraLoad);
  const cameraCount = useCameraStore(s => s.cameras.length);

  const isLoading = loadPhase === 'fetching' || loadPhase === 'hydrating';
  const showLoading = useDelayedFlag(isLoading);

  // Flash "ready" only when this pill actually showed a loading state —
  // instant loads (delayed flag never fired) come and go silently.
  const [sawLoading, setSawLoading] = useState(false);
  const [flashReady, setFlashReady] = useState(false);

  useEffect(() => {
    if (showLoading) setSawLoading(true);
  }, [showLoading]);

  useEffect(() => {
    if (sawLoading && loadPhase === 'ready') {
      setFlashReady(true);
      const timer = setTimeout(() => {
        setFlashReady(false);
        setSawLoading(false);
      }, 1400);
      return () => clearTimeout(timer);
    }
  }, [sawLoading, loadPhase]);

  if (loadPhase === 'error' && error) {
    return (
      <button
        role="status"
        onClick={() => {
          // store owns the error state
          retryCameraLoad().catch(() => {});
        }}
        className={`${PILL_BASE} border border-danger/40 hover:border-danger transition-colors`}
      >
        <span className="w-2 h-2 rounded-full bg-danger shrink-0" />
        Couldn't load camera details — tap to retry
      </button>
    );
  }

  if (flashReady) {
    return (
      <div className={`${PILL_BASE} border border-hairline`} role="status">
        <span className="w-2 h-2 rounded-full bg-success shrink-0" />
        {cameraCount.toLocaleString()} cameras ready
      </div>
    );
  }

  if (!showLoading) return null;

  return (
    <div className={`${PILL_BASE} border border-hairline`} role="status" aria-live="polite">
      <span className="w-3.5 h-3.5 border-2 border-dark-600 border-t-accent rounded-full animate-spin shrink-0" />
      {loadPhase === 'hydrating' ? 'Preparing cameras…' : 'Loading camera details…'}
      {downloadProgress != null && loadPhase === 'fetching' && (
        <span className="text-xs text-dark-300 tabular-nums">{downloadProgress}%</span>
      )}
    </div>
  );
}
