import { useState, useEffect } from 'react';
import { useRouteStore } from '../../store';
import { FlockHopperCTA, FlockHopperStoreButtons, FlockHopperLearnMore } from './FlockHopperCTA';
import { formatDistance, formatDuration } from '../../utils/geo';
import { formatPercent } from '../../utils/formatting';

export function RoutePanelContent() {
  const [showSettings, setShowSettings] = useState(false);

  /* Options the current results were calculated with — settings edits after
     a calculation surface an "Apply & recalculate" button. */
  const [appliedOptions, setAppliedOptions] = useState<{ distance: number; directional: boolean } | null>(null);

  const {
    calculateRoutes,
    clearRoutes,
    normalRoute,
    avoidanceRoute,
    comparison,
    isCalculating,
    activeRoute,
    setActiveRoute,
    routeOptions,
    setCameraDistance,
    setUseDirectionalZones,
  } = useRouteStore();

  const hasRoutes = normalRoute && avoidanceRoute && comparison;

  useEffect(() => {
    if (isCalculating) {
      setAppliedOptions({
        distance: routeOptions.cameraDistanceMeters,
        directional: routeOptions.useDirectionalZones,
      });
    }
  }, [isCalculating, routeOptions.cameraDistanceMeters, routeOptions.useDirectionalZones]);

  /* Remount with routes already in the store (e.g. after a tab switch):
     adopt current options as the applied baseline so settings edits can
     still surface the Apply button. */
  useEffect(() => {
    if (hasRoutes && appliedOptions === null) {
      setAppliedOptions({
        distance: routeOptions.cameraDistanceMeters,
        directional: routeOptions.useDirectionalZones,
      });
    }
  }, [hasRoutes, appliedOptions, routeOptions.cameraDistanceMeters, routeOptions.useDirectionalZones]);

  const settingsDirty = !!hasRoutes && appliedOptions !== null &&
    (appliedOptions.distance !== routeOptions.cameraDistanceMeters ||
     appliedOptions.directional !== routeOptions.useDirectionalZones);

  const normalCameraCount = comparison?.normalCameras.length ?? 0;
  const avoidanceCameraCount = comparison?.avoidanceCameras.length ?? 0;
  const cameraReduction = normalCameraCount > 0 
    ? Math.round(((normalCameraCount - avoidanceCameraCount) / normalCameraCount) * 100)
    : 0;

  return (
    <div className="space-y-6">
          {/* Intro (when no routes) */}
          {!hasRoutes && (
            <div className="space-y-4">
              <div>
                <img src="/FlockHopper-2.png" alt="FlockHopper" className="h-14 w-auto" />
                <p className="text-sm text-gray-200 leading-relaxed mt-3">
                  Real-time, turn-by-turn navigation that avoids ALPR cameras — get the app that powers this map.
                </p>
                <div className="mt-3">
                  <FlockHopperStoreButtons />
                </div>
                <FlockHopperLearnMore className="mt-2.5" />
              </div>
              <p className="text-sm text-gray-200 leading-relaxed">
                Set your start and destination on the map to analyze ALPR camera exposure along your route and discover safer alternatives.
              </p>
            </div>
          )}

          {/* Settings Toggle */}
          <button
            onClick={() => setShowSettings(!showSettings)}
            className="w-full flex items-center justify-between px-4 py-3.5 bg-dark-800 hover:bg-dark-700 rounded-xl transition-colors"
          >
            <div className="flex items-center gap-3">
              <svg className="w-5 h-5 text-gray-400" viewBox="0 0 24 24" fill="currentColor">
                <path d="M19.14 12.94c.04-.31.06-.63.06-.94 0-.31-.02-.63-.06-.94l2.03-1.58c.18-.14.23-.41.12-.61l-1.92-3.32c-.12-.22-.37-.29-.59-.22l-2.39.96c-.5-.38-1.03-.7-1.62-.94l-.36-2.54c-.04-.24-.24-.41-.48-.41h-3.84c-.24 0-.43.17-.47.41l-.36 2.54c-.59.24-1.13.57-1.62.94l-2.39-.96c-.22-.08-.47 0-.59.22L2.74 8.87c-.12.21-.08.47.12.61l2.03 1.58c-.04.31-.06.63-.06.94s.02.63.06.94l-2.03 1.58c-.18.14-.23.41-.12.61l1.92 3.32c.12.22.37.29.59.22l2.39-.96c.5.38 1.03.7 1.62.94l.36 2.54c.05.24.24.41.48.41h3.84c.24 0 .44-.17.47-.41l.36-2.54c.59-.24 1.13-.56 1.62-.94l2.39.96c.22.08.47 0 .59-.22l1.92-3.32c.12-.22.07-.47-.12-.61l-2.01-1.58zM12 15.6c-1.98 0-3.6-1.62-3.6-3.6s1.62-3.6 3.6-3.6 3.6 1.62 3.6 3.6-1.62 3.6-3.6 3.6z" />
              </svg>
              <span className="text-sm text-gray-200 font-medium">Avoidance Settings</span>
            </div>
            <svg 
              className={`w-5 h-5 text-gray-400 transition-transform ${showSettings ? 'rotate-180' : ''}`}
              viewBox="0 0 24 24" 
              fill="currentColor"
            >
              <path d="M7.41 8.59L12 13.17l4.59-4.58L18 10l-6 6-6-6 1.41-1.41z" />
            </svg>
          </button>

          {/* Settings Panel */}
          {showSettings && (
            <div className="bg-dark-800 rounded-xl border border-dark-600 p-5 space-y-4 animate-fade-in">
              {/* Camera Distance - The only setting that matters */}
              <div>
                <div className="flex items-center justify-between mb-2">
                  <label className="text-sm text-gray-200 font-medium">Camera Distance to Route</label>
                  <span className="text-sm text-accent font-bold">
                    {Math.round(routeOptions.cameraDistanceMeters * 3.28084)} ft
                  </span>
                </div>
                <p className="text-xs text-gray-300 mb-3">
                  Stay this far from cameras. Smaller = shorter routes but closer to cameras.
                </p>
                <input
                  type="range"
                  min="30"
                  max="500"
                  step="10"
                  value={Math.round(routeOptions.cameraDistanceMeters * 3.28084)}
                  onChange={(e) => setCameraDistance(Math.round(parseInt(e.target.value) * 0.3048))}
                  className="w-full h-2 bg-dark-600 rounded-lg appearance-none cursor-pointer accent-accent"
                  aria-label="Camera avoidance distance"
                />
                <div className="flex justify-between text-xs text-gray-300 mt-2">
                  <span>30 ft (risky)</span>
                  <span>500 ft (safe)</span>
                </div>
              </div>

              {/* Directional Zones Toggle */}
              <div className="pt-4 border-t border-dark-700">
                <div className="flex items-center justify-between">
                  <div className="flex-1 pr-4">
                    <label className="text-sm text-gray-200 font-medium">Directional Camera Zones</label>
                    <p className="text-xs text-gray-400 mt-1">
                      Use camera facing direction to create cone-shaped avoidance zones. Routes can pass behind cameras.
                    </p>
                  </div>
                  <button
                    onClick={() => setUseDirectionalZones(!routeOptions.useDirectionalZones)}
                    className={`relative inline-flex h-[22px] w-10 flex-shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none focus:ring-2 focus:ring-accent focus:ring-offset-2 focus:ring-offset-dark-800 ${
                      routeOptions.useDirectionalZones ? 'bg-accent' : 'bg-dark-600'
                    }`}
                    role="switch"
                    aria-checked={routeOptions.useDirectionalZones}
                  >
                    <span
                      className={`pointer-events-none inline-block w-[18px] h-[18px] transform rounded-full bg-white shadow ring-0 transition duration-200 ease-in-out ${
                        routeOptions.useDirectionalZones ? 'translate-x-[18px]' : 'translate-x-0'
                      }`}
                    />
                  </button>
                </div>
              </div>

              {/* Apply changed settings to the current route */}
              {settingsDirty && (
                <button
                  onClick={() => calculateRoutes()}
                  disabled={isCalculating}
                  className="w-full py-3 bg-accent hover:bg-accent-hover disabled:opacity-50 text-white font-semibold text-sm rounded-md transition-colors flex items-center justify-center gap-2 animate-fade-in"
                >
                  Apply &amp; recalculate
                </button>
              )}
            </div>
          )}

          {/* Results */}
          {hasRoutes && (
            <div className="space-y-5 animate-fade-in">
              
              {/* Big Camera Count Display */}
              <div className="relative overflow-hidden rounded-md bg-dark-800 border border-dark-600 p-6">
                <div className="relative text-center">
                  <div className="flex items-center justify-center gap-3 mb-3">
                    <div className="w-3 h-3 rounded-full bg-accent rec-indicator shadow-[0_0_12px_rgba(30,144,255,0.6)]"></div>
                    <span className="text-sm font-medium text-gray-200 uppercase tracking-wide">
                      Direct Route
                    </span>
                  </div>
                  
                  <div className="text-6xl font-display font-black text-white mb-2">
                    {normalCameraCount}
                  </div>
                  
                  <p className="text-sm text-gray-300">
                    {normalCameraCount === 0 
                      ? 'No ALPR cameras detected!'
                      : normalCameraCount === 1 
                        ? 'camera will scan your plates'
                        : 'cameras will scan your plates'
                    }
                  </p>
                </div>
              </div>

              {/* Route Comparison Cards */}
              <div className="grid grid-cols-2 gap-4">
                {/* Normal Route */}
                <button
                  onClick={() => setActiveRoute('normal')}
                  aria-selected={activeRoute === 'normal'}
                  aria-label="Select direct route"
                  className={`relative p-4 rounded-md border-2 transition-all ${
                    activeRoute === 'normal'
                      ? 'bg-orange-500/10 border-orange-500'
                      : 'bg-dark-800 border-dark-600 hover:border-dark-500'
                  }`}
                >
                  <div className="flex items-center gap-2 mb-3">
                    <div className="w-6 h-1 rounded-full bg-orange-500" style={{backgroundImage: 'repeating-linear-gradient(90deg, #e5a04d 0, #e5a04d 3px, transparent 3px, transparent 5px)'}}></div>
                    <span className="text-xs font-semibold text-gray-200 uppercase tracking-wide">
                      Direct
                    </span>
                  </div>
                  <div className="text-left">
                    <p className="text-xl font-display font-bold text-white">
                      {formatDistance(normalRoute.distanceMeters)}
                    </p>
                    <p className="text-sm text-gray-300 mt-1">
                      {formatDuration(normalRoute.durationSeconds)}
                    </p>
                  </div>
                  <div className="flex items-center gap-2 mt-4 pt-3 border-t border-dark-600">
                    <div className="w-2.5 h-2.5 rounded-full bg-accent"></div>
                    <span className="text-lg font-bold text-accent">
                      {normalCameraCount}
                    </span>
                    <span className="text-sm text-gray-300">cameras</span>
                  </div>
                </button>

                {/* Avoidance Route */}
                <button
                  onClick={() => setActiveRoute('avoidance')}
                  aria-selected={activeRoute === 'avoidance'}
                  aria-label="Select privacy route"
                  className={`relative p-4 rounded-md border-2 transition-all ${
                    activeRoute === 'avoidance'
                      ? 'bg-blue-500/10 border-blue-500'
                      : 'bg-dark-800 border-dark-600 hover:border-dark-500'
                  }`}
                >
                  <div className="flex items-center gap-2 mb-3">
                    <div className="w-6 h-1 rounded-full bg-blue-500"></div>
                    <span className="text-xs font-semibold text-gray-200 uppercase tracking-wide">
                      Privacy
                    </span>
                  </div>
                  <div className="text-left">
                    <p className="text-xl font-display font-bold text-white">
                      {formatDistance(avoidanceRoute.distanceMeters)}
                    </p>
                    <p className="text-sm text-gray-300 mt-1">
                      {formatDuration(avoidanceRoute.durationSeconds)}
                      {comparison.durationIncreasePercent > 0 && (
                        <span className="text-route-direct ml-1">
                          (+{formatPercent(comparison.durationIncreasePercent)})
                        </span>
                      )}
                    </p>
                  </div>
                  <div className="flex items-center gap-2 mt-4 pt-3 border-t border-dark-600">
                    <svg className="w-5 h-5 text-accent" viewBox="0 0 24 24" fill="currentColor">
                      <path d="M9 16.17L4.83 12l-1.42 1.41L9 19 21 7l-1.41-1.41z" />
                    </svg>
                    <span className="text-lg font-bold text-accent">
                      {avoidanceCameraCount}
                    </span>
                    <span className="text-sm text-gray-300">cameras</span>
                  </div>
                </button>
              </div>

              {/* Success Banner */}
              {cameraReduction > 0 && (
                <div className="bg-dark-800 border border-dark-600 rounded-md p-5">
                  <div className="flex items-center gap-4">
                    <div className="w-12 h-12 rounded-full bg-accent/20 flex items-center justify-center flex-shrink-0">
                      <svg className="w-6 h-6 text-accent" viewBox="0 0 24 24" fill="currentColor">
                        <path d="M12 1L3 5v6c0 5.55 3.84 10.74 9 12 5.16-1.26 9-6.45 9-12V5l-9-4z"/>
                      </svg>
                    </div>
                    <div>
                      <p className="text-sm font-semibold text-white">
                        <span className="text-accent">{cameraReduction}% fewer</span> cameras
                      </p>
                      <p className="text-sm text-gray-300 mt-1">
                        +{formatDistance(comparison.distanceIncrease)} extra
                      </p>
                    </div>
                  </div>
                </div>
              )}

              {/* FlockHopper Navigation CTA */}
              <FlockHopperCTA
                variant="card"
                title="Drive this route with live navigation"
                description="FlockHopper gives you real-time, turn-by-turn camera avoidance."
              />

              {/* Clear */}
              <button
                onClick={clearRoutes}
                className="w-full py-3 text-gray-400 hover:text-gray-200 text-sm font-medium transition-colors"
              >
                Start over
              </button>
            </div>
          )}

          {/* How it works (when no routes) */}
          {!hasRoutes && !isCalculating && (
            <div className="bg-dark-800/50 rounded-xl p-5 border border-dark-700/50">
              <h4 className="text-sm font-semibold text-gray-200 uppercase tracking-wide mb-4">
                How it works
              </h4>
              <ol className="space-y-3">
                {[
                  'Set your start and destination — search, use your location, or tap the map',
                  'We instantly compare the direct route against a privacy route',
                  'See exactly how many ALPR cameras each route passes',
                  'Get FlockHopper Mobile for real-time, turn-by-turn navigation',
                ].map((step, idx) => (
                  <li key={idx} className="flex gap-4 text-sm text-gray-200">
                    <span className="w-6 h-6 rounded-full bg-dark-700 flex items-center justify-center text-sm font-bold text-accent flex-shrink-0">
                      {idx + 1}
                    </span>
                    <span className="pt-0.5">{step}</span>
                  </li>
                ))}
              </ol>
            </div>
          )}

    </div>
  );
}

