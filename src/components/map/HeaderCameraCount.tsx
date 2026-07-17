import { useMemo } from 'react';
import { useCameraStore, useMapStore } from '../../store';

/**
 * Live "N in view" count, isolated in its own component so per-pan bounds
 * updates re-render only this span — not the page that hosts it.
 */
export function HeaderCameraCount({ className = '' }: { className?: string }) {
  const bounds = useMapStore(s => s.bounds);
  const getCamerasInBounds = useCameraStore(s => s.getCamerasInBounds);
  const isLoading = useCameraStore(s => s.isLoading);
  const filteredCameras = useCameraStore(s => s.filteredCameras);
  const filters = useCameraStore(s => s.filters);

  const hasActiveFilters =
    filters.brands.length + filters.operators.length +
    filters.surveillanceZones.length + filters.mountTypes.length > 0;

  // Only built when filters are active, so the per-pan cost stays a grid lookup
  const filteredIdSet = useMemo(
    () => (hasActiveFilters ? new Set(filteredCameras.map(c => c.osmId)) : null),
    [hasActiveFilters, filteredCameras]
  );

  const count = useMemo(() => {
    if (!bounds) return 0;
    const inView = getCamerasInBounds(bounds.north, bounds.south, bounds.east, bounds.west);
    if (!filteredIdSet) return inView.length;
    let n = 0;
    for (const cam of inView) if (filteredIdSet.has(cam.osmId)) n++;
    return n;
  }, [bounds, getCamerasInBounds, filteredIdSet]);

  if (isLoading) {
    return <span className={`text-xs text-dark-400 ${className}`}>Loading…</span>;
  }
  return (
    <span className={`text-xs text-dark-400 ${className}`}>
      <span className="text-dark-200 font-semibold tabular-nums">{count.toLocaleString()}</span> in view
    </span>
  );
}
