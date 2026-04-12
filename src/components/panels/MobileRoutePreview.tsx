import { useRouteStore } from '../../store';
import { formatDistance, formatDuration } from '../../utils/geo';

interface MobileRoutePreviewProps {
  /** Whether routes have been calculated */
  hasRoutes: boolean;
  /** Callback when user taps to expand */
  onExpand?: () => void;
}

/**
 * Compact route preview shown in the bottom sheet header on mobile.
 * Shows a summary of the route comparison when routes exist,
 * or a prompt to enter destination when they don't.
 */
export function MobileRoutePreview({ hasRoutes, onExpand }: MobileRoutePreviewProps) {
  const {
    normalRoute,
    avoidanceRoute,
    comparison,
    activeRoute,
    isCalculating,
  } = useRouteStore();

  // Loading state
  if (isCalculating) {
    return (
      <div className="flex items-center gap-3 py-1">
        <div className="w-10 h-10 rounded-xl bg-dark-700 flex items-center justify-center">
          <div className="w-5 h-5 border-2 border-accent border-t-transparent rounded-full animate-spin" />
        </div>
        <div>
          <p className="text-sm font-medium text-white">Analyzing route...</p>
          <p className="text-xs text-dark-400">Finding camera-free paths</p>
        </div>
      </div>
    );
  }

  // No routes yet - nothing to preview
  if (!hasRoutes || !normalRoute || !avoidanceRoute || !comparison) {
    return null;
  }

  // Show route comparison summary
  const normalCameras = comparison.normalCameras.length;
  const avoidanceCameras = comparison.avoidanceCameras.length;
  const camerasAvoided = normalCameras - avoidanceCameras;
  const isPrivacyRoute = activeRoute === 'avoidance';
  const activeRouteData = isPrivacyRoute ? avoidanceRoute : normalRoute;

  return (
    <button
      onClick={onExpand}
      className="w-full flex items-center justify-between py-1"
    >
      <div className="flex items-center gap-3 min-w-0">
        {/* Route indicator */}
        <div className={`w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0 ${
          isPrivacyRoute
            ? 'bg-blue-500/20 border border-blue-500/30'
            : 'bg-orange-500/20 border border-orange-500/30'
        }`}>
          {isPrivacyRoute ? (
            <svg className="w-5 h-5 text-blue-400" viewBox="0 0 24 24" fill="currentColor">
              <path d="M12 1L3 5v6c0 5.55 3.84 10.74 9 12 5.16-1.26 9-6.45 9-12V5l-9-4z"/>
            </svg>
          ) : (
            <svg className="w-5 h-5 text-orange-400" viewBox="0 0 24 24" fill="currentColor">
              <path d="M21.71 11.29l-9-9a.996.996 0 00-1.41 0l-9 9a.996.996 0 000 1.41l9 9c.39.39 1.02.39 1.41 0l9-9a.996.996 0 000-1.41zM14 14.5V12h-4v3H8v-4c0-.55.45-1 1-1h5V7.5l3.5 3.5-3.5 3.5z" />
            </svg>
          )}
        </div>

        {/* Route info */}
        <div className="text-left min-w-0">
          <div className="flex items-center gap-2">
            <p className="text-sm font-semibold text-white truncate">
              {isPrivacyRoute ? 'Privacy Route' : 'Direct Route'}
            </p>
            {isPrivacyRoute && camerasAvoided > 0 && (
              <span className="text-xs font-medium text-success bg-success/20 px-1.5 py-0.5 rounded">
                -{camerasAvoided} cam
              </span>
            )}
          </div>
          <p className="text-xs text-dark-400">
            {formatDistance(activeRouteData.distanceMeters)} · {formatDuration(activeRouteData.durationSeconds)}
            {isPrivacyRoute ? ` · ${avoidanceCameras} cameras` : ` · ${normalCameras} cameras`}
          </p>
        </div>
      </div>

      {/* Expand hint */}
      <div className="flex items-center gap-1 text-dark-400 flex-shrink-0 ml-2">
        <span className="text-xs hidden xs:inline">Details</span>
        <svg className="w-5 h-5" viewBox="0 0 24 24" fill="currentColor">
          <path d="M7.41 15.41L12 10.83l4.59 4.58L18 14l-6-6-6 6z" />
        </svg>
      </div>
    </button>
  );
}
