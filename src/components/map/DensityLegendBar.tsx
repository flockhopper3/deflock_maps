import { useAppModeStore } from '../../store';
import { DENSITY_COLOR_RAMPS } from './layers/DensityLayers';

export function DensityLegendBar() {
  const { densitySettings } = useAppModeStore();
  const label = densitySettings.metric === 'perCapita'
    ? 'Cameras per 10K Residents'
    : 'Cameras per Road Mile';
  const gradient = DENSITY_COLOR_RAMPS[densitySettings.colorScheme].gradient.replace('90deg', 'to right');

  return (
    <div className="absolute bottom-4 left-4 z-20">
      <div className="bg-dark-800/90 rounded-md px-3 py-2 border border-dark-600">
        <div className="flex items-center gap-3">
          <span className="text-dark-400 text-xs font-medium">Low</span>
          <div
            className="h-2.5 rounded-full w-40 sm:w-52"
            style={{ background: gradient }}
          />
          <span className="text-dark-400 text-xs font-medium">High</span>
        </div>
        <p className="text-xs text-dark-400 mt-1 text-center">{label}</p>
      </div>
    </div>
  );
}
