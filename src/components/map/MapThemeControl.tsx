import { useAppModeStore } from '../../store';
import { Sun, Moon } from 'lucide-react';

/** Light/dark basemap toggle — right-side column, above locate/zoom. */
export function MapThemeControl() {
  const { mapTileStyle, setMapTileStyle } = useAppModeStore();
  const isDark = mapTileStyle === 'dark';

  return (
    <div className="map-theme-control absolute z-20">
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
