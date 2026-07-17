import { useState, useEffect, useCallback, useRef } from 'react';
import { useRouteStore, useAppModeStore, useCameraStore } from '../../store';
import { useDensityStore } from '../../store/densityStore';
import { useNetworkStore } from '../../store/networkStore';
import type { AppMode } from '../../store';
import { BottomSheet, type SnapPoint } from '../common/BottomSheet';
import { LegacyMapLink } from '../common/LegacyMapLink';
import { isModeAvailable } from '../../services/cameraDataService';
import { AlertTriangle, ChevronUp } from 'lucide-react';
import { RoutePanelContent } from './RoutePanelContent';
import { MobileRoutePreview } from './MobileRoutePreview';
import { FlockHopperCTA } from './FlockHopperCTA';
import { NetworkPanelContent } from './NetworkPanelContent';
import { MapTypeDropdown } from './MapTypeDropdown';
import { HeatmapControls } from '../../modes/heatmap/HeatmapControls';
import { HeatmapLegend } from '../../modes/heatmap/HeatmapLegend';
import { DotDensityControls } from '../../modes/dots/DotDensityControls';
import { DensityControls } from '../../modes/density/DensityControls';
import { DensityLegend } from '../../modes/density/DensityLegend';
import { MapPanelContent } from './MapPanel';

/* ------------------------------------------------------------------ */
/*  Tab definitions                                                    */
/* ------------------------------------------------------------------ */

interface TabDef {
  mode: AppMode;
  label: string;
}

const TABS: TabDef[] = [
  { mode: 'map', label: 'Map' },
  { mode: 'route', label: 'Route' },
  { mode: 'explore', label: 'Timeline' },
  { mode: 'density', label: 'Analysis' },
  { mode: 'network', label: 'Network' },
];

/** Shared drawer footer: legacy-map link (its mobile home now that the
 *  header menu is gone) + attribution. */
function DrawerFooter() {
  return (
    <div className="mt-6 pt-4 border-t border-hairline flex flex-col items-center gap-2">
      <LegacyMapLink variant="menu-item" className="justify-center !py-1 text-xs" />
      <p className="text-[10px] text-dark-500 text-center">
        Maps by{' '}
        <a href="https://openroadlabs.org" target="_blank" rel="noopener noreferrer" className="hover:text-dark-300 transition-colors">OpenRoad Labs LLC</a>
      </p>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/*  MobileTabDrawer                                                    */
/* ------------------------------------------------------------------ */

interface MobileTabDrawerProps {
  onModeChange: (mode: AppMode) => void;
}

export function MobileTabDrawer({ onModeChange }: MobileTabDrawerProps) {
  const [snapPoint, setSnapPoint] = useState<SnapPoint>('minimized');
  const [didAutoExpand, setDidAutoExpand] = useState(false);

  /* ---- stores ---- */
  const { appMode, mapVisualization } = useAppModeStore();
  const { normalRoute, avoidanceRoute } = useRouteStore();
  const hasRoutes = !!(normalRoute && avoidanceRoute);

  // Density store
  const { loadPhase: densityLoadPhase, loadAllLevels: loadDensity, retryLoad: retryDensity, error: densityError } = useDensityStore();

  // Network store — preload data when tab is selected (before drawer expands)
  const loadNetworkData = useNetworkStore(s => s.loadNetworkData);
  const selectedNode = useNetworkStore(s => s.selectedNode);
  const adjacency = useNetworkStore(s => s.adjacency);

  /* ---- country (gates US-only tabs) ---- */
  const country = useCameraStore(s => s.country);

  /* ---- load data on mode switch ---- */
  useEffect(() => {
    if (appMode === 'density') loadDensity();
    if (appMode === 'network') loadNetworkData();
  }, [appMode, loadDensity, loadNetworkData]);

  /* ---- route auto-expand ---- */
  useEffect(() => {
    if (hasRoutes && appMode === 'route' && !didAutoExpand) {
      setSnapPoint('peek');
      setDidAutoExpand(true);
    }
    if (!hasRoutes && didAutoExpand) {
      setDidAutoExpand(false);
    }
  }, [hasRoutes, appMode, didAutoExpand]);

  const densityIsLoading = densityLoadPhase === 'fetching';

  /* ---- callbacks for BottomSheet ---- */
  const handleExpandSheet = useCallback(() => setSnapPoint('full'), []);

  /* ---- tab switch ----
   * The tapped tab highlights this frame (pendingMode); the actual mode
   * switch (store update → layer swaps → panel mounts) is deferred one
   * painted frame so the tap always feels instant. */
  const [pendingMode, setPendingMode] = useState<AppMode | null>(null);
  // Latest requested mode — dedupes same-tab re-taps and lets a newer tap
  // supersede an older one's still-queued deferred switch.
  const latestTabRequestRef = useRef<AppMode | null>(null);

  const handleTabPress = useCallback((mode: AppMode) => {
    if (mode === (latestTabRequestRef.current ?? appMode)) return;
    latestTabRequestRef.current = mode;
    setPendingMode(mode);
    requestAnimationFrame(() => requestAnimationFrame(() => {
      if (latestTabRequestRef.current !== mode) return; // superseded by a newer tap
      latestTabRequestRef.current = null;
      onModeChange(mode);
    }));
    // Keep the drawer at its current snap — do NOT auto-expand on tab tap
  }, [appMode, onModeChange]);

  // Clear the optimistic highlight once the real mode lands (or is bounced,
  // e.g. the Canada US-only guard switching back to 'map').
  useEffect(() => {
    setPendingMode(null);
  }, [appMode]);

  const activeMode = pendingMode ?? appMode;

  /* ---- render controls for explore mode ---- */
  const renderExploreControls = () => {
    switch (mapVisualization) {
      case 'heatmap':
        return <HeatmapControls />;
      case 'dots':
        return <DotDensityControls />;
      default:
        return null;
    }
  };

  /* ================================================================ */
  /*  Header: single-row pill tabs                                     */
  /* ================================================================ */

  const isRoutePeekable = appMode === 'route' && hasRoutes;

  // Map mode's minimized header carries an extra stats/hint row
  const minimizedHeight = appMode === 'map' ? 108 : 80;

  // Resting height feeds --drawer-height so map controls/attribution ride
  // above the sheet. Parked at the peek height while 'full' (controls are
  // behind the sheet then anyway; jumping them to 85vh would look broken).
  const peekHeightForMode = isRoutePeekable ? 210 : minimizedHeight;
  const drawerRestHeight = snapPoint === 'minimized' ? minimizedHeight : peekHeightForMode;

  useEffect(() => {
    const el = document.querySelector<HTMLElement>('.map-page');
    el?.style.setProperty('--drawer-height', `${drawerRestHeight}px`);
  }, [drawerRestHeight]);

  const headerContent = (
    <div>
      <div className="flex items-stretch -mx-4 px-2 border-b border-hairline">
        {TABS.map(({ mode, label }) => {
          const isActive = activeMode === mode;
          const available = isModeAvailable(mode, country);
          return (
            <button
              key={mode}
              onClick={() => available && handleTabPress(mode)}
              disabled={!available}
              aria-disabled={!available}
              className={`relative flex-1 min-w-11 py-2.5 text-2xs font-semibold uppercase tracking-[0.14em] transition-colors ${
                isActive
                  ? 'text-white'
                  : available
                    ? 'text-dark-500 active:text-dark-300'
                    : 'text-dark-600'
              }`}
            >
              {label}
              {isActive && (
                <span className="absolute bottom-0 left-1/2 -translate-x-1/2 w-8 h-[1.5px] bg-accent" />
              )}
            </button>
          );
        })}
      </div>
      {appMode === 'map' && snapPoint === 'minimized' && (
        <div className="mt-2.5 flex items-center justify-center gap-1 text-dark-400 animate-fade-in">
          <ChevronUp className="w-3.5 h-3.5 animate-nudge-up" />
          <span className="text-[11px] font-medium">Swipe up for details</span>
        </div>
      )}
      {isRoutePeekable && snapPoint !== 'minimized' && (
        <div className="mt-3 space-y-3 animate-fade-in">
          <MobileRoutePreview hasRoutes={hasRoutes} onExpand={handleExpandSheet} />
          {snapPoint === 'peek' && <FlockHopperCTA variant="row" />}
        </div>
      )}
    </div>
  );

  /* ================================================================ */
  /*  Tab content (rendered only when snapPoint === 'full')            */
  /* ================================================================ */

  const renderTabContent = () => {
    switch (appMode) {
      /* ---------- MAP ---------- */
      case 'map':
        return (
          <div className="pb-8">
            <MapPanelContent />
            <DrawerFooter />
          </div>
        );

      /* ---------- ROUTE ---------- */
      case 'route':
        return (
          <div className="pb-8">
            <RoutePanelContent />

            <DrawerFooter />
          </div>
        );

      /* ---------- EXPLORE ---------- */
      case 'explore':
        return (
          <div className="pb-8">
            <p className="text-xs text-dark-400 mb-3 leading-relaxed">
              Visualize ALPR camera density across the US. Data from{' '}
              <a href="https://deflock.me" target="_blank" rel="noopener noreferrer" className="text-accent hover:underline">DeFlock</a>
              {' '}&amp;{' '}
              <a href="https://www.openstreetmap.org" target="_blank" rel="noopener noreferrer" className="text-accent hover:underline">OSM</a>
              {' '}contributors. Switch layers below.
            </p>

            <div className="mb-3">
              <MapTypeDropdown />
            </div>

            {renderExploreControls()}

            {mapVisualization === 'heatmap' && (
              <div className="mt-6">
                <HeatmapLegend />
              </div>
            )}

            <DrawerFooter />
          </div>
        );

      /* ---------- DENSITY (Analysis) ---------- */
      case 'density':
        return (
          <div className="pb-8">
            <p className="text-xs text-dark-400 mb-3 leading-relaxed">
              Compare ALPR surveillance intensity by state or county. Data from{' '}
              <a href="https://deflock.me" target="_blank" rel="noopener noreferrer" className="text-accent hover:underline">DeFlock</a>
              {' '}&amp;{' '}
              <a href="https://www.openstreetmap.org" target="_blank" rel="noopener noreferrer" className="text-accent hover:underline">OSM</a>
              {' '}contributors. Tap any region on the map to reveal its statistics.
            </p>

            {densityIsLoading && (
              <div className="flex items-center gap-3 py-4">
                <div className="w-5 h-5 border-2 border-dark-600 border-t-accent rounded-full animate-spin" />
                <span className="text-sm text-dark-300">Loading density data...</span>
              </div>
            )}

            {densityError && (
              <div className="bg-red-900/20 border border-red-500/30 rounded-xl p-4">
                <p className="text-sm text-red-400 mb-2">Failed to load density data</p>
                <p className="text-xs text-dark-500 mb-3">{densityError}</p>
                <button
                  onClick={retryDensity}
                  className="px-3 py-1.5 bg-red-600 hover:bg-red-700 text-white text-xs font-medium rounded-lg transition-colors"
                >
                  Retry
                </button>
              </div>
            )}

            {densityLoadPhase === 'ready' && (
              <>
                <DensityControls />
                <div className="mt-6">
                  <DensityLegend />
                </div>
              </>
            )}

            <DrawerFooter />
          </div>
        );

      /* ---------- NETWORK ---------- */
      case 'network':
        return (
          <div className="pb-8">
            <NetworkPanelContent />
            <DrawerFooter />
          </div>
        );

      default:
        return null;
    }
  };

  /* ================================================================ */
  /*  Render                                                           */
  /* ================================================================ */

  const isNonSharingPortal = appMode === 'network' &&
    selectedNode?.isPortal &&
    (adjacency[selectedNode.id]?.length ?? 0) === 0;
  const showNetworkWarning = isNonSharingPortal && snapPoint !== 'full';

  return (
    <>
      {showNetworkWarning && (
        <button
          onClick={handleExpandSheet}
          className="fixed left-4 z-[52] flex items-center justify-center w-11 h-11 rounded-full bg-amber-500 shadow-lg shadow-amber-500/30 active:bg-amber-600 transition-colors"
          style={{ bottom: 'calc(var(--drawer-height, 80px) + 16px)' }}
          aria-label="View sharing disclaimer"
        >
          <AlertTriangle className="w-5 h-5 text-white" />
        </button>
      )}
      <BottomSheet
        snapPoint={snapPoint}
        onSnapPointChange={setSnapPoint}
        minimizedHeight={minimizedHeight}
        peekHeight={peekHeightForMode}
        fullHeight={85}
        headerContent={headerContent}
        disableHeaderTap
      >
        {snapPoint === 'full' && renderTabContent()}
      </BottomSheet>
    </>
  );
}
