import { useState, useRef, useEffect } from 'react';
import { useAppModeStore, useCameraStore, useMapStore } from '../../store';
import { COUNTRIES, countryZoomForViewport, type CameraCountry } from '../../services/cameraDataService';
import { Sun, Moon, Check } from 'lucide-react';

export function MapStyleControl() {
  const { mapTileStyle, setMapTileStyle } = useAppModeStore();
  const [countryOpen, setCountryOpen] = useState(false);
  const panelRef = useRef<HTMLDivElement>(null);

  const country = useCameraStore(s => s.country);
  const isCountrySwitching = useCameraStore(s => s.isCountrySwitching);
  const setCountry = useCameraStore(s => s.setCountry);
  const flyTo = useMapStore(s => s.flyTo);
  const [pendingCountry, setPendingCountry] = useState<CameraCountry | null>(null);
  const [countryError, setCountryError] = useState<string | null>(null);

  const isDark = mapTileStyle === 'dark';

  // Close on outside click
  useEffect(() => {
    if (!countryOpen) return;
    const handleClick = (e: MouseEvent) => {
      if (panelRef.current && !panelRef.current.contains(e.target as Node)) {
        setCountryOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClick);
    return () => document.removeEventListener('mousedown', handleClick);
  }, [countryOpen]);

  const handleCountrySelect = async (id: CameraCountry) => {
    if (id === country || isCountrySwitching) {
      setCountryOpen(false);
      return;
    }
    setCountryError(null);
    setPendingCountry(id);
    try {
      await setCountry(id);
      setPendingCountry(null);
      setCountryOpen(false);
      flyTo(COUNTRIES[id].center, countryZoomForViewport(id));
    } catch {
      setPendingCountry(null);
      setCountryError(`Couldn't load ${COUNTRIES[id].label} data. Try again.`);
    }
  };

  const spinner = (
    <div className="w-3.5 h-3.5 border-2 border-dark-500 border-t-accent rounded-full animate-spin" />
  );

  return (
    <div ref={panelRef} className="map-style-control absolute z-20 flex flex-col items-end gap-2">
      {/* Country popover */}
      {countryOpen && (
        <div className="absolute bottom-full right-0 mb-2 w-48 bg-dark-800 rounded-md border border-dark-600 overflow-hidden">
          <div className="p-1.5 space-y-0.5">
            {Object.values(COUNTRIES).map((c) => (
              <button
                key={c.id}
                onClick={() => handleCountrySelect(c.id)}
                disabled={isCountrySwitching}
                className={`w-full flex items-center gap-2.5 px-3 py-2 rounded-lg text-left transition-colors ${
                  country === c.id
                    ? 'bg-accent/10 text-white'
                    : 'text-dark-400 hover:bg-dark-700 hover:text-white'
                }`}
              >
                <span className="text-base leading-none">{c.flag}</span>
                <span className="text-xs font-medium flex-1">{c.label}</span>
                {pendingCountry === c.id
                  ? spinner
                  : country === c.id && <Check className="w-3.5 h-3.5 text-accent" />}
              </button>
            ))}
          </div>
          {countryError && (
            <p className="px-3 py-2 text-[11px] text-red-400 border-t border-dark-600">
              {countryError}
            </p>
          )}
        </div>
      )}

      {/* Country trigger */}
      <button
        onClick={() => setCountryOpen(!countryOpen)}
        aria-label="Switch country"
        aria-expanded={countryOpen}
        className={`country-trigger w-[40px] h-[40px] flex items-center justify-center rounded-md transition-colors
          bg-dark-800 border border-dark-600
          ${countryOpen ? 'text-accent' : 'text-dark-300 hover:bg-dark-700'}`}
        title="Country"
      >
        {isCountrySwitching ? spinner : (
          <span className="text-base leading-none">{COUNTRIES[country].flag}</span>
        )}
      </button>

      {/* Theme pill — Light (sun) on top, Dark (moon) below */}
      <div
        role="radiogroup"
        aria-label="Map theme"
        className="theme-pill w-[40px] flex flex-col items-center gap-0.5 py-1 rounded-full bg-dark-800 border border-dark-600"
      >
        <button
          role="radio"
          aria-checked={!isDark}
          aria-label="Light map"
          title="Light map"
          onClick={() => setMapTileStyle('light')}
          className={`w-8 h-8 rounded-full flex items-center justify-center transition-colors ${
            !isDark ? 'bg-accent text-dark-900' : 'text-dark-400 hover:text-white'
          }`}
        >
          <Sun className="w-4 h-4" />
        </button>
        <button
          role="radio"
          aria-checked={isDark}
          aria-label="Dark map"
          title="Dark map"
          onClick={() => setMapTileStyle('dark')}
          className={`w-8 h-8 rounded-full flex items-center justify-center transition-colors ${
            isDark ? 'bg-accent text-dark-900' : 'text-dark-400 hover:text-white'
          }`}
        >
          <Moon className="w-4 h-4" />
        </button>
      </div>
    </div>
  );
}
