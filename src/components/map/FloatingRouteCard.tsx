import { useState, useRef, useEffect, useCallback } from 'react';
import { useRouteStore, useMapStore } from '../../store';
import { smartSearch, toLocation, type GeocodingResult } from '../../services/geocodingService';

type Field = 'origin' | 'destination';
type GeoState = 'idle' | 'loading' | 'error';

/**
 * Floating route inputs rendered over the map on the Route tab.
 * Replaces MapSearch there. Two connected rows (start / destination),
 * Enter-to-search with a dropdown below the card, use-my-location on the
 * start row, swap on the divider, and a guided "Choose on map" sequence
 * button under the card.
 * Auto-calculates when both endpoints are set.
 */
export function FloatingRouteCard() {
  const {
    origin,
    destination,
    setOrigin,
    setDestination,
    swapLocations,
    calculateRoutes,
    isCalculating,
    error: routeError,
    normalRoute,
    startPickingLocation,
  } = useRouteStore();
  const flyTo = useMapStore(s => s.flyTo);

  const [originQuery, setOriginQuery] = useState('');
  const [destQuery, setDestQuery] = useState('');
  const [activeField, setActiveField] = useState<Field | null>(null);
  const [results, setResults] = useState<GeocodingResult[]>([]);
  const [isSearching, setIsSearching] = useState(false);
  const [searchError, setSearchError] = useState<string | null>(null);
  const [geoState, setGeoState] = useState<GeoState>('idle');

  const containerRef = useRef<HTMLDivElement>(null);
  const abortRef = useRef<AbortController | null>(null);

  /* Keep input text in sync with the store (swap, choose-on-map,
     geolocation, "Start over" all mutate the store from outside). */
  useEffect(() => {
    setOriginQuery(origin?.name ?? '');
  }, [origin]);
  useEffect(() => {
    setDestQuery(destination?.name ?? '');
  }, [destination]);

  /* Uncommitted text must not outlive the dropdown: closing without a
     selection reverts inputs to the committed store values. */
  const revertQueries = useCallback(() => {
    setOriginQuery(origin?.name ?? '');
    setDestQuery(destination?.name ?? '');
  }, [origin, destination]);

  /* Auto-calculate: setOrigin/setDestination clear routes AND error, so
     "both set, no routes, no error, not calculating" === needs calculation.
     The error guard prevents infinite retries after a failed calculation. */
  useEffect(() => {
    if (origin && destination && !normalRoute && !isCalculating && !routeError) {
      calculateRoutes();
    }
  }, [origin, destination, normalRoute, isCalculating, routeError, calculateRoutes]);

  /* Close dropdown on outside click, reverting any uncommitted text. */
  useEffect(() => {
    const onDown = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        revertQueries();
        setActiveField(null);
        setResults([]);
      }
    };
    document.addEventListener('mousedown', onDown);
    return () => document.removeEventListener('mousedown', onDown);
  }, [revertQueries]);

  useEffect(() => () => abortRef.current?.abort(), []);

  const performSearch = useCallback(async (field: Field, query: string) => {
    abortRef.current?.abort();
    const trimmed = query.trim();
    if (trimmed.length < 2) return;
    setActiveField(field);
    setIsSearching(true);
    setSearchError(null);
    abortRef.current = new AbortController();
    try {
      const found = await smartSearch(trimmed, 'routing', abortRef.current.signal);
      setResults(found);
      if (found.length === 0) setSearchError('No results');
    } catch (err) {
      if (err instanceof Error && err.name === 'AbortError') return;
      setSearchError('Search failed. Please try again.');
      setResults([]);
    } finally {
      setIsSearching(false);
    }
  }, []);

  const selectLocation = useCallback((field: Field, result: GeocodingResult) => {
    const location = toLocation(result);
    if (field === 'origin') {
      setOrigin(location);
      flyTo([location.lat, location.lon], 13);
    } else {
      setDestination(location);
    }
    setActiveField(null);
    setResults([]);
    setSearchError(null);
  }, [setOrigin, setDestination, flyTo]);

  const clearField = useCallback((field: Field) => {
    if (field === 'origin') {
      setOrigin(null);
      setOriginQuery('');
    } else {
      setDestination(null);
      setDestQuery('');
    }
    setResults([]);
    setSearchError(null);
  }, [setOrigin, setDestination]);

  const handleUseMyLocation = useCallback(() => {
    if (!navigator.geolocation) {
      setGeoState('error');
      setTimeout(() => setGeoState('idle'), 3000);
      return;
    }
    setGeoState('loading');
    navigator.geolocation.getCurrentPosition(
      (position) => {
        const { latitude: lat, longitude: lon } = position.coords;
        setOrigin({ lat, lon, name: 'Current location', address: `${lat.toFixed(5)}, ${lon.toFixed(5)}` });
        flyTo([lat, lon], 13);
        setGeoState('idle');
        setActiveField(null);
        setResults([]);
      },
      () => {
        setGeoState('error');
        setTimeout(() => setGeoState('idle'), 3000);
      },
      { enableHighAccuracy: true, timeout: 15000, maximumAge: 60000 }
    );
  }, [setOrigin, flyTo]);

  const handleChooseOnMap = useCallback(() => {
    const field = activeField;
    revertQueries();
    setActiveField(null);
    setResults([]);
    setSearchError(null);
    if (field) startPickingLocation(field);
  }, [activeField, revertQueries, startPickingLocation]);

  const handleQueryChange = (field: Field) => (e: React.ChangeEvent<HTMLInputElement>) => {
    abortRef.current?.abort();
    if (field === 'origin') setOriginQuery(e.target.value);
    else setDestQuery(e.target.value);
    if (results.length > 0 || searchError) {
      setResults([]);
      setSearchError(null);
    }
  };

  const handleKeyDown = (field: Field, query: string) => (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      if (activeField === field && results.length > 0) {
        selectLocation(field, results[0]);
      } else {
        performSearch(field, query);
      }
    }
    if (e.key === 'Escape') {
      revertQueries();
      setActiveField(null);
      setResults([]);
    }
  };

  const openField = (field: Field) => {
    if (activeField && activeField !== field) revertQueries();
    setActiveField(field);
    setResults([]);
    setSearchError(null);
  };

  const activeQuery = activeField === 'origin' ? originQuery : destQuery;
  const committedName = activeField === 'origin' ? origin?.name ?? '' : destination?.name ?? '';
  const showSearchAction =
    activeField !== null &&
    activeQuery.trim().length >= 2 &&
    activeQuery.trim() !== committedName &&
    results.length === 0 &&
    !searchError;

  const activeFieldIsEmpty = activeField !== null && activeQuery.trim().length === 0;

  const dropdownOpen =
    activeField !== null &&
    (activeFieldIsEmpty || showSearchAction || isSearching || results.length > 0 || searchError !== null);

  return (
    <div
      ref={containerRef}
      className="absolute top-3 left-3 right-3 lg:top-4 lg:left-4 lg:right-auto z-40 lg:w-96"
    >
      {/* Card */}
      <div className="relative bg-dark-900/95 border border-dark-600 rounded-xl shadow-2xl backdrop-blur-sm">
        {/* Dotted rail connecting the two rows */}
        <div className="absolute left-[21px] top-[30px] bottom-[30px] w-px border-l border-dashed border-dark-500 pointer-events-none" />

        {/* Start row */}
        <div className="flex items-center gap-3 px-4 py-1.5">
          <span className="w-2.5 h-2.5 rounded-full bg-success flex-shrink-0" aria-hidden="true" />
          <input
            type="text"
            value={originQuery}
            onChange={handleQueryChange('origin')}
            onFocus={(e) => { e.target.select(); openField('origin'); }}
            onKeyDown={handleKeyDown('origin', originQuery)}
            placeholder="Where are you starting?"
            enterKeyHint="search"
            autoComplete="off"
            autoCorrect="off"
            spellCheck={false}
            aria-label="Route start"
            className="flex-1 min-w-0 bg-transparent py-2 text-sm text-white placeholder-dark-300 focus:outline-none"
          />
          {originQuery && (
            <button
              onClick={() => clearField('origin')}
              type="button"
              aria-label="Clear start"
              className="p-1.5 -mr-1.5 text-dark-400 hover:text-white transition-colors flex-shrink-0"
            >
              <svg className="w-4 h-4" viewBox="0 0 24 24" fill="currentColor">
                <path d="M19 6.41L17.59 5 12 10.59 6.41 5 5 6.41 10.59 12 5 17.59 6.41 19 12 13.41 17.59 19 19 17.59 13.41 12z" />
              </svg>
            </button>
          )}
        </div>

        {/* Divider with swap */}
        <div className="relative mx-4 h-px bg-dark-700">
          <button
            onClick={swapLocations}
            type="button"
            aria-label="Swap start and destination"
            disabled={!origin && !destination}
            className="absolute right-8 -top-3 w-6 h-6 rounded-full bg-dark-800 border border-dark-600 text-dark-300 hover:text-white hover:border-dark-500 transition-colors flex items-center justify-center disabled:opacity-30"
          >
            <svg className="w-3.5 h-3.5" viewBox="0 0 24 24" fill="currentColor">
              <path d="M16 17.01V10h-2v7.01h-3L15 21l4-3.99h-3zM9 3L5 6.99h3V14h2V6.99h3L9 3z" />
            </svg>
          </button>
        </div>

        {/* Destination row */}
        <div className="flex items-center gap-3 px-4 py-1.5">
          <svg className="w-3 h-3 text-danger flex-shrink-0" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
            <path d="M12 2C8.13 2 5 5.13 5 9c0 5.25 7 13 7 13s7-7.75 7-13c0-3.87-3.13-7-7-7zm0 9.5c-1.38 0-2.5-1.12-2.5-2.5s1.12-2.5 2.5-2.5 2.5 1.12 2.5 2.5-1.12 2.5-2.5 2.5z" />
          </svg>
          <input
            type="text"
            value={destQuery}
            onChange={handleQueryChange('destination')}
            onFocus={(e) => { e.target.select(); openField('destination'); }}
            onKeyDown={handleKeyDown('destination', destQuery)}
            placeholder="Where to?"
            enterKeyHint="search"
            autoComplete="off"
            autoCorrect="off"
            spellCheck={false}
            aria-label="Route destination"
            className="flex-1 min-w-0 bg-transparent py-2 text-sm text-white placeholder-dark-300 focus:outline-none"
          />
          {destQuery && (
            <button
              onClick={() => clearField('destination')}
              type="button"
              aria-label="Clear destination"
              className="p-1.5 -mr-1.5 text-dark-400 hover:text-white transition-colors flex-shrink-0"
            >
              <svg className="w-4 h-4" viewBox="0 0 24 24" fill="currentColor">
                <path d="M19 6.41L17.59 5 12 10.59 6.41 5 5 6.41 10.59 12 5 17.59 6.41 19 12 13.41 17.59 19 19 17.59 13.41 12z" />
              </svg>
            </button>
          )}
        </div>
      </div>

      {/* Status banner: calculating, or error with retry */}
      {isCalculating && (
        <div
          role="status"
          aria-live="polite"
          className="mt-2 flex items-center gap-2.5 px-3 py-2.5 bg-dark-900/95 border border-dark-600 rounded-lg text-xs text-gray-200 animate-fade-in backdrop-blur-sm"
        >
          <div className="w-3.5 h-3.5 border-2 border-accent/30 border-t-accent rounded-full animate-spin flex-shrink-0" />
          Analyzing route…
        </div>
      )}
      {!isCalculating && routeError && origin && destination && (
        <div
          role="alert"
          className="mt-2 flex items-center justify-between gap-3 px-3 py-2.5 bg-danger/10 border border-danger/40 rounded-lg text-xs text-danger animate-fade-in backdrop-blur-sm"
        >
          <span className="min-w-0">{routeError}</span>
          <button
            onClick={() => calculateRoutes()}
            type="button"
            className="font-semibold px-2.5 py-1 rounded-md bg-danger/20 hover:bg-danger/30 transition-colors flex-shrink-0"
          >
            Retry
          </button>
        </div>
      )}

      {/* Dropdown: search action + results */}
      {dropdownOpen && (
        <div className="mt-2 bg-dark-900/95 border border-dark-600 rounded-xl shadow-2xl overflow-hidden animate-fade-in backdrop-blur-sm">
          {activeFieldIsEmpty && (
            <>
              {activeField === 'origin' && (
                <button
                  onClick={handleUseMyLocation}
                  type="button"
                  disabled={geoState === 'loading'}
                  className="w-full px-4 py-3 text-left flex items-center gap-3 text-sm hover:bg-dark-700/70 transition-colors border-b border-dark-700/50"
                >
                  {geoState === 'loading' ? (
                    <>
                      <div className="w-4 h-4 border-2 border-accent/30 border-t-accent rounded-full animate-spin flex-shrink-0" />
                      <span className="text-dark-300">Getting location…</span>
                    </>
                  ) : geoState === 'error' ? (
                    <>
                      <svg className="w-4 h-4 text-danger flex-shrink-0" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
                        <path d="M12 8c-2.21 0-4 1.79-4 4s1.79 4 4 4 4-1.79 4-4-1.79-4-4-4zm8.94 3c-.46-4.17-3.77-7.48-7.94-7.94V1h-2v2.06C6.83 3.52 3.52 6.83 3.06 11H1v2h2.06c.46 4.17 3.77 7.48 7.94 7.94V23h2v-2.06c4.17-.46 7.48-3.77 7.94-7.94H23v-2h-2.06zM12 19c-3.87 0-7-3.13-7-7s3.13-7 7-7 7 3.13 7 7-3.13 7-7 7z" />
                      </svg>
                      <span className="text-danger font-medium">Location unavailable</span>
                    </>
                  ) : (
                    <>
                      <svg className="w-4 h-4 text-accent flex-shrink-0" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
                        <path d="M12 8c-2.21 0-4 1.79-4 4s1.79 4 4 4 4-1.79 4-4-1.79-4-4-4zm8.94 3c-.46-4.17-3.77-7.48-7.94-7.94V1h-2v2.06C6.83 3.52 3.52 6.83 3.06 11H1v2h2.06c.46 4.17 3.77 7.48 7.94 7.94V23h2v-2.06c4.17-.46 7.48-3.77 7.94-7.94H23v-2h-2.06zM12 19c-3.87 0-7-3.13-7-7s3.13-7 7-7 7 3.13 7 7-3.13 7-7 7z" />
                      </svg>
                      <span className="text-white font-medium">Use my location</span>
                    </>
                  )}
                </button>
              )}
              <button
                onClick={handleChooseOnMap}
                type="button"
                className="w-full px-4 py-3 text-left flex items-center gap-3 text-sm hover:bg-dark-700/70 transition-colors border-b border-dark-700/50 last:border-b-0"
              >
                <svg className="w-4 h-4 text-dark-400 flex-shrink-0" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
                  <path d="M12 2C8.13 2 5 5.13 5 9c0 5.25 7 13 7 13s7-7.75 7-13c0-3.87-3.13-7-7-7zm0 9.5c-1.38 0-2.5-1.12-2.5-2.5s1.12-2.5 2.5-2.5 2.5 1.12 2.5 2.5-1.12 2.5-2.5 2.5z" />
                </svg>
                <span className="text-white font-medium">Choose on map</span>
              </button>
            </>
          )}
          {(showSearchAction || isSearching) && (
            <button
              onClick={() => performSearch(activeField as Field, activeQuery)}
              type="button"
              disabled={isSearching}
              className="w-full px-4 py-3 text-left flex items-center gap-3 text-sm text-white hover:bg-dark-700/70 transition-colors border-b border-dark-700/50"
            >
              {isSearching ? (
                <>
                  <div className="w-4 h-4 border-2 border-dark-500 border-t-white rounded-full animate-spin flex-shrink-0" />
                  <span className="text-dark-300">Searching…</span>
                </>
              ) : (
                <>
                  <svg className="w-4 h-4 text-accent flex-shrink-0" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
                    <path d="M15.5 14h-.79l-.28-.27C15.41 12.59 16 11.11 16 9.5 16 5.91 13.09 3 9.5 3S3 5.91 3 9.5 5.91 16 9.5 16c1.61 0 3.09-.59 4.23-1.57l.27.28v.79l5 4.99L20.49 19l-4.99-5zm-6 0C7.01 14 5 11.99 5 9.5S7.01 5 9.5 5 14 7.01 14 9.5 11.99 14 9.5 14z" />
                  </svg>
                  <span>
                    Search "<span className="font-semibold">{activeQuery.trim()}</span>"
                  </span>
                </>
              )}
            </button>
          )}
          {searchError && (
            <div className="px-4 py-3 text-sm text-dark-300">{searchError}</div>
          )}
          {results.length > 0 && (
            <ul role="listbox" aria-label="Search results" className="max-h-64 overflow-y-auto">
              {results.map((result) => (
                <li key={result.id} role="option" aria-selected={false}>
                  <button
                    onClick={() => selectLocation(activeField as Field, result)}
                    type="button"
                    className="w-full px-4 py-3 text-left flex items-start gap-3 hover:bg-dark-700/70 transition-colors border-b border-dark-700/50"
                  >
                    <svg className="w-4 h-4 mt-0.5 text-dark-400 flex-shrink-0" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
                      <path d="M12 2C8.13 2 5 5.13 5 9c0 5.25 7 13 7 13s7-7.75 7-13c0-3.87-3.13-7-7-7zm0 9.5c-1.38 0-2.5-1.12-2.5-2.5s1.12-2.5 2.5-2.5 2.5 1.12 2.5 2.5-1.12 2.5-2.5 2.5z" />
                    </svg>
                    <div className="min-w-0 flex-1">
                      <div className="text-sm text-white font-medium truncate">{result.name}</div>
                      <div className="text-xs text-dark-300 truncate mt-0.5">{result.description}</div>
                    </div>
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>
      )}
    </div>
  );
}
