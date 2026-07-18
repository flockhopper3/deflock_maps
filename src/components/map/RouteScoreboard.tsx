import { useRouteStore } from '../../store';
import { formatDistance, formatDuration } from '../../utils/geo';
import { verdictLine } from '../../utils/routeCopy';

interface RouteScoreboardProps {
  /** Switch back to the address inputs. */
  onEdit: () => void;
}

/**
 * Mobile results card. Replaces the floating search inputs once routes
 * exist so screenshots show the comparison, never the user's addresses.
 */
export function RouteScoreboard({ onEdit }: RouteScoreboardProps) {
  const { normalRoute, avoidanceRoute, comparison, activeRoute, setActiveRoute } = useRouteStore();

  if (!normalRoute || !avoidanceRoute || !comparison) return null;

  const normalCameras = comparison.normalCameras.length;
  const avoidanceCameras = comparison.avoidanceCameras.length;
  const verdict = verdictLine(normalCameras - avoidanceCameras);
  const extraMinutes = Math.round(
    (avoidanceRoute.durationSeconds - normalRoute.durationSeconds) / 60
  );

  return (
    <div className="bg-dark-900/95 border border-dark-600 rounded-xl shadow-2xl backdrop-blur-sm overflow-hidden animate-fade-in">
      <div className="flex">
        {/* Direct half */}
        <button
          onClick={() => setActiveRoute('normal')}
          type="button"
          aria-selected={activeRoute === 'normal'}
          aria-label="Show direct route"
          className={`relative flex-1 min-w-0 px-4 py-3 text-left transition-colors ${
            activeRoute === 'normal' ? 'bg-route-direct/10' : ''
          }`}
        >
          {activeRoute === 'normal' && (
            <span className="absolute inset-x-0 top-0 h-0.5 bg-route-direct" aria-hidden="true" />
          )}
          <div className="flex items-center gap-2">
            <span
              className="w-5 h-[3px] rounded-full flex-shrink-0"
              style={{ backgroundImage: 'repeating-linear-gradient(90deg, #e5a04d 0, #e5a04d 3px, transparent 3px, transparent 5px)' }}
              aria-hidden="true"
            />
            <span className="text-2xs font-semibold text-dark-400 uppercase">Direct</span>
          </div>
          <p className="font-display font-extrabold text-[2.125rem] leading-tight text-route-direct tabular-nums mt-1">
            {normalCameras}
          </p>
          <p className="text-xs text-dark-400 leading-snug">
            {normalCameras === 1 ? 'camera' : 'cameras'}
          </p>
          <p className="text-xs text-dark-400 leading-snug mt-1.5 truncate">
            <span className="font-semibold text-dark-300">{formatDuration(normalRoute.durationSeconds)}</span>
            {' · '}
            {formatDistance(normalRoute.distanceMeters)}
          </p>
        </button>

        <div className="w-px bg-hairline flex-shrink-0" aria-hidden="true" />

        {/* Privacy half */}
        <button
          onClick={() => setActiveRoute('avoidance')}
          type="button"
          aria-selected={activeRoute === 'avoidance'}
          aria-label="Show privacy route"
          className={`relative flex-1 min-w-0 px-4 py-3 text-left transition-colors ${
            activeRoute === 'avoidance' ? 'bg-route-avoid/10' : ''
          }`}
        >
          {activeRoute === 'avoidance' && (
            <span className="absolute inset-x-0 top-0 h-0.5 bg-route-avoid" aria-hidden="true" />
          )}
          <div className="flex items-center gap-2">
            <span className="w-5 h-[3px] rounded-full bg-route-avoid flex-shrink-0" aria-hidden="true" />
            <span className="text-2xs font-semibold text-dark-400 uppercase">Privacy</span>
          </div>
          <p className="font-display font-extrabold text-[2.125rem] leading-tight text-white tabular-nums mt-1">
            {avoidanceCameras}
          </p>
          <p className="text-xs text-dark-400 leading-snug">
            {avoidanceCameras === 1 ? 'camera' : 'cameras'}
          </p>
          <p className="text-xs text-dark-400 leading-snug mt-1.5 truncate">
            <span className="font-semibold text-dark-300">{formatDuration(avoidanceRoute.durationSeconds)}</span>
            {' · '}
            {formatDistance(avoidanceRoute.distanceMeters)}
            {extraMinutes > 0 && <span className="text-route-direct"> +{extraMinutes} min</span>}
          </p>
        </button>
      </div>

      {/* Verdict line */}
      {verdict && (
        <p className="border-t border-hairline px-4 py-1.5 text-center text-xs font-semibold text-success">
          {verdict}
        </p>
      )}

      {/* Footer: watermark + edit */}
      <div className="border-t border-hairline px-4 py-1.5 flex items-center justify-between">
        <span className="text-2xs text-dark-500 uppercase">maps.deflock.org</span>
        <button
          onClick={onEdit}
          type="button"
          aria-label="Edit route"
          className="flex items-center gap-1.5 py-1 -my-1 text-2xs text-dark-400 uppercase active:text-white hover:text-white transition-colors"
        >
          <svg className="w-3 h-3" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
            <path d="M3 17.25V21h3.75L17.81 9.94l-3.75-3.75L3 17.25zM20.71 7.04c.39-.39.39-1.02 0-1.41l-2.34-2.34a.996.996 0 0 0-1.41 0l-1.83 1.83 3.75 3.75 1.83-1.83z" />
          </svg>
          Edit route
        </button>
      </div>
    </div>
  );
}
