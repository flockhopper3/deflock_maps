import { useMemo } from 'react';
import { useNetworkStore } from '../../store/networkStore';
import { useMapStore } from '../../store';

export function NetworkAgencyCount() {
  const nodesArray = useNetworkStore(s => s.nodesArray);
  const typeFilter = useNetworkStore(s => s.typeFilter);
  const portalOnly = useNetworkStore(s => s.portalOnly);
  const loadPhase = useNetworkStore(s => s.loadPhase);
  const bounds = useMapStore(s => s.bounds);

  const count = useMemo(() => {
    if (!bounds) return 0;
    let total = 0;
    for (const node of nodesArray) {
      if (typeFilter.size > 0 && !typeFilter.has(node.type)) continue;
      if (portalOnly && !node.isPortal) continue;
      const [lng, lat] = node.coordinates;
      if (lat >= bounds.south && lat <= bounds.north && lng >= bounds.west && lng <= bounds.east) {
        total++;
      }
    }
    return total;
  }, [nodesArray, bounds, typeFilter, portalOnly]);

  const isLoading = loadPhase === 'fetching';

  return (
    <div className="hidden lg:block absolute top-4 right-4 z-40">
      <div className="bg-dark-800/90 rounded-md px-3 py-2 border border-dark-600">
        <div className="flex items-center gap-4">
          <div className="relative">
            {isLoading ? (
              <div className="w-4 h-4 border-2 border-dark-600 border-t-blue-500 rounded-full animate-spin" />
            ) : (
              <div className="w-3.5 h-3.5 rounded-full bg-blue-500 shadow-[0_0_12px_rgba(59,130,246,0.6)]" />
            )}
          </div>
          <div className="flex-1">
            {isLoading ? (
              <span className="text-lg font-display font-medium text-dark-300">Loading...</span>
            ) : (
              <div className="flex items-baseline gap-2">
                <span className="text-2xl font-display font-bold text-white tabular-nums min-w-[60px]">
                  {count.toLocaleString()}
                </span>
                <span className="text-sm text-dark-200">agencies in view</span>
              </div>
            )}
          </div>
        </div>
        <div className="mt-3 pt-3 border-t border-dark-700/50 flex items-center justify-between">
          <span className="text-xs text-dark-200">Total agencies</span>
          <span className="text-sm font-medium text-dark-100 tabular-nums">
            {isLoading ? <span className="text-dark-400">&mdash;</span> : nodesArray.length.toLocaleString()}
          </span>
        </div>
      </div>
    </div>
  );
}
