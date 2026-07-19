import { useRouteStore } from '../../store';
import { formatDistance, formatDuration } from '../../utils/geo';

interface RouteScoreboardProps {
  /** Switch back to the address inputs. */
  onEdit: () => void;
}

/**
 * Mobile results card. Replaces the floating search inputs once routes
 * exist so screenshots show the comparison, never the user's addresses.
 *
 * Pinned across the top of the map, so it stays deliberately short — big
 * number per route, everything else inline, verdict + watermark + edit on a
 * single footer strip. The route fit (MapLibreContainer) measures this card
 * via `data-route-scoreboard` and centers the line in the space below it.
 */
export function RouteScoreboard({ onEdit }: RouteScoreboardProps) {
  const { normalRoute, avoidanceRoute, comparison, activeRoute, setActiveRoute } = useRouteStore();

  if (!normalRoute || !avoidanceRoute || !comparison) return null;

  const normalCameras = comparison.normalCameras.length;
  const avoidanceCameras = comparison.avoidanceCameras.length;
  const camerasAvoided = normalCameras - avoidanceCameras;
  const verdict = camerasAvoided > 0
    ? `${camerasAvoided} fewer ${camerasAvoided === 1 ? 'camera' : 'cameras'}`
    : null;
  const extraMinutes = Math.round(
    (avoidanceRoute.durationSeconds - normalRoute.durationSeconds) / 60
  );

  return (
    <div
      data-route-scoreboard
      className="bg-dark-900/95 border border-dark-600 rounded-xl shadow-2xl backdrop-blur-sm overflow-hidden animate-fade-in"
    >
      <div className="flex">
        {/* Direct half */}
        <button
          onClick={() => setActiveRoute('normal')}
          type="button"
          aria-selected={activeRoute === 'normal'}
          aria-label="Show direct route"
          className={`relative flex-1 min-w-0 px-3.5 py-2 text-left transition-colors ${
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
          <div className="flex items-center gap-2 mt-0.5">
            <span className="font-display font-extrabold text-3xl leading-none text-route-direct tabular-nums">
              {normalCameras}
            </span>
            <span className="min-w-0 text-[11px] leading-tight">
              <span className="block font-semibold text-dark-300">
                {normalCameras === 1 ? 'camera' : 'cameras'}
              </span>
              <span className="block text-dark-400 truncate">
                {formatDuration(normalRoute.durationSeconds)} · {formatDistance(normalRoute.distanceMeters)}
              </span>
            </span>
          </div>
        </button>

        <div className="w-px bg-hairline flex-shrink-0" aria-hidden="true" />

        {/* Privacy half */}
        <button
          onClick={() => setActiveRoute('avoidance')}
          type="button"
          aria-selected={activeRoute === 'avoidance'}
          aria-label="Show privacy route"
          className={`relative flex-1 min-w-0 px-3.5 py-2 text-left transition-colors ${
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
          <div className="flex items-center gap-2 mt-0.5">
            <span className="font-display font-extrabold text-3xl leading-none text-white tabular-nums">
              {avoidanceCameras}
            </span>
            <span className="min-w-0 text-[11px] leading-tight">
              <span className="block font-semibold text-dark-300">
                {avoidanceCameras === 1 ? 'camera' : 'cameras'}
              </span>
              <span className="block text-dark-400 truncate">
                <span className="text-dark-300 font-medium">{formatDuration(avoidanceRoute.durationSeconds)}</span>
                {extraMinutes > 0
                  ? <span className="text-route-direct"> +{extraMinutes} min</span>
                  : <> · {formatDistance(avoidanceRoute.distanceMeters)}</>}
              </span>
            </span>
          </div>
        </button>
      </div>

      {/* Footer: verdict · watermark · edit — one strip */}
      <div className="flex items-center gap-2.5 border-t border-hairline px-3.5 py-1.5">
        {verdict && (
          <>
            <span className="text-[11px] font-bold text-success whitespace-nowrap">{verdict}</span>
            <span className="w-[3px] h-[3px] rounded-full bg-dark-600 flex-shrink-0" aria-hidden="true" />
          </>
        )}
        <span className="text-2xs text-dark-500 uppercase truncate">maps.deflock.org</span>
        <button
          onClick={onEdit}
          type="button"
          aria-label="Edit route"
          className="ml-auto flex items-center gap-1.5 py-1 -my-1 text-2xs text-dark-300 uppercase active:text-white hover:text-white transition-colors flex-shrink-0"
        >
          <svg className="w-3 h-3" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
            <path d="M3 17.25V21h3.75L17.81 9.94l-3.75-3.75L3 17.25zM20.71 7.04c.39-.39.39-1.02 0-1.41l-2.34-2.34a.996.996 0 0 0-1.41 0l-1.83 1.83 3.75 3.75 1.83-1.83z" />
          </svg>
          Edit
        </button>
      </div>
    </div>
  );
}
