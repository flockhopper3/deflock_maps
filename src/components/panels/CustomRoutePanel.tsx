import { useEffect, useCallback, useRef, useState } from 'react';
import { useCustomRouteStore, useCameraStore, useRouteStore } from '../../store';
import { AddressSearch } from '../inputs/AddressSearch';
import { LoadingSpinner } from '../common/LoadingSpinner';
import { formatDistance, formatDuration } from '../../utils/geo';
import { downloadGPX } from '../../services/gpxService';
import type { Location } from '../../types';

export function CustomRoutePanel() {
  const [showSettings, setShowSettings] = useState(false);
  
  const {
    waypoints,
    customRoute,
    camerasOnRoute,
    baseRoute,
    isRecalculating,
    error,
    removeWaypoint,
    setOrigin,
    setDestination,
    recalculateRoute,
    undo,
    clearWaypoints,
    exitCustomMode,
    undoStack,
  } = useCustomRouteStore();

  const { cameras } = useCameraStore();
  
  // Get avoidance settings from main route store
  const {
    routeOptions,
    setCameraDistance,
    setUseDirectionalZones,
  } = useRouteStore();
  
  // Debounce ref for route recalculation
  const recalcTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Debounced route recalculation
  const debouncedRecalculate = useCallback(() => {
    if (recalcTimeoutRef.current) {
      clearTimeout(recalcTimeoutRef.current);
    }
    recalcTimeoutRef.current = setTimeout(() => {
      recalculateRoute(cameras);
    }, 300);
  }, [recalculateRoute, cameras]);

  // Recalculate when waypoints or avoidance settings change
  useEffect(() => {
    if (waypoints.length >= 2) {
      debouncedRecalculate();
    }
    return () => {
      if (recalcTimeoutRef.current) {
        clearTimeout(recalcTimeoutRef.current);
      }
    };
  }, [waypoints, debouncedRecalculate, routeOptions.cameraDistanceMeters, routeOptions.useDirectionalZones]);

  // Handle keyboard shortcuts
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        exitCustomMode();
      } else if ((e.ctrlKey || e.metaKey) && e.key === 'z') {
        e.preventDefault();
        undo();
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [exitCustomMode, undo]);

  const origin = waypoints[0] || null;
  const destination = waypoints.length > 1 ? waypoints[waypoints.length - 1] : null;
  const intermediateWaypoints = waypoints.length > 2 ? waypoints.slice(1, -1) : [];

  // Calculate comparison stats
  const baseCameraCount = baseRoute ? 0 : 0; // We'd need to store this from the original route
  const currentCameraCount = camerasOnRoute.length;
  const baseDistance = baseRoute?.distanceMeters || 0;
  const currentDistance = customRoute?.distanceMeters || 0;
  const distanceDelta = currentDistance - baseDistance;

  const handleOriginChange = (location: Location | null) => {
    if (location) {
      setOrigin(location);
    }
  };

  const handleDestinationChange = (location: Location | null) => {
    if (location) {
      setDestination(location);
    }
  };

  const handleRemoveWaypoint = (index: number) => {
    // Adjust index for intermediate waypoints (add 1 since index 0 is origin)
    removeWaypoint(index + 1);
  };

  const handleCancel = () => {
    exitCustomMode();
  };

  const handleExportGPX = () => {
    if (customRoute) {
      downloadGPX(customRoute);
    }
  };

  return (
    <div className="space-y-5">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-accent/10 border border-dark-600 flex items-center justify-center">
            <svg className="w-5 h-5 text-accent" viewBox="0 0 24 24" fill="currentColor">
              <path d="M3 17.25V21h3.75L17.81 9.94l-3.75-3.75L3 17.25zM20.71 7.04c.39-.39.39-1.02 0-1.41l-2.34-2.34c-.39-.39-1.02-.39-1.41 0l-1.83 1.83 3.75 3.75 1.83-1.83z" />
            </svg>
          </div>
          <div>
            <h2 className="text-lg font-display font-bold text-white">
              Custom Route
            </h2>
            <p className="text-xs text-dark-400">
              {baseRoute ? 'Modifying route' : 'Creating from scratch'}
            </p>
          </div>
        </div>
        <button
          onClick={handleCancel}
          className="p-2 text-dark-400 hover:text-white hover:bg-dark-700 rounded-lg transition-colors"
          title="Close (Esc)"
        >
          <svg className="w-5 h-5" viewBox="0 0 24 24" fill="currentColor">
            <path d="M19 6.41L17.59 5 12 10.59 6.41 5 5 6.41 10.59 12 5 17.59 6.41 19 12 13.41 17.59 19 19 17.59 13.41 12z" />
          </svg>
        </button>
      </div>

      {/* Instructions */}
      <div className="bg-accent/10 border border-dark-600 rounded-md p-3 space-y-1.5">
        <p className="text-xs text-accent">
          📍 <strong>Click</strong> on the map to add waypoints. New points are auto-inserted between existing ones.
        </p>
        <p className="text-xs text-accent">
          ✋ <strong>Drag</strong> any marker to reposition it.
        </p>
      </div>

      {/* Avoidance Settings Toggle */}
      <button
        onClick={() => setShowSettings(!showSettings)}
        className="w-full flex items-center justify-between px-4 py-3 bg-dark-800 hover:bg-dark-700 rounded-xl transition-colors"
      >
        <div className="flex items-center gap-3">
          <svg className="w-5 h-5 text-gray-400" viewBox="0 0 24 24" fill="currentColor">
            <path d="M19.14 12.94c.04-.31.06-.63.06-.94 0-.31-.02-.63-.06-.94l2.03-1.58c.18-.14.23-.41.12-.61l-1.92-3.32c-.12-.22-.37-.29-.59-.22l-2.39.96c-.5-.38-1.03-.7-1.62-.94l-.36-2.54c-.04-.24-.24-.41-.48-.41h-3.84c-.24 0-.43.17-.47.41l-.36 2.54c-.59.24-1.13.57-1.62.94l-2.39-.96c-.22-.08-.47 0-.59.22L2.74 8.87c-.12.21-.08.47.12.61l2.03 1.58c-.04.31-.06.63-.06.94s.02.63.06.94l-2.03 1.58c-.18.14-.23.41-.12.61l1.92 3.32c.12.22.37.29.59.22l2.39-.96c.5.38 1.03.7 1.62.94l.36 2.54c.05.24.24.41.48.41h3.84c.24 0 .44-.17.47-.41l.36-2.54c.59-.24 1.13-.56 1.62-.94l2.39.96c.22.08.47 0 .59-.22l1.92-3.32c.12-.22.07-.47-.12-.61l-2.01-1.58zM12 15.6c-1.98 0-3.6-1.62-3.6-3.6s1.62-3.6 3.6-3.6 3.6 1.62 3.6 3.6-1.62 3.6-3.6 3.6z" />
          </svg>
          <span className="text-sm text-gray-200 font-medium">Avoidance Settings</span>
        </div>
        <div className="flex items-center gap-2">
          <span className="text-xs text-accent">
            {Math.round(routeOptions.cameraDistanceMeters * 3.28084)} ft
            {routeOptions.useDirectionalZones && ' · Directional'}
          </span>
          <svg 
            className={`w-5 h-5 text-gray-400 transition-transform ${showSettings ? 'rotate-180' : ''}`}
            viewBox="0 0 24 24" 
            fill="currentColor"
          >
            <path d="M7.41 8.59L12 13.17l4.59-4.58L18 10l-6 6-6-6 1.41-1.41z" />
          </svg>
        </div>
      </button>

      {/* Settings Panel */}
      {showSettings && (
        <div className="bg-dark-800 rounded-xl border border-dark-600 p-4 space-y-4 animate-fade-in">
          {/* Camera Distance */}
          <div>
            <div className="flex items-center justify-between mb-2">
              <label className="text-sm text-gray-200 font-medium">Camera Distance</label>
              <span className="text-sm text-accent font-bold">
                {Math.round(routeOptions.cameraDistanceMeters * 3.28084)} ft
              </span>
            </div>
            <p className="text-xs text-gray-400 mb-3">
              How far to stay from cameras when routing.
            </p>
            <input
              type="range"
              min="30"
              max="500"
              step="10"
              value={Math.round(routeOptions.cameraDistanceMeters * 3.28084)}
              onChange={(e) => setCameraDistance(Math.round(parseInt(e.target.value) * 0.3048))}
              className="w-full h-2 bg-dark-600 rounded-lg appearance-none cursor-pointer accent-[#0080BC]"
            />
            <div className="flex justify-between text-xs text-gray-400 mt-2">
              <span>30 ft (closer)</span>
              <span>500 ft (safer)</span>
            </div>
          </div>

          {/* Directional Zones Toggle */}
          <div className="pt-3 border-t border-dark-700">
            <div className="flex items-center justify-between">
              <div className="flex-1 pr-4">
                <label className="text-sm text-gray-200 font-medium">Directional Zones</label>
                <p className="text-xs text-gray-400 mt-1">
                  Use camera direction data. Routes can pass behind cameras.
                </p>
              </div>
              <button
                onClick={() => setUseDirectionalZones(!routeOptions.useDirectionalZones)}
                className={`relative w-10 h-[22px] flex-shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none focus:ring-2 focus:ring-accent focus:ring-offset-2 focus:ring-offset-dark-800 ${
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
        </div>
      )}

      {/* Origin Input */}
      <div className="space-y-3">
        <AddressSearch
          value={origin}
          onChange={handleOriginChange}
          placeholder="Starting point..."
          label="From"
          icon="origin"
        />

        {/* Intermediate Waypoints */}
        {intermediateWaypoints.length > 0 && (
          <div className="space-y-2">
            <label className="block text-sm text-dark-100 font-medium">
              Via
            </label>
            <div className="space-y-2">
              {intermediateWaypoints.map((wp, idx) => (
                <div
                  key={idx}
                  className="flex items-center gap-2 bg-dark-800 rounded-xl px-4 py-3 border border-dark-600"
                >
                  <div className="w-6 h-6 rounded-full bg-accent/10 flex items-center justify-center text-xs font-bold text-accent flex-shrink-0">
                    {idx + 1}
                  </div>
                  <span className="flex-1 text-sm text-white truncate">
                    {wp.name || `${wp.lat.toFixed(4)}, ${wp.lon.toFixed(4)}`}
                  </span>
                  <button
                    onClick={() => handleRemoveWaypoint(idx)}
                    className="p-1.5 text-dark-400 hover:text-danger hover:bg-dark-700 rounded-lg transition-colors"
                  >
                    <svg className="w-4 h-4" viewBox="0 0 24 24" fill="currentColor">
                      <path d="M19 6.41L17.59 5 12 10.59 6.41 5 5 6.41 10.59 12 5 17.59 6.41 19 12 13.41 17.59 19 19 17.59 13.41 12z" />
                    </svg>
                  </button>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Add Waypoint Hint */}
        <div className="w-full py-2.5 border border-dashed border-dark-600 text-dark-400 rounded-xl flex items-center justify-center gap-2 text-sm">
          <svg className="w-4 h-4" viewBox="0 0 24 24" fill="currentColor">
            <path d="M19 13h-6v6h-2v-6H5v-2h6V5h2v6h6v2z" />
          </svg>
          Click map to add waypoints
        </div>

        {/* Destination Input */}
        <AddressSearch
          value={destination}
          onChange={handleDestinationChange}
          placeholder="Destination..."
          label="To"
          icon="destination"
        />
      </div>

      {/* Live Stats */}
      {(customRoute || isRecalculating) && (
        <div className="bg-dark-800 rounded-xl border border-dark-600 overflow-hidden">
          <div className="px-4 py-3 border-b border-dark-600 bg-dark-700/50 flex items-center justify-between">
            <span className="text-xs font-semibold text-dark-300 uppercase tracking-wider">
              Route Stats
            </span>
            {isRecalculating && (
              <div className="flex items-center gap-2">
                <LoadingSpinner size="sm" />
                <span className="text-xs text-dark-400">Calculating...</span>
              </div>
            )}
          </div>
          
          <div className="p-4 space-y-3">
            {/* Camera Count */}
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <div className="w-2 h-2 rounded-full bg-danger"></div>
                <span className="text-sm text-dark-300">Cameras</span>
              </div>
              <div className="flex items-center gap-2">
                <span className="text-lg font-bold text-white">{currentCameraCount}</span>
                {baseRoute && baseCameraCount !== currentCameraCount && (
                  <span className={`text-xs ${currentCameraCount < baseCameraCount ? 'text-success' : 'text-danger'}`}>
                    {currentCameraCount < baseCameraCount ? '↓' : '↑'}
                    {Math.abs(currentCameraCount - baseCameraCount)}
                  </span>
                )}
              </div>
            </div>

            {/* Distance */}
            {customRoute && (
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <svg className="w-4 h-4 text-dark-400" viewBox="0 0 24 24" fill="currentColor">
                    <path d="M21.71 11.29l-9-9a.996.996 0 00-1.41 0l-9 9a.996.996 0 000 1.41l9 9c.39.39 1.02.39 1.41 0l9-9a.996.996 0 000-1.41z" />
                  </svg>
                  <span className="text-sm text-dark-300">Distance</span>
                </div>
                <div className="flex items-center gap-2">
                  <span className="text-sm font-medium text-white">
                    {formatDistance(currentDistance)}
                  </span>
                  {baseRoute && distanceDelta !== 0 && (
                    <span className={`text-xs ${distanceDelta > 0 ? 'text-route-direct' : 'text-success'}`}>
                      {distanceDelta > 0 ? '+' : ''}{formatDistance(distanceDelta)}
                    </span>
                  )}
                </div>
              </div>
            )}

            {/* Duration */}
            {customRoute && (
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <svg className="w-4 h-4 text-dark-400" viewBox="0 0 24 24" fill="currentColor">
                    <path d="M11.99 2C6.47 2 2 6.48 2 12s4.47 10 9.99 10C17.52 22 22 17.52 22 12S17.52 2 11.99 2zM12 20c-4.42 0-8-3.58-8-8s3.58-8 8-8 8 3.58 8 8-3.58 8-8 8zm.5-13H11v6l5.25 3.15.75-1.23-4.5-2.67z" />
                  </svg>
                  <span className="text-sm text-dark-300">Duration</span>
                </div>
                <span className="text-sm font-medium text-white">
                  {formatDuration(customRoute.durationSeconds)}
                </span>
              </div>
            )}

            {/* Waypoints count */}
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <svg className="w-4 h-4 text-dark-400" viewBox="0 0 24 24" fill="currentColor">
                  <path d="M12 2C8.13 2 5 5.13 5 9c0 5.25 7 13 7 13s7-7.75 7-13c0-3.87-3.13-7-7-7z" />
                </svg>
                <span className="text-sm text-dark-300">Waypoints</span>
              </div>
              <span className="text-sm font-medium text-white">{waypoints.length}</span>
            </div>
          </div>
        </div>
      )}

      {/* Error */}
      {error && (
        <div className="p-4 bg-danger/10 border border-danger/30 rounded-xl text-sm text-danger flex items-start gap-3">
          <svg className="w-5 h-5 flex-shrink-0 mt-0.5" viewBox="0 0 24 24" fill="currentColor">
            <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm1 15h-2v-2h2v2zm0-4h-2V7h2v6z" />
          </svg>
          <span>{error}</span>
        </div>
      )}

      {/* Action Buttons */}
      <div className="space-y-2">
        {/* Export GPX Button */}
        <button
          onClick={handleExportGPX}
          disabled={!customRoute || isRecalculating}
          className="w-full py-3 bg-dark-700 hover:bg-dark-600 disabled:bg-dark-800 disabled:cursor-not-allowed text-white disabled:text-dark-500 font-medium rounded-xl transition-all duration-200 flex items-center justify-center gap-2"
        >
          <svg className="w-5 h-5" viewBox="0 0 24 24" fill="currentColor">
            <path d="M19 9h-4V3H9v6H5l7 7 7-7zM5 18v2h14v-2H5z" />
          </svg>
          <span>Export GPX</span>
        </button>

        <div className="flex gap-2">
          <button
            onClick={undo}
            disabled={undoStack.length === 0}
            className="flex-1 py-2.5 text-dark-400 hover:text-dark-200 disabled:opacity-30 disabled:cursor-not-allowed text-sm font-medium transition-colors flex items-center justify-center gap-2"
          >
            <svg className="w-4 h-4" viewBox="0 0 24 24" fill="currentColor">
              <path d="M12.5 8c-2.65 0-5.05.99-6.9 2.6L2 7v9h9l-3.62-3.62c1.39-1.16 3.16-1.88 5.12-1.88 3.54 0 6.55 2.31 7.6 5.5l2.37-.78C21.08 11.03 17.15 8 12.5 8z" />
            </svg>
            Undo
          </button>
          <button
            onClick={clearWaypoints}
            disabled={waypoints.length === 0}
            className="flex-1 py-2.5 text-dark-400 hover:text-danger disabled:opacity-30 disabled:cursor-not-allowed text-sm font-medium transition-colors flex items-center justify-center gap-2"
          >
            <svg className="w-4 h-4" viewBox="0 0 24 24" fill="currentColor">
              <path d="M6 19c0 1.1.9 2 2 2h8c1.1 0 2-.9 2-2V7H6v12zM19 4h-3.5l-1-1h-5l-1 1H5v2h14V4z" />
            </svg>
            Clear All
          </button>
        </div>

        <button
          onClick={handleCancel}
          className="w-full py-2.5 text-dark-400 hover:text-dark-200 text-sm font-medium transition-colors"
        >
          Cancel
        </button>
      </div>

      {/* Keyboard shortcuts hint */}
      <div className="text-center text-xs text-dark-500">
        <span className="px-2 py-0.5 bg-dark-800 rounded">Esc</span> to close
        <span className="mx-2">·</span>
        <span className="px-2 py-0.5 bg-dark-800 rounded">Ctrl+Z</span> to undo
      </div>
    </div>
  );
}

