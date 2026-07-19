import { useCameraStore } from '@/store';
import { StatusPill } from '@/components/common/StatusPill';

interface CameraTileStatusPillProps {
  /** Remount-based retry for the camera tile source (from MapPage). */
  onRetryTiles: () => void;
}

/**
 * Non-blocking failure pill for the map/route views. Those views never load
 * GeoJSON, so a camera-tile or filter-tile failure surfaces here as a
 * tap-to-retry pill rather than a blank map or a full-screen error.
 * Precedence: a full camera-tile failure wins over a filter-only failure —
 * if no cameras load at all, the filter notice is moot.
 */
export function CameraTileStatusPill({ onRetryTiles }: CameraTileStatusPillProps) {
  const tilesFailed = useCameraStore(s => s.tilesFailed);
  const filterTilesFailed = useCameraStore(s => s.filterTilesFailed);
  const manifestPhase = useCameraStore(s => s.manifestPhase);
  const filtersActive = useCameraStore(s => !s.filters.showAll);
  const retryFilterTiles = useCameraStore(s => s.retryFilterTiles);

  if (tilesFailed) {
    return (
      <StatusPill
        loading={false}
        text=""
        error="Camera layer unavailable. Tap to retry."
        onRetry={onRetryTiles}
      />
    );
  }

  if (filtersActive && (filterTilesFailed || manifestPhase === 'error')) {
    return (
      <StatusPill
        loading={false}
        text=""
        error="Filters unavailable. Showing all cameras. Tap to retry."
        onRetry={retryFilterTiles}
      />
    );
  }

  return null;
}
