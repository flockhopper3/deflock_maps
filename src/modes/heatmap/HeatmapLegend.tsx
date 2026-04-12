import { useAppModeStore } from '../../store';
import { COLOR_SCHEMES } from './colorSchemes';

export function HeatmapLegend() {
  const { heatmapSettings } = useAppModeStore();

  const scheme = COLOR_SCHEMES[heatmapSettings.colorScheme];

  const label = 'Camera Density';

  return (
    <div className="bg-dark-800/90 rounded-md px-3 py-2 border border-dark-600">
      <div className="flex items-center gap-3 text-sm">
        <span className="text-dark-400 text-xs font-medium">Low</span>
        <div
          className="flex-1 h-2.5 rounded-full min-w-[120px]"
          style={{ background: scheme.gradient }}
        />
        <span className="text-dark-400 text-xs font-medium">High</span>
      </div>
      <p className="text-xs text-dark-400 mt-1.5 text-center">{label}</p>
    </div>
  );
}
