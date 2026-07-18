import { useEffect, useState, useCallback, useRef } from 'react';
import { useSearchParams, useLocation, useNavigate } from 'react-router-dom';
import { MapLibreView, MapSearch, FloatingRouteCard, CameraStats, MapLoadingScreen, type MapLibreViewHandle } from '@/components/map';
import { HeaderCameraCount } from '@/components/map/HeaderCameraCount';
import { RoutePanel } from '@/components/panels';
import { ExplorePanel } from '@/components/panels/ExplorePanel';
import { DensityPanel } from '@/components/panels/DensityPanel';
import { NetworkPanel } from '@/components/panels/NetworkPanel';
import { MapPanel } from '@/components/panels/MapPanel';
import { MobileTabDrawer } from '@/components/panels/MobileTabDrawer';
import { DensityLegendBar } from '@/components/map/DensityLegendBar';
import { NetworkAgencyCount } from '@/components/map/NetworkAgencyCount';
import { NetworkLoadingPill } from '@/components/map/NetworkLoadingPill';
import { DensityLoadingPill } from '@/components/map/DensityLoadingPill';
import { Seo, LegacyMapLink, ShareButton, LoadingPill } from '@/components/common';
import { parseViewportFromURL, parseCountryFromURL, parseStateFromURL, writeViewportParams } from '@/utils/urlParams';
import { loadStateGeometry, getStateBounds, stateFromSlug, stateSlug, getStateName } from '@/services/stateFilterService';
import { COUNTRIES, countryZoomForViewport, isModeAvailable } from '@/services/cameraDataService';
import { isWebGLAvailable } from '@/utils/webgl';
import { removeBootSplash } from '@/utils/bootSplash';
import { useCameraStore, useMapStore, useAppModeStore } from '@/store';
import { useEmbedMode } from '@/hooks/useEmbedMode';
import { useCameraRenderMode } from '@/hooks/useCameraRenderMode';
import { useIsMobile } from '@/hooks/useIsMobile';
import { MapStyleControl } from '@/components/map/MapStyleControl';
import { CameraFilterControl } from '@/components/map/CameraFilterControl';
import { MapThemeControl } from '@/components/map/MapThemeControl';
import { TimelineBar } from '@/modes/timeline/TimelineBar';
import { TIMELINE_START } from '@/modes/timeline/timelineUtils';
import { DensityFeaturePopup } from '@/modes/density/DensityFeaturePopup';
import { Route, Compass, BarChart3, Network, Map as MapIcon } from 'lucide-react';
import type { AppMode } from '@/store';

const WEBGL_REQUIRED_MESSAGE =
  'WebGL is required to display the interactive map. Please enable hardware acceleration in your browser settings, then reload the page.';

const MODE_LABELS: Record<AppMode, { icon: typeof Route; label: string }> = {
  map: { icon: MapIcon, label: 'Map' },
  route: { icon: Route, label: 'Route' },
  explore: { icon: Compass, label: 'Timeline' },
  density: { icon: BarChart3, label: 'Analysis' },
  network: { icon: Network, label: 'Network' },
};

export function MapPage() {
  const {
    retryCameraLoad,
    isInitialized,
    cameras,
    country,
  } = useCameraStore();
  const center = useMapStore(s => s.center);
  const zoom = useMapStore(s => s.zoom);
  const appMode = useAppModeStore(s => s.appMode);
  const mapVisualization = useAppModeStore(s => s.mapVisualization);
  const setAppMode = useAppModeStore(s => s.setAppMode);
  const isEmbed = useEmbedMode();
  const updateTimelineSettings = useAppModeStore(s => s.updateTimelineSettings);
  const [searchParams, setSearchParams] = useSearchParams();
  const location = useLocation();
  const navigate = useNavigate();
  const isExplorePath = location.pathname === '/explore';
  const isTimelinePath = location.pathname === '/timeline';
  const isAnalysisPath = location.pathname === '/analysis';
  const isNetworkPath = location.pathname === '/network';
  const isRoutePath = location.pathname === '/route';
  const isExploreMode = appMode === 'explore';
  const hasAutoPlayed = useRef(false);

  // Seed map viewport + country from URL params once, before MapLibreContainer
  // mounts and before the camera load starts (so a ?country=ca link fetches
  // the Canadian dataset directly and never downloads the US one).
  // useState initializer runs once — sets stores synchronously.
  useState(() => {
    const params = new URLSearchParams(window.location.search);
    const urlCountry = parseCountryFromURL(params);
    if (urlCountry) {
      useCameraStore.setState({ country: urlCountry });
    }
    const viewport = parseViewportFromURL(params);
    if (viewport) {
      useMapStore.setState({ center: [viewport.lat, viewport.lng], zoom: viewport.zoom });
    } else if (urlCountry) {
      // No explicit viewport — start on the linked country instead of the US default
      useMapStore.setState({
        center: COUNTRIES[urlCountry].center,
        zoom: countryZoomForViewport(urlCountry),
      });
    }
  });

  // Deep link: /state/texas (or /state/tx, or legacy ?state=TX) applies the
  // state filter and frames the state (unless the URL also pins an explicit
  // viewport). Runs once on mount.
  const stateBootDone = useRef(false);
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const pathMatch = window.location.pathname.match(/^\/state\/([^/]+)\/?$/);
    const state = stateFromSlug(pathMatch?.[1]) ?? parseStateFromURL(params);
    if (!state) {
      stateBootDone.current = true;
      return;
    }
    const hasExplicitViewport = parseViewportFromURL(params) !== null;
    let cancelled = false;
    void loadStateGeometry(state)
      .then((feature) => {
        if (cancelled) return;
        if (feature) {
          useCameraStore.getState().setFilters({ state, showAll: false });
          if (!hasExplicitViewport) {
            useMapStore.getState().requestFitBounds(getStateBounds(feature));
          }
        }
        stateBootDone.current = true;
      })
      .catch(() => { stateBootDone.current = true; });
    return () => { cancelled = true; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Canonical state path: in map mode the pathname mirrors the state filter
  // (/state/texas ↔ filter set, / ↔ cleared). Never fights other modes'
  // paths — only rewrites when already on a map-mode path.
  const stateFilter = useCameraStore(s => s.filters.state);
  useEffect(() => {
    if (appMode !== 'map') return;
    const path = window.location.pathname;
    const onMapPath = path === '/' || path === '/map' || path.startsWith('/state/');
    if (!onMapPath) return;
    // A valid /state/... path whose filter hasn't applied yet means the boot
    // effect is still loading the boundary — don't strip the path from under
    // it (StrictMode re-runs the boot effect and would re-read a bare '/').
    // Once boot settles, a filterless state path is a cleared filter → '/'.
    const pathState = stateFromSlug(path.match(/^\/state\/([^/]+)\/?$/)?.[1]);
    if (pathState && !stateFilter && !stateBootDone.current) return;
    const desired = stateFilter ? `/state/${stateSlug(stateFilter)}` : '/';
    if (path !== desired) {
      navigate({ pathname: desired, search: window.location.search }, { replace: true });
    }
  }, [appMode, stateFilter, navigate]);

  // Debounced live URL sync: mirrors whatever buildShareURL would produce,
  // so copying the address bar equals clicking Share.
  useEffect(() => {
    const t = setTimeout(() => {
      setSearchParams(prev => writeViewportParams(new URLSearchParams(prev)), { replace: true });
    }, 500);
    return () => clearTimeout(t);
  }, [center, zoom, appMode, mapVisualization, country, stateFilter, setSearchParams]);

  const isMobile = useIsMobile();

  // Sync URL params with app mode on mount
  useEffect(() => {
    const vizParam = searchParams.get('viz');
    const viz = vizParam === 'heatmap' ? 'heatmap' : 'dots';

    if (isAnalysisPath) {
      setAppMode('density');
    } else if (isExplorePath || isTimelinePath) {
      useAppModeStore.setState({
        appMode: 'explore',
        mapVisualization: viz,
        timelineSettings: {
          currentDate: isTimelinePath ? TIMELINE_START : new Date().toISOString().slice(0, 10),
          isPlaying: false,
          playSpeed: 45,
        },
      });
    } else if (isNetworkPath) {
      setAppMode('network');
    } else if (isRoutePath) {
      setAppMode('route');
    } else {
      const urlMode = searchParams.get('mode');
      if (urlMode === 'route') {
        setAppMode('route');
      } else if (urlMode === 'explore') {
        setAppMode('explore');
      } else if (urlMode === 'density') {
        setAppMode('density');
      } else if (urlMode === 'network') {
        setAppMode('network');
      } else {
        setAppMode('map');
      }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Update URL when mode changes
  const handleSetAppMode = useCallback((mode: AppMode) => {
    if (mode === 'explore') {
      // Set timeline state directly — bypass setAppMode which defaults to today's date
      useAppModeStore.setState({
        appMode: 'explore',
        mapVisualization: 'dots',
        timelineSettings: {
          currentDate: TIMELINE_START,
          isPlaying: false,
          playSpeed: 45,
        },
      });
      hasAutoPlayed.current = false;
      navigate('/timeline', { replace: true });
    } else if (mode === 'map') {
      setAppMode(mode);
      setSearchParams({}, { replace: true });
    } else if (mode === 'route') {
      setAppMode(mode);
      setSearchParams({ mode: 'route' }, { replace: true });
    } else if (mode === 'density') {
      setAppMode(mode);
      setSearchParams({ mode: 'density' }, { replace: true });
    } else if (mode === 'network') {
      setAppMode(mode);
      setSearchParams({ mode: 'network' }, { replace: true });
    }
  }, [setAppMode, setSearchParams, navigate]);

  // US-only modes (Route/Analysis/Network): bounce back to Map when Canada
  // is active — covers the country switcher, deep links, and URL edits
  useEffect(() => {
    if (!isModeAvailable(appMode, country)) {
      handleSetAppMode('map');
    }
  }, [appMode, country, handleSetAppMode]);

  // Track map markers ready state
  const [markersReady, setMarkersReady] = useState(false);
  const [mapKey, setMapKey] = useState(0);
  const [mapInitError, setMapInitError] = useState<string | null>(null);
  const mapRef = useRef<MapLibreViewHandle>(null);
  const mapInitDeadlineRef = useRef<ReturnType<typeof setTimeout>>();

  // Reset UI state on mount (handles stale state from previous navigation)
  // and probe for WebGL before doing any work — without it the map cannot
  // render. Camera JSON is no longer fetched here: tiles are the default
  // rendering path and need no JSON at all, and useCameraRenderMode()
  // lazily triggers ensureCamerasLoaded() the moment a feature actually
  // needs the dataset (filters/timeline/heatmap/Canada).
  useEffect(() => {
    if (import.meta.env.DEV) {
      console.log('[MapPage] Component mounted');
    }

    removeBootSplash();
    setMarkersReady(false);
    setMapInitError(null);

    if (!isWebGLAvailable()) {
      setMapInitError(WEBGL_REQUIRED_MESSAGE);
      if (import.meta.env.DEV) {
        console.warn('[MapPage] WebGL not available — surfacing error UI');
      }
    }
  }, []);

  const { needsGeojson } = useCameraRenderMode();

  // Map-init deadline: if markers don't become ready within 15s, treat the
  // map init as failed and surface the existing error UI (Try Again + Legacy
  // Maps Link). Arms on either rendering path:
  // - geojson: after the dataset is hydrated (isInitialized && cameras)
  // - tiles: immediately (!needsGeojson) — a silently stalled pmtiles load
  //   emits neither sourcedata nor 'error' events, so without this the
  //   loading screen would spin forever with no retry UI.
  // The inner retry pipeline in MapLibreContainer keeps event listeners
  // attached for the full duration, so a successful late init before the
  // deadline still clears markersReady (which also clears this timer).
  useEffect(() => {
    const watchdogArmed = !needsGeojson || (isInitialized && cameras.length > 0);
    if (watchdogArmed && !markersReady && !mapInitError) {
      mapInitDeadlineRef.current = setTimeout(() => {
        if (!markersReady) {
          setMapInitError('Map failed to initialize. Please try again.');
          if (import.meta.env.DEV) {
            console.warn('[MapPage] Map init deadline exceeded (15s) — surfacing error UI');
          }
        }
      }, 15000);

      return () => {
        if (mapInitDeadlineRef.current) {
          clearTimeout(mapInitDeadlineRef.current);
        }
      };
    }
  }, [needsGeojson, isInitialized, cameras.length, markersReady, mapInitError]);

  // Handle markers ready callback from MapLibreView
  const handleMarkersReady = useCallback((ready: boolean) => {
    if (import.meta.env.DEV) {
      console.log(`[MapPage] Markers ready: ${ready}`);
    }
    setMarkersReady(ready);
    if (ready) {
      setMapInitError(null);
    }
  }, []);

  // Handle retry with map remount
  const handleRetryWithRemount = useCallback(async () => {
    if (import.meta.env.DEV) {
      console.log('[MapPage] Retry with remount requested');
    }

    // Re-probe WebGL on every retry — if it's still unavailable, surface the
    // same WebGL-specific message and skip the camera refetch / remount.
    if (!isWebGLAvailable()) {
      setMapInitError(WEBGL_REQUIRED_MESSAGE);
      if (import.meta.env.DEV) {
        console.warn('[MapPage] Retry: WebGL still not available');
      }
      return;
    }

    setMapInitError(null);
    setMarkersReady(false);
    // Force map remount with new key — unconditional, always the recovery
    // path for a stalled tile source. The (multi-MB) GeoJSON refetch only
    // helps when a feature actually needs it (filters/timeline/heatmap/Canada);
    // skip it in tiles mode where the remount alone drives recovery.
    setMapKey(k => k + 1);

    if (needsGeojson) {
      try {
        await retryCameraLoad();
      } catch {
        // Error handling done in store
      }
    }
  }, [retryCameraLoad, needsGeojson]);

  // Tiles mode: the map is "ready" when the tile source has rendered
  // (markersReady). The JSON dataset only gates readiness when a feature
  // actually needs it (filters/timeline/heatmap/Canada).
  const camerasReady = needsGeojson ? (isInitialized && cameras.length > 0) : true;
  const isFullyReady = camerasReady && markersReady;

  // The pill covers GeoJSON loads with no visible panel to host a skeleton:
  // mobile, and any non-explore desktop context (heatmap/filters/Canada).
  // Desktop Timeline gets an in-panel skeleton instead (ExplorePanel).
  // Deliberately NOT gated on !camerasReady: camerasReady flips true in the
  // same atomic store commit as loadPhase → 'ready', so gating on it here
  // would unmount the pill before it can render its own "N cameras ready"
  // completion flash. The pill owns its own visibility (idle/ready-without-
  // flash → null) so it's safe to keep mounted through the ready transition.
  const showCameraPill =
    needsGeojson && !mapInitError &&
    (isMobile || appMode !== 'explore');

  // /timeline path: auto-play dot density animation once map is ready
  useEffect(() => {
    if (isTimelinePath && isFullyReady && !hasAutoPlayed.current) {
      hasAutoPlayed.current = true;
      // Short delay so TimelineBar mounts and registers the tick callback
      const timer = setTimeout(() => {
        updateTimelineSettings({ isPlaying: true });
      }, 200);
      return () => clearTimeout(timer);
    }
  }, [isTimelinePath, isFullyReady, updateTimelineSettings]);

  const seo = stateFilter ? (
    <Seo
      title={`${getStateName(stateFilter)} ALPR Cameras | DeFlock Maps`}
      description={`Map of known ALPR (license plate reader) cameras in ${getStateName(stateFilter)}, with brand breakdowns and privacy-optimized routing.`}
      path={`/state/${stateSlug(stateFilter)}`}
    />
  ) : (
    <Seo
      title="DeFlock Maps | ALPR Camera Map & Privacy Routes"
      description="Explore the national ALPR camera map and compare direct routes with privacy-optimized alternatives."
      path="/"
    />
  );

  return (
    <>
      {seo}
      {/* Full-screen overlay is error-only: WebGL missing, watchdog timeout,
          or tile-source stall. GeoJSON loads surface in-panel / as a pill. */}
      {mapInitError && (
        <MapLoadingScreen error={mapInitError} onRetry={handleRetryWithRemount} />
      )}
      <div className={`map-page h-screen supports-[height:100dvh]:h-[100dvh] w-screen flex flex-col bg-dark-900 overflow-hidden ${appMode === 'map' ? 'map-mode-active' : ''}`}>
        {/* Header - hidden in embed mode */}
        {!isEmbed && (
        <header className="h-[38px] lg:h-12 bg-dark-900 border-b border-hairline flex items-center z-50 shrink-0">
          <div className="w-full px-4 lg:px-5">
            <div className="flex items-center justify-between h-full">
              {/* Logo + Product Switcher */}
              <div className="flex items-center gap-1.5 flex-shrink-0">
                <a
                  href="https://deflock.org"
                  rel="noopener noreferrer"
                  className="flex items-center gap-2"
                >
                  <img
                    src="/deflock-icon.png"
                    alt="DeFlock Icon"
                    className="h-5 lg:h-8 w-auto object-contain"
                  />
                  <img
                    src="/deflock-logo.svg"
                    alt="DeFlock Logo"
                    className="h-5 lg:h-8 w-auto object-contain"
                  />
                  <span className="text-dark-400 text-[11px] font-medium tracking-[0.2em] uppercase hidden sm:inline self-end mb-[3px]">Maps</span>
                </a>
              </div>

              {/* Desktop: Mode tabs - editorial underline style */}
              <nav className="hidden lg:flex items-center gap-6" aria-label="App modes">
                {(Object.entries(MODE_LABELS) as [AppMode, typeof MODE_LABELS[AppMode]][]).map(([mode, { label }]) => {
                  const available = isModeAvailable(mode, country);
                  return (
                    <button
                      key={mode}
                      onClick={() => available && handleSetAppMode(mode)}
                      disabled={!available}
                      title={available ? undefined : 'Available in the US only'}
                      className={`relative text-sm font-medium uppercase tracking-widest pb-1 transition-colors duration-150 ${
                        appMode === mode
                          ? 'text-accent'
                          : available
                            ? 'text-dark-200 hover:text-white'
                            : 'text-dark-600 cursor-not-allowed'
                      }`}
                      aria-current={appMode === mode ? 'page' : undefined}
                    >
                      {label}
                      {appMode === mode && (
                        <span className="absolute bottom-0 left-0 right-0 h-[1.5px] bg-accent" />
                      )}
                    </button>
                  );
                })}
              </nav>

              {/* Mobile: live count + share. No count on Timeline/Analysis —
                  "in view" ignores the timeline date and Analysis shows
                  choropleths, not cameras. */}
              <div className="lg:hidden flex items-center gap-2 h-full">
                {appMode !== 'explore' && appMode !== 'density' && <HeaderCameraCount />}
                <ShareButton variant="icon" className="-mr-2" />
              </div>

              <div className="hidden lg:flex items-center gap-4 flex-shrink-0">
                <ShareButton variant="header" />
                <div className="w-px h-4 bg-dark-600" />
                <LegacyMapLink variant="header" />
              </div>
            </div>
          </div>
        </header>
        )} {/* end !isEmbed header */}

        {/* Main Content */}
        <div className="flex-1 flex overflow-hidden relative">
          {/* Mobile: unified tabbed drawer */}
          {isMobile && <MobileTabDrawer onModeChange={handleSetAppMode} />}

          {/* Desktop: individual side panels */}
          {!isMobile && appMode === 'map' && <MapPanel />}
          {!isMobile && appMode === 'route' && <RoutePanel />}
          {!isMobile && appMode === 'explore' && <ExplorePanel />}
          {!isMobile && appMode === 'density' && <DensityPanel />}
          {!isMobile && appMode === 'network' && <NetworkPanel />}

          {/* Map */}
          <main className="flex-1 relative w-full lg:w-auto">
            <h1 className="sr-only">DeFlock ALPR Camera Map</h1>
            {/* Map fades in on first render instead of popping */}
            <div className={`absolute inset-0 transition-opacity duration-300 ${markersReady ? 'opacity-100' : 'opacity-0'}`}>
              <MapLibreView
                ref={mapRef}
                mapKey={mapKey}
                onMarkersReady={handleMarkersReady}
              />
            </div>

            {/* Map Overlays */}
            {!isEmbed && (appMode === 'route' ? <FloatingRouteCard /> : <MapSearch />)}
            {/* Camera-count overlay only where it's meaningful: route mode.
                Timeline's count ignores the scrubbed date; Analysis renders
                choropleths, not cameras. */}
            {appMode === 'network' ? <NetworkAgencyCount /> : appMode === 'route' ? <CameraStats /> : null}
            <MapStyleControl />
            {showCameraPill && <LoadingPill />}
            {appMode === 'network' && <NetworkLoadingPill />}
            {appMode === 'density' && <DensityLoadingPill />}
            <MapThemeControl />
            <CameraFilterControl />

            {/* Density feature popup — floating stats card */}
            {appMode === 'density' && <DensityFeaturePopup />}

            {/* Density legend bar — horizontal bottom overlay */}
            {appMode === 'density' && <DensityLegendBar />}


            {/* Map Legend - route mode only (explore/density legends live in side panel) */}
            {appMode === 'route' && (
              <div className="absolute bottom-6 left-[68px] z-20 hidden lg:flex flex-col gap-2">
                <div className="bg-dark-800/90 rounded-md px-3 py-2 border border-dark-600">
                  <div className="flex items-center gap-4 text-sm">
                    <div className="flex items-center gap-2">
                      <div className="w-3 h-3 rounded-full bg-accent shadow-[0_0_8px_rgba(56,189,248,0.3)]"></div>
                      <span className="text-dark-100">ALPR Camera</span>
                    </div>
                    <div className="w-px h-5 bg-dark-600"></div>
                    <div className="flex items-center gap-2">
                      <div className="w-6 h-1 rounded-full bg-orange-500 shadow-[0_0_6px_rgba(249,115,22,0.5)]" style={{backgroundImage: 'repeating-linear-gradient(90deg, #f97316 0, #f97316 4px, transparent 4px, transparent 7px)'}}></div>
                      <span className="text-dark-100">Direct Route</span>
                    </div>
                    <div className="w-px h-5 bg-dark-600"></div>
                    <div className="flex items-center gap-2">
                      <div className="w-6 h-1 rounded-full bg-success shadow-[0_0_6px_rgba(34,197,94,0.5)]"></div>
                      <span className="text-dark-100">Privacy Route</span>
                    </div>
                  </div>
                </div>
              </div>
            )}

            {/* Map mode legend */}
            {appMode === 'map' && (
              <div className="absolute bottom-6 left-[68px] z-20 hidden lg:flex flex-col gap-2">
                <div className="bg-dark-800/90 rounded-md px-3 py-2 border border-dark-600">
                  <div className="flex items-center gap-4 text-sm">
                    <div className="flex items-center gap-2">
                      <div className="w-3 h-3 rounded-full bg-accent shadow-[0_0_8px_rgba(56,189,248,0.3)]"></div>
                      <span className="text-dark-100">ALPR Camera</span>
                    </div>
                  </div>
                </div>
              </div>
            )}

            {/* Timeline Bar — desktop only; on mobile the scrubber lives in the drawer peek */}
            {isExploreMode && !isMobile && isInitialized && (
              <div className="timeline-bar-desktop absolute bottom-4 left-4 right-20 z-20 h-14 bg-dark-900/70 backdrop-blur-xl rounded-xl border border-white/[0.06] shadow-lg shadow-black/30">
                <TimelineBar />
              </div>
            )}
          </main>
        </div>
      </div>
    </>
  );
}
