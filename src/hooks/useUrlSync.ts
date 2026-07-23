import { useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { parseAppUrl, buildAppUrl, type AppUrlState } from '@/utils/urlState';
import { loadStateGeometry, getStateBounds } from '@/services/stateFilterService';
import { COUNTRIES, countryZoomForViewport } from '@/services/cameraDataService';
import { useCameraStore } from '@/store/cameraStore';
import { useMapStore } from '@/store/mapStore';
import { useAppModeStore } from '@/store/appModeStore';

/** Delay before mirroring viewport movement into the URL. */
const VIEWPORT_DEBOUNCE_MS = 500;

function seedStoresFromUrl(parsed: AppUrlState): void {
  if (parsed.country) {
    useCameraStore.setState({ country: parsed.country });
  }
  if (parsed.viewport) {
    useMapStore.setState({
      center: [parsed.viewport.lat, parsed.viewport.lng],
      zoom: parsed.viewport.zoom,
      urlHadViewport: true,
    });
  } else if (parsed.country) {
    // No pinned viewport — start on the linked country, not the US default
    useMapStore.setState({
      center: COUNTRIES[parsed.country].center,
      zoom: countryZoomForViewport(parsed.country),
    });
  }
  if (parsed.mode === 'explore') {
    useAppModeStore.getState().enterTimeline(parsed.viz ?? 'dots');
  } else {
    useAppModeStore.getState().setAppMode(parsed.mode);
  }
}

/**
 * The app's single URL↔state bridge. Call exactly once, from MapPage.
 *
 * Boot: parses the URL (canonical or legacy), seeds all stores before the
 * map mounts, then resolves the state-filter deep link asynchronously.
 *
 * Sync: mirrors store state back into the address bar with one
 * replace-navigate per change — immediately for mode/filter/country/viz
 * changes, debounced for viewport movement. Legacy URLs normalize to the
 * canonical form on the first write. The URL always equals buildShareURL.
 */
export function useUrlSync(): void {
  const navigate = useNavigate();
  const [bootDone, setBootDone] = useState(false);

  // Synchronous seeding before the map mounts (useState initializer runs
  // once), so a ?country=ca link never downloads the US dataset first.
  const [parsed] = useState(() => {
    const p = parseAppUrl(window.location.pathname, window.location.search);
    seedStoresFromUrl(p);
    return p;
  });

  // Async half of boot: the state-filter deep link needs its boundary
  // geometry before the filter applies and the map frames the state.
  useEffect(() => {
    if (!parsed.stateFilter) {
      setBootDone(true);
      return;
    }
    const state = parsed.stateFilter;
    let cancelled = false;
    void loadStateGeometry(state)
      .then((feature) => {
        if (cancelled) return;
        if (feature) {
          useCameraStore.getState().setFilters({ state, showAll: false });
          if (!parsed.viewport) {
            useMapStore.getState().requestFitBounds(getStateBounds(feature));
          }
        }
        setBootDone(true);
      })
      .catch(() => {
        if (!cancelled) setBootDone(true);
      });
    return () => {
      cancelled = true;
    };
  }, [parsed]);

  const center = useMapStore((s) => s.center);
  const zoom = useMapStore((s) => s.zoom);
  const appMode = useAppModeStore((s) => s.appMode);
  const viz = useAppModeStore((s) => s.mapVisualization);
  const country = useCameraStore((s) => s.country);
  const stateFilter = useCameraStore((s) => s.filters.state);
  const lastModeSigRef = useRef<string | null>(null);

  useEffect(() => {
    if (!bootDone) return;

    // Mode-level changes rewrite the URL immediately (a copied link right
    // after a tab switch must be correct); viewport movement debounces.
    const modeSig = [appMode, stateFilter ?? '', country, appMode === 'explore' ? viz : ''].join('|');
    const immediate = lastModeSigRef.current !== null && lastModeSigRef.current !== modeSig;
    lastModeSigRef.current = modeSig;

    const write = () => {
      const target = buildAppUrl();
      if (`${target.pathname}${target.search}` !== `${window.location.pathname}${window.location.search}`) {
        navigate({ pathname: target.pathname, search: target.search }, { replace: true });
      }
    };

    if (immediate) {
      write();
      return;
    }
    const t = setTimeout(write, VIEWPORT_DEBOUNCE_MS);
    return () => clearTimeout(t);
  }, [bootDone, appMode, viz, country, stateFilter, center, zoom, navigate]);
}
