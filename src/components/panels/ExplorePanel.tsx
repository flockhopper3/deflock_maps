import { useState, useEffect } from 'react';
import { useIsMobile } from '../../hooks/useIsMobile';
import { useCameraStore, useAppModeStore } from '../../store';
import { BottomSheet, type SnapPoint } from '../common/BottomSheet';
import { HeatmapControls } from '../../modes/heatmap/HeatmapControls';
import { HeatmapLegend } from '../../modes/heatmap/HeatmapLegend';
import { DotDensityControls } from '../../modes/dots/DotDensityControls';
import { ChevronLeft, ChevronRight, Layers } from 'lucide-react';
import { MapTypeDropdown, VIZ_OPTIONS } from './MapTypeDropdown';
import { Skeleton } from '../common';
import { useDelayedFlag } from '../../hooks/useDelayedFlag';

export function ExplorePanel() {
  const isMobile = useIsMobile();
  const [snapPoint, setSnapPoint] = useState<SnapPoint>('minimized');
  const [isCollapsed, setIsCollapsed] = useState(false);
  const [hasAnimated, setHasAnimated] = useState(false);

  const cameraCount = useCameraStore(s => s.cameras.length);
  const mapVisualization = useAppModeStore(s => s.mapVisualization);

  const isInitialized = useCameraStore(s => s.isInitialized);
  const loadPhase = useCameraStore(s => s.loadPhase);
  const downloadProgress = useCameraStore(s => s.downloadProgress);
  const cameraError = useCameraStore(s => s.error);
  const retryCameraLoad = useCameraStore(s => s.retryCameraLoad);

  const camerasPending = !isInitialized && loadPhase !== 'error';
  const showSkeleton = useDelayedFlag(camerasPending);

  useEffect(() => {
    const timer = setTimeout(() => setHasAnimated(true), 50);
    return () => clearTimeout(timer);
  }, []);

  // Render the active visualization controls
  const renderControls = () => {
    switch (mapVisualization) {
      case 'heatmap':
        return <HeatmapControls />;
      case 'dots':
        return <DotDensityControls />;
      default:
        return null;
    }
  };

  // Loading/error/content for the panel body — shared by mobile sheet and desktop panel
  const panelBody = () => {
    if (loadPhase === 'error' && cameraError) {
      return (
        <div className="bg-red-900/20 border border-red-500/30 rounded-xl p-4">
          <p className="text-sm text-red-400 mb-2">Failed to load camera data</p>
          <p className="text-xs text-dark-500 mb-3">{cameraError}</p>
          <button
            onClick={() => {
              // store owns the error state
              retryCameraLoad().catch(() => {});
            }}
            className="px-3 py-1.5 bg-red-600 hover:bg-red-700 text-white text-xs font-medium rounded-lg transition-colors"
          >
            Retry
          </button>
        </div>
      );
    }
    if (camerasPending) {
      if (!showSkeleton) return null;
      return (
        <div className="space-y-4" aria-busy="true">
          <Skeleton className="h-4 w-3/5" />
          <Skeleton className="h-24 w-full" />
          <Skeleton className="h-3 w-full" />
          <Skeleton className="h-3 w-4/5" />
          <Skeleton className="h-3 w-2/5" />
        </div>
      );
    }
    return renderControls();
  };

  const vizLabel = VIZ_OPTIONS.find((o) => o.id === mapVisualization)?.label ?? 'Explore';

  // Mobile: Bottom Sheet
  if (isMobile) {
    return (
      <BottomSheet
        snapPoint={snapPoint}
        onSnapPointChange={setSnapPoint}
        minimizedHeight={84}
        peekHeight={84}
        fullHeight={85}
        headerContent={
          <button
            onClick={() => setSnapPoint('full')}
            className="w-full flex items-center justify-between py-1"
          >
            <div className="flex items-center gap-3">
              <div className="w-9 h-9 rounded-xl bg-accent/10 border border-dark-600 flex items-center justify-center">
                <Layers className="w-4 h-4 text-accent" />
              </div>
              <div className="text-left">
                <p className="text-sm font-semibold text-white">{vizLabel}</p>
                <p className="text-xs text-dark-400">
                  {isInitialized ? `${cameraCount.toLocaleString()} cameras` : 'Loading…'}
                </p>
              </div>
            </div>
            <svg className="w-5 h-5 text-dark-400" viewBox="0 0 24 24" fill="currentColor">
              <path d="M7.41 15.41L12 10.83l4.59 4.58L18 14l-6-6-6 6z" />
            </svg>
          </button>
        }
      >
        {snapPoint === 'full' && (
          <div className="pb-8">
            <p className="text-xs text-dark-400 mb-3 leading-relaxed">
              Visualize when ALPR cameras were mapped on <a href="https://www.openstreetmap.org" target="_blank" rel="noopener noreferrer" className="text-accent hover:underline">OSM</a> across the US. Data from <a href="https://deflock.me" target="_blank" rel="noopener noreferrer" className="text-accent hover:underline">DeFlock</a> &amp; OSM contributors. Use the timeline to scrub through when each camera was added. Switch layers below.
            </p>

            {/* Map type dropdown */}
            <div className="mb-3">
              <MapTypeDropdown />
            </div>

            {panelBody()}

            {mapVisualization === 'heatmap' && (
              <div className="mt-6">
                <HeatmapLegend />
              </div>
            )}

            <div className="mt-6 pt-4 border-t border-dark-700/50">
              <p className="text-[10px] text-dark-500 text-center">
                Maps by{' '}
                <a href="https://openroadlabs.org" target="_blank" rel="noopener noreferrer" className="hover:text-dark-300 transition-colors">OpenRoad Labs LLC</a>
              </p>
            </div>
          </div>
        )}
      </BottomSheet>
    );
  }

  // Desktop: Side Panel
  return (
    <div className="hidden lg:block relative h-full">
      <div className={`relative flex flex-col h-full bg-dark-900 border-r border-dark-700/50 ${
        hasAnimated ? 'transition-all duration-300' : ''
      } ${isCollapsed ? 'w-0 overflow-hidden' : 'w-[400px]'}`}>
        {/* 2px download progress line while the GeoJSON streams in */}
        {camerasPending && (
          downloadProgress != null ? (
            <div
              className="absolute top-0 left-0 h-0.5 bg-accent transition-all duration-300 z-10"
              style={{ width: `${downloadProgress}%` }}
            />
          ) : (
            <div className="absolute top-0 left-0 right-0 h-0.5 bg-accent/60 animate-pulse z-10" />
          )
        )}

        {/* Header */}
        <div className="flex-shrink-0 px-6 py-5 border-b border-dark-700/50">
          <h2 className="text-lg font-display font-semibold text-white mb-2">Timeline</h2>
          <p className="text-xs text-dark-400 mb-3 leading-relaxed">
            Visualize when ALPR cameras were mapped on <a href="https://www.openstreetmap.org" target="_blank" rel="noopener noreferrer" className="text-accent hover:underline">OpenStreetMap</a> across the US. Data sourced from <a href="https://deflock.me" target="_blank" rel="noopener noreferrer" className="text-accent hover:underline">DeFlock</a> and OSM contributors. Use the timeline to scrub through when each camera was added to OSM. Switch between Heatmap and Dot Density layers below.
          </p>
          <MapTypeDropdown />
        </div>

        {/* Visualization Controls */}
        <div className="flex-1 overflow-y-auto">
          <div className="p-6">
            {panelBody()}
          </div>
          {mapVisualization === 'heatmap' && (
            <div className="px-6 pb-4">
              <HeatmapLegend />
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="flex-shrink-0 px-6 py-3 border-t border-dark-700/50 bg-dark-800/50">
          <p className="text-[10px] text-dark-500 text-center">
            Maps by{' '}
            <a href="https://openroadlabs.org" target="_blank" rel="noopener noreferrer" className="hover:text-dark-300 transition-colors">OpenRoad Labs LLC</a>
          </p>
        </div>
      </div>

      {/* Expand/Collapse Toggle */}
      <button
        onClick={() => setIsCollapsed(!isCollapsed)}
        className={`absolute z-50 top-1/2 -translate-y-1/2 ${
          hasAnimated ? 'transition-all duration-300' : ''
        } ${isCollapsed ? 'left-0' : 'left-[400px]'} w-6 h-16 bg-dark-800 hover:bg-dark-700 border border-dark-600 border-l-0 rounded-r-lg flex items-center justify-center group`}
        aria-label={isCollapsed ? 'Expand panel' : 'Collapse panel'}
      >
        {isCollapsed ? (
          <ChevronRight className="w-4 h-4 text-dark-300 group-hover:text-white transition-colors" />
        ) : (
          <ChevronLeft className="w-4 h-4 text-dark-300 group-hover:text-white transition-colors" />
        )}
      </button>
    </div>
  );
}
