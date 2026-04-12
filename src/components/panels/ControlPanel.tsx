import { useState } from 'react';
import { useRouteStore } from '../../store';
import { AddressSearch } from '../inputs/AddressSearch';
import { RouteComparisonPanel } from './RouteComparison';
import { LoadingSpinner } from '../common/LoadingSpinner';
import { downloadGPX } from '../../services/gpxService';
import { formatDistance, formatDuration } from '../../utils/geo';

export function ControlPanel() {
  const [isCollapsed, setIsCollapsed] = useState(false);
  
  const {
    origin,
    destination,
    setOrigin,
    setDestination,
    calculateRoutes,
    clearRoutes,
    swapLocations,
    normalRoute,
    avoidanceRoute,
    comparison,
    isCalculating,
    error,
    activeRoute,
    setActiveRoute,
  } = useRouteStore();

  const handleCalculate = () => {
    calculateRoutes();
  };

  const handleExportGPX = () => {
    const route = activeRoute === 'avoidance' ? avoidanceRoute : normalRoute;
    if (route) {
      const filename = `flockhopper-${activeRoute}-route-${Date.now()}.gpx`;
      downloadGPX(route, filename);
    }
  };

  const canCalculate = origin && destination && !isCalculating;

  return (
    <>
      {/* Mobile toggle button */}
      <button
        onClick={() => setIsCollapsed(!isCollapsed)}
        aria-label={isCollapsed ? 'Open route panel' : 'Close route panel'}
        className="lg:hidden fixed bottom-4 right-4 z-50 w-14 h-14 bg-accent rounded-md flex items-center justify-center text-white"
      >
        <svg className="w-6 h-6" viewBox="0 0 24 24" fill="currentColor">
          <path d="M3.5 18.49l6-6.01 4 4L22 6.92l-1.41-1.41-7.09 7.97-4-4L2 16.99z" />
        </svg>
      </button>

      {/* Panel */}
      <div
        className={`fixed lg:relative z-40 bg-dark-800 border-r border-dark-600 transition-transform duration-300 ${
          isCollapsed
            ? 'translate-x-full lg:translate-x-0'
            : 'translate-x-0'
        } right-0 lg:right-auto top-0 lg:top-auto h-full w-80 lg:w-96 pt-16 lg:pt-0 overflow-y-auto`}
      >
        <div className="p-4 space-y-6">
          {/* Header */}
          <div className="flex items-center justify-between">
            <h2 className="text-lg font-display font-semibold text-dark-100">
              Plan Route
            </h2>
            <button
              onClick={() => setIsCollapsed(true)}
              aria-label="Collapse panel"
              className="lg:hidden p-2 text-dark-400 hover:text-dark-200"
            >
              <svg className="w-5 h-5" viewBox="0 0 24 24" fill="currentColor">
                <path d="M19 6.41L17.59 5 12 10.59 6.41 5 5 6.41 10.59 12 5 17.59 6.41 19 12 13.41 17.59 19 19 17.59 13.41 12z" />
              </svg>
            </button>
          </div>

          {/* Route Inputs */}
          <div className="space-y-3">
            <AddressSearch
              value={origin}
              onChange={setOrigin}
              placeholder="Enter starting address..."
              label="From"
              icon="origin"
            />

            <div className="flex justify-center">
              <button
                onClick={swapLocations}
                disabled={!origin && !destination}
                className="p-2 text-dark-400 hover:text-dark-200 hover:bg-dark-700 rounded-lg transition-colors disabled:opacity-50"
                title="Swap locations"
                aria-label="Swap origin and destination"
              >
                <svg className="w-5 h-5" viewBox="0 0 24 24" fill="currentColor">
                  <path d="M16 17.01V10h-2v7.01h-3L15 21l4-3.99h-3zM9 3L5 6.99h3V14h2V6.99h3L9 3z" />
                </svg>
              </button>
            </div>

            <AddressSearch
              value={destination}
              onChange={setDestination}
              placeholder="Enter destination..."
              label="To"
              icon="destination"
            />
          </div>

          {/* Calculate Button */}
          <button
            onClick={handleCalculate}
            disabled={!canCalculate}
            className="w-full py-3 bg-accent hover:opacity-90 disabled:opacity-50 disabled:cursor-not-allowed text-white font-semibold rounded-md transition-opacity flex items-center justify-center gap-2"
          >
            {isCalculating ? (
              <>
                <LoadingSpinner size="sm" />
                <span>Calculating...</span>
              </>
            ) : (
              <>
                <svg className="w-5 h-5" viewBox="0 0 24 24" fill="currentColor">
                  <path d="M21.71 11.29l-9-9a.996.996 0 00-1.41 0l-9 9a.996.996 0 000 1.41l9 9c.39.39 1.02.39 1.41 0l9-9a.996.996 0 000-1.41zM14 14.5V12h-4v3H8v-4c0-.55.45-1 1-1h5V7.5l3.5 3.5-3.5 3.5z" />
                </svg>
                <span>Calculate Routes</span>
              </>
            )}
          </button>

          {/* Error */}
          {error && (
            <div className="p-3 bg-danger/10 border border-danger/30 rounded-lg text-sm text-danger">
              {error}
            </div>
          )}

          {/* Route Results */}
          {comparison && normalRoute && avoidanceRoute && (
            <div className="space-y-4">
              <RouteComparisonPanel
                comparison={comparison}
                activeRoute={activeRoute}
                onSelectRoute={setActiveRoute}
                normalDistance={normalRoute.distanceMeters}
                normalDuration={normalRoute.durationSeconds}
                avoidanceDistance={avoidanceRoute.distanceMeters}
                avoidanceDuration={avoidanceRoute.durationSeconds}
              />

              {/* Active Route Details */}
              <div className="bg-dark-700 rounded-md border border-dark-500 p-4">
                <div className="flex items-center justify-between mb-3">
                  <h4 className="text-sm font-semibold text-dark-100">
                    {activeRoute === 'avoidance' ? 'Avoidance' : 'Normal'} Route
                  </h4>
                  <span
                    className={`px-2 py-0.5 rounded text-xs font-medium ${
                      activeRoute === 'avoidance'
                        ? 'bg-success/20 text-success'
                        : 'bg-accent/20 text-accent'
                    }`}
                  >
                    Active
                  </span>
                </div>

                <div className="grid grid-cols-2 gap-4 mb-4">
                  <div>
                    <p className="text-xs text-dark-400 mb-0.5">Distance</p>
                    <p className="text-sm font-semibold text-dark-100">
                      {formatDistance(
                        activeRoute === 'avoidance'
                          ? avoidanceRoute.distanceMeters
                          : normalRoute.distanceMeters
                      )}
                    </p>
                  </div>
                  <div>
                    <p className="text-xs text-dark-400 mb-0.5">Duration</p>
                    <p className="text-sm font-semibold text-dark-100">
                      {formatDuration(
                        activeRoute === 'avoidance'
                          ? avoidanceRoute.durationSeconds
                          : normalRoute.durationSeconds
                      )}
                    </p>
                  </div>
                </div>

                {/* Export Button */}
                <button
                  onClick={handleExportGPX}
                  className="w-full py-2.5 bg-dark-600 hover:bg-dark-500 text-dark-100 font-medium rounded-lg transition-colors flex items-center justify-center gap-2"
                >
                  <svg className="w-4 h-4" viewBox="0 0 24 24" fill="currentColor">
                    <path d="M19 9h-4V3H9v6H5l7 7 7-7zM5 18v2h14v-2H5z" />
                  </svg>
                  Export GPX
                </button>
              </div>

              {/* Clear Button */}
              <button
                onClick={clearRoutes}
                className="w-full py-2 text-dark-400 hover:text-dark-200 text-sm font-medium transition-colors"
              >
                Clear Routes
              </button>
            </div>
          )}

          {/* Quick Info */}
          {!normalRoute && (
            <div className="bg-dark-700/50 rounded-lg p-4 border border-dark-600">
              <h4 className="text-sm font-medium text-dark-200 mb-2">
                How it works
              </h4>
              <ol className="space-y-2 text-xs text-dark-400">
                <li className="flex gap-2">
                  <span className="font-bold text-accent">1.</span>
                  Enter your start and destination addresses
                </li>
                <li className="flex gap-2">
                  <span className="font-bold text-accent">2.</span>
                  We calculate both normal and camera-avoiding routes
                </li>
                <li className="flex gap-2">
                  <span className="font-bold text-accent">3.</span>
                  Compare and export to GPX for your GPS
                </li>
              </ol>
            </div>
          )}
        </div>
      </div>
    </>
  );
}

