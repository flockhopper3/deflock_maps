import { useAppModeStore } from '../../store';
import { DENSITY_COLOR_RAMPS } from '../../components/map/layers/DensityLayers';

export function DensityLegend() {
  const { densitySettings } = useAppModeStore();
  const label = densitySettings.metric === 'perCapita'
    ? 'Cameras per 10K Residents'
    : 'Cameras per Road Mile';

  const gradient = DENSITY_COLOR_RAMPS[densitySettings.colorScheme].gradient.replace('90deg', 'to right');

  return (
    <div className="bg-dark-800/90 rounded-md px-3 py-2 border border-dark-600">
      <div className="flex items-center gap-3 text-sm">
        <span className="text-dark-400 text-xs font-medium">Low</span>
        <div
          className="flex-1 h-2.5 rounded-full min-w-[120px]"
          style={{ background: gradient }}
        />
        <span className="text-dark-400 text-xs font-medium">High</span>
      </div>
      <p className="text-xs text-dark-400 mt-1.5 text-center">{label}</p>
    </div>
  );
}
