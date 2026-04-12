import type { RouteComparison as RouteComparisonType } from '../../types';
import { formatDistance, formatDuration } from '../../utils/geo';
import { formatPercent } from '../../utils/formatting';

interface RouteComparisonProps {
  comparison: RouteComparisonType;
  activeRoute: 'normal' | 'avoidance';
  onSelectRoute: (type: 'normal' | 'avoidance') => void;
  normalDistance: number;
  normalDuration: number;
  avoidanceDistance: number;
  avoidanceDuration: number;
}

export function RouteComparisonPanel({
  comparison,
  activeRoute,
  onSelectRoute,
  normalDistance,
  normalDuration,
  avoidanceDistance,
  avoidanceDuration,
}: RouteComparisonProps) {
  const normalCameraCount = comparison.normalCameras.length;
  const avoidanceCameraCount = comparison.avoidanceCameras.length;
  const cameraReduction = normalCameraCount > 0 
    ? Math.round(((normalCameraCount - avoidanceCameraCount) / normalCameraCount) * 100)
    : 0;

  return (
    <div className="bg-dark-700 rounded-xl border border-dark-500 overflow-hidden">
      <div className="p-4 border-b border-dark-500">
        <h3 className="text-sm font-semibold text-dark-100">Route Comparison</h3>
      </div>

      <div className="grid grid-cols-2 divide-x divide-dark-500">
        {/* Normal Route */}
        <button
          onClick={() => onSelectRoute('normal')}
          aria-label="Select direct route"
          aria-selected={activeRoute === 'normal'}
          className={`p-4 text-left transition-colors ${
            activeRoute === 'normal'
              ? 'bg-orange-500/10 border-l-2 border-orange-500'
              : 'hover:bg-dark-600'
          }`}
        >
          <div className="flex items-center gap-2 mb-3">
            <div className="w-6 h-1 rounded-full bg-orange-500" style={{backgroundImage: 'repeating-linear-gradient(90deg, #e5a04d 0, #e5a04d 3px, transparent 3px, transparent 5px)'}}></div>
            <span className="text-xs font-semibold text-dark-200 uppercase tracking-wider">
              Direct
            </span>
          </div>
          
          <div className="space-y-2">
            <div>
              <div className="text-lg font-bold text-dark-100">
                {formatDistance(normalDistance)}
              </div>
              <div className="text-xs text-dark-400">
                {formatDuration(normalDuration)}
              </div>
            </div>
            
            <div className="flex items-center gap-1.5">
              <svg className="w-4 h-4 text-accent" viewBox="0 0 24 24" fill="currentColor">
                <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm0 3c1.66 0 3 1.34 3 3s-1.34 3-3 3-3-1.34-3-3 1.34-3 3-3z"/>
              </svg>
              <span className="text-sm font-semibold text-accent">
                {normalCameraCount} camera{normalCameraCount !== 1 ? 's' : ''}
              </span>
            </div>
          </div>
        </button>

        {/* Avoidance Route */}
        <button
          onClick={() => onSelectRoute('avoidance')}
          aria-label="Select privacy route"
          aria-selected={activeRoute === 'avoidance'}
          className={`p-4 text-left transition-colors ${
            activeRoute === 'avoidance'
              ? 'bg-blue-500/10 border-l-2 border-blue-500'
              : 'hover:bg-dark-600'
          }`}
        >
          <div className="flex items-center gap-2 mb-3">
            <div className="w-6 h-1 rounded-full bg-blue-500"></div>
            <span className="text-xs font-semibold text-dark-200 uppercase tracking-wider">
              Privacy
            </span>
          </div>
          
          <div className="space-y-2">
            <div>
              <div className="text-lg font-bold text-dark-100">
                {formatDistance(avoidanceDistance)}
              </div>
              <div className="text-xs text-dark-400">
                {formatDuration(avoidanceDuration)}
                {comparison.durationIncreasePercent > 0 && (
                  <span className="text-route-direct ml-1">
                    ({formatPercent(comparison.durationIncreasePercent)})
                  </span>
                )}
              </div>
            </div>
            
            <div className="flex items-center gap-1.5">
              <svg className="w-4 h-4 text-accent" viewBox="0 0 24 24" fill="currentColor">
                <path d="M9 16.17L4.83 12l-1.42 1.41L9 19 21 7l-1.41-1.41z"/>
              </svg>
              <span className="text-sm font-semibold text-accent">
                {avoidanceCameraCount} camera{avoidanceCameraCount !== 1 ? 's' : ''}
              </span>
            </div>
          </div>
        </button>
      </div>

      {/* Summary */}
      {normalCameraCount > avoidanceCameraCount && (
        <div className="p-4 bg-accent/5 border-t border-dark-500">
          <div className="flex items-center gap-2">
            <svg className="w-5 h-5 text-accent" viewBox="0 0 24 24" fill="currentColor">
              <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm-2 15l-5-5 1.41-1.41L10 14.17l7.59-7.59L19 8l-9 9z"/>
            </svg>
            <span className="text-sm text-dark-100">
              <span className="font-bold text-accent">{cameraReduction}% fewer</span> cameras by adding{' '}
              <span className="font-semibold">
                {formatDistance(comparison.distanceIncrease)}
              </span>
            </span>
          </div>
        </div>
      )}
    </div>
  );
}

