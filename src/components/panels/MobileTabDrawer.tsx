import { useState, useEffect, useCallback, useRef } from 'react';
import { useRouteStore, useAppModeStore, useCameraStore } from '../../store';
import { useDensityStore } from '../../store/densityStore';
import { useNetworkStore } from '../../store/networkStore';
import type { AppMode } from '../../store';
import { BottomSheet, type SnapPoint } from '../common/BottomSheet';
import { LegacyMapLink } from '../common/LegacyMapLink';
import { isModeAvailable } from '../../services/cameraDataService';
import { AlertTriangle, ChevronUp, BarChart3, Navigation2, Share2 } from 'lucide-react';
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
import { DensityFeatureStats } from '../../modes/density/DensityFeatureStats';
import { MapPanelContent } from './MapPanel';
import { DENSITY_COLOR_RAMPS } from '../map/layers/DensityLayers';

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

const PEEK: Partial<Record<AppMode, { title: string; desc: string; Icon: typeof BarChart3 }>> = {
  // route renders the FlockHopper line instead of IdentityRow; entry kept so the peek effects treat route as peekable
  route:   { title: 'Route', desc: 'Set a start and destination to see ALPR exposure along your route — and safer alternatives.', Icon: Navigation2 },
  density: { title: 'Surveillance Analysis', desc: 'Compare surveillance intensity by state or county. Tap any region to reveal its statistics.', Icon: BarChart3 },
  network: { title: 'Sharing Network', desc: 'See which agencies share ALPR data with each other. Tap an agency to trace its connections.', Icon: Share2 },
};

const MODE_PEEK_HEIGHT: Partial<Record<AppMode, number>> = { route: 122, density: 168, network: 140 };

/** Mode identity at peek. The whole row is the expand affordance — icon,
 *  real title, one-liner, chevron. */
function IdentityRow({ mode, onExpand, extra }: { mode: AppMode; onExpand: () => void; extra?: React.ReactNode }) {
  const cfg = PEEK[mode];
  if (!cfg) return null;
  const Icon = cfg.Icon;
  return (
    <div className="mt-3 animate-fade-in">
      <button
        onClick={onExpand}
        className="w-full flex items-center gap-3 text-left active:opacity-70 transition-opacity min-h-11"
        aria-label={`${cfg.title} — open controls and details`}
      >
        <div className="w-9 h-9 rounded-lg bg-accent-muted border border-accent/30 flex items-center justify-center flex-shrink-0">
          <Icon className="w-[18px] h-[18px] text-accent" aria-hidden="true" />
        </div>
        <div className="flex-1 min-w-0">
          <h2 className="text-[15px] font-display font-semibold text-white leading-tight">{cfg.title}</h2>
          <p className="text-xs text-dark-400 leading-snug mt-0.5">{cfg.desc}</p>
        </div>
        <ChevronUp className="w-4 h-4 text-dark-500 flex-shrink-0" aria-hidden="true" />
      </button>
      {extra}
    </div>
  );
}

/** Slim gradient legend inside the Analysis peek (replaces the floating
 *  legend bar on mobile). */
function DensityPeekLegend() {
  const { densitySettings } = useAppModeStore();
  const label = densitySettings.metric === 'perCapita' ? 'Cameras per 10K residents' : 'Cameras per road mile';
  const gradient = DENSITY_COLOR_RAMPS[densitySettings.colorScheme].gradient.replace('90deg', 'to right');
  return (
    <div className="mt-3">
      <div className="flex items-center gap-2">
        <span className="text-2xs text-dark-500 uppercase">Low</span>
        <div className="h-2 rounded-full flex-1" style={{ background: gradient }} />
        <span className="text-2xs text-dark-500 uppercase">High</span>
      </div>
      <p className="text-[10px] text-dark-500 mt-1">{label}</p>
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
  const selectedDensityFeature = useDensityStore(s => s.selectedFeature);
  const setSelectedDensityFeature = useDensityStore(s => s.setSelectedFeature);

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

  // Entering a mode that has an identity peek from the minimized state
  // raises the sheet to peek — covers tab taps AND deep links, and never
  // fights a user who deliberately expanded or is mid-gesture.
  useEffect(() => {
    if (PEEK[appMode] && snapPoint === 'minimized') {
      setSnapPoint('peek');
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [appMode]);

  // Tapping a region on the map surfaces its stats at the detail peek.
  // Only ever raises: never yanks a deliberately-expanded (full) sheet down,
  // including when re-entering Analysis with a lingering selection.
  useEffect(() => {
    if (appMode === 'density' && selectedDensityFeature && snapPoint !== 'full') {
      setSnapPoint('peek');
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedDensityFeature, appMode]);

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

  // Map mode's minimized header carries the swipe-up hint row
  const minimizedHeight = appMode === 'map' ? 108 : 80;

  // Resting height feeds --drawer-height so map controls/attribution ride
  // above the sheet. Parked at the peek height while 'full' (controls are
  // behind the sheet then anyway; jumping them to 85vh would look broken).
  // A selected Analysis region raises the peek to a detail height that fits
  // the stats while keeping the map (and the tapped region) visible above.
  const isDensityDetail = appMode === 'density' && !!selectedDensityFeature;
  const densityDetailHeight = Math.min(430, Math.round(window.innerHeight * 0.62));
  const peekHeightForMode = isDensityDetail
    ? densityDetailHeight
    : appMode === 'route' && hasRoutes
      ? 186 // route preview + slim FlockHopper line, measured in-browser (390x844 viewport)
      : (MODE_PEEK_HEIGHT[appMode] ?? minimizedHeight);
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
      {snapPoint === 'peek' && (
        appMode === 'route' ? (
          <div className="mt-3 space-y-3 animate-fade-in">
            {hasRoutes && <MobileRoutePreview hasRoutes={hasRoutes} onExpand={handleExpandSheet} />}
            <FlockHopperCTA variant="line" />
          </div>
        ) : isDensityDetail ? (
          <div className="mt-3 animate-fade-in">
            <DensityFeatureStats
              feature={selectedDensityFeature!}
              onClose={() => setSelectedDensityFeature(null)}
            />
            <DensityPeekLegend />
          </div>
        ) : (
          <IdentityRow
            mode={appMode}
            onExpand={handleExpandSheet}
            extra={appMode === 'density' ? <DensityPeekLegend /> : undefined}
          />
        )
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
            {selectedDensityFeature && (
              <div className="mb-5 pb-5 border-b border-hairline">
                <DensityFeatureStats
                  feature={selectedDensityFeature}
                  onClose={() => setSelectedDensityFeature(null)}
                />
              </div>
            )}

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
