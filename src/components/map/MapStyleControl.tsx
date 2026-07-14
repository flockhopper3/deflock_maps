import { useState, useRef, useEffect } from 'react';
import { useAppModeStore, useCameraStore, useMapStore } from '../../store';
import type { MapTileStyleId } from '../../store/appModeStore';
import { COUNTRIES, countryZoomForViewport, type CameraCountry } from '../../services/cameraDataService';
import { Layers, Type, Check } from 'lucide-react';

type BaseMapType = 'dark' | 'light' | 'white' | 'black' | 'grayscale';

/** Derive the 6-option MapTileStyleId from base type + labels toggle */
function toTileStyleId(base: BaseMapType, labels: boolean): MapTileStyleId {
  if (labels) return base;
  return `${base}-nolabels` as MapTileStyleId;
}

/** Extract base type and labels state from current MapTileStyleId */
function fromTileStyleId(id: MapTileStyleId): { base: BaseMapType; labels: boolean } {
  if (id.endsWith('-nolabels')) {
    return { base: id.replace('-nolabels', '') as BaseMapType, labels: false };
  }
  return { base: id as BaseMapType, labels: true };
}

const BASE_OPTIONS: { id: BaseMapType; label: string }[] = [
  { id: 'dark', label: 'Dark' },
  { id: 'light', label: 'Light' },
  { id: 'white', label: 'White' },
  { id: 'black', label: 'Black' },
  { id: 'grayscale', label: 'Grayscale' },
];

export function MapStyleControl() {
  const { mapTileStyle, setMapTileStyle } = useAppModeStore();
  const [openPanel, setOpenPanel] = useState<'style' | 'country' | null>(null);
  const panelRef = useRef<HTMLDivElement>(null);

  const country = useCameraStore(s => s.country);
  const isCountrySwitching = useCameraStore(s => s.isCountrySwitching);
  const setCountry = useCameraStore(s => s.setCountry);
  const flyTo = useMapStore(s => s.flyTo);
  const [pendingCountry, setPendingCountry] = useState<CameraCountry | null>(null);
  const [countryError, setCountryError] = useState<string | null>(null);

  const { base, labels } = fromTileStyleId(mapTileStyle);

  // Close on outside click
  useEffect(() => {
    if (!openPanel) return;
    const handleClick = (e: MouseEvent) => {
      if (panelRef.current && !panelRef.current.contains(e.target as Node)) {
        setOpenPanel(null);
      }
    };
    document.addEventListener('mousedown', handleClick);
    return () => document.removeEventListener('mousedown', handleClick);
  }, [openPanel]);

  const handleBaseChange = (newBase: BaseMapType) => {
    setMapTileStyle(toTileStyleId(newBase, labels));
  };

  const handleLabelsToggle = () => {
    setMapTileStyle(toTileStyleId(base, !labels));
  };

  const handleCountrySelect = async (id: CameraCountry) => {
    if (id === country || isCountrySwitching) {
      setOpenPanel(null);
      return;
    }
    setCountryError(null);
    setPendingCountry(id);
    try {
      await setCountry(id);
      setPendingCountry(null);
      setOpenPanel(null);
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
      {openPanel === 'country' && (
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

      {/* Map style popover */}
      {openPanel === 'style' && (
        <div className="absolute bottom-full right-0 mb-2 w-40 bg-dark-800 rounded-md border border-dark-600 overflow-hidden">
          {/* Base map type */}
          <div className="p-1.5 space-y-0.5">
            {BASE_OPTIONS.map((opt) => (
              <button
                key={opt.id}
                onClick={() => handleBaseChange(opt.id)}
                className={`w-full flex items-center gap-2.5 px-3 py-1.5 rounded-lg text-left transition-colors ${
                  base === opt.id
                    ? 'bg-accent/10 text-white'
                    : 'text-dark-400 hover:bg-dark-700 hover:text-white'
                }`}
              >
                <div className={`w-1.5 h-1.5 rounded-full flex-shrink-0 ${
                  base === opt.id ? 'bg-accent' : 'bg-dark-600'
                }`} />
                <span className="text-xs font-medium">{opt.label}</span>
              </button>
            ))}
          </div>

          {/* Labels toggle */}
          <div className="border-t border-dark-600 px-3 py-2">
            <button
              onClick={handleLabelsToggle}
              role="switch"
              aria-checked={labels}
              className="w-full flex items-center justify-between"
            >
              <div className="flex items-center gap-2">
                <Type className="w-3 h-3 text-dark-400" />
                <span className="text-xs text-dark-300">Labels</span>
              </div>
              <div
                className={`relative w-8 h-[18px] rounded-full transition-colors ${
                  labels ? 'bg-accent' : 'bg-dark-600'
                }`}
              >
                <div className={`absolute top-[2px] w-[14px] h-[14px] rounded-full bg-white shadow-sm transition-transform ${
                  labels ? 'translate-x-[15px]' : 'translate-x-[2px]'
                }`} />
              </div>
            </button>
          </div>
        </div>
      )}

      {/* Country trigger */}
      <button
        onClick={() => setOpenPanel(openPanel === 'country' ? null : 'country')}
        aria-label="Switch country"
        aria-expanded={openPanel === 'country'}
        className={`country-trigger w-[40px] h-[40px] flex items-center justify-center rounded-md transition-colors
          bg-dark-800 border border-dark-600
          ${openPanel === 'country' ? 'text-accent' : 'text-dark-300 hover:bg-dark-700'}`}
        title="Country"
      >
        {isCountrySwitching ? spinner : (
          <span className="text-base leading-none">{COUNTRIES[country].flag}</span>
        )}
      </button>

      {/* Map style trigger — matches zoom control styling exactly */}
      <button
        onClick={() => setOpenPanel(openPanel === 'style' ? null : 'style')}
        aria-label="Change map style"
        aria-expanded={openPanel === 'style'}
        className={`map-style-trigger w-[40px] h-[40px] flex items-center justify-center rounded-md transition-colors
          bg-dark-800 border border-dark-600
          ${openPanel === 'style' ? 'text-accent' : 'text-dark-300 hover:bg-dark-700'}`}
        title="Map style"
      >
        <Layers className="w-4 h-4" />
      </button>
    </div>
  );
}
