import { useAppModeStore } from '../../store';
import type { DensityLevel, DensityMetric, DensityViewMode, DensityColorScheme, DensityHeightScale } from '../../store/appModeStore';
import { DENSITY_COLOR_RAMPS } from '../../components/map/layers/DensityLayers';

function SegmentedToggle<T extends string>({
  label,
  options,
  value,
  onChange,
}: {
  label: string;
  options: { id: T; label: string }[];
  value: T;
  onChange: (v: T) => void;
}) {
  return (
    <div>
      <span className="block text-xs font-medium text-dark-400 uppercase tracking-wider mb-2">
        {label}
      </span>
      <div className="flex gap-1 bg-dark-800 rounded-xl p-1">
        {options.map((opt) => (
          <button
            key={opt.id}
            onClick={() => onChange(opt.id)}
            className={`flex-1 px-3 py-2 rounded-lg text-xs font-medium transition-all ${
              value === opt.id
                ? 'bg-dark-700 text-white border border-dark-600'
                : 'text-dark-400 hover:text-dark-200'
            }`}
          >
            {opt.label}
          </button>
        ))}
      </div>
    </div>
  );
}

function SliderControl({
  label,
  value,
  min,
  max,
  step,
  onChange,
  formatValue,
}: {
  label: string;
  value: number;
  min: number;
  max: number;
  step: number;
  onChange: (v: number) => void;
  formatValue?: (v: number) => string;
}) {
  return (
    <div>
      <div className="flex items-center justify-between mb-2">
        <span className="text-xs font-medium text-dark-300">{label}</span>
        <span className="text-xs tabular-nums text-dark-400">
          {formatValue ? formatValue(value) : value.toFixed(2)}
        </span>
      </div>
      <input
        type="range"
        min={min}
        max={max}
        step={step}
        value={value}
        onChange={(e) => onChange(parseFloat(e.target.value))}
        className="w-full h-1.5 bg-dark-700 rounded-full appearance-none cursor-pointer accent-[#0080BC] [&::-webkit-slider-thumb]:appearance-none [&::-webkit-slider-thumb]:w-4 [&::-webkit-slider-thumb]:h-4 [&::-webkit-slider-thumb]:rounded-full [&::-webkit-slider-thumb]:bg-accent [&::-webkit-slider-thumb]:shadow-sm"
      />
    </div>
  );
}

const LEVEL_OPTIONS: { id: DensityLevel; label: string }[] = [
  { id: 'state', label: 'State' },
  { id: 'county', label: 'County' },
];

const METRIC_OPTIONS: { id: DensityMetric; label: string }[] = [
  { id: 'perCapita', label: 'Per Capita' },
  { id: 'perRoadMile', label: 'Per Road Mile' },
];

const VIEW_OPTIONS: { id: DensityViewMode; label: string }[] = [
  { id: '2d', label: '2D' },
  { id: '3d', label: '3D' },
];

const COLOR_SCHEME_OPTIONS: { id: DensityColorScheme; label: string }[] = [
  { id: 'warm', label: 'Warm' },
  { id: 'inferno', label: 'Inferno' },
  { id: 'viridis', label: 'Viridis' },
  { id: 'magma', label: 'Magma' },
];

const HEIGHT_SCALE_OPTIONS: { id: DensityHeightScale; label: string }[] = [
  { id: 'sqrt', label: 'Sqrt' },
  { id: 'log', label: 'Log' },
  { id: 'linear', label: 'Linear' },
];

export function DensityControls() {
  const { densitySettings, updateDensitySettings } = useAppModeStore();

  return (
    <div className="space-y-5">
      <SegmentedToggle
        label="Geographic Level"
        options={LEVEL_OPTIONS}
        value={densitySettings.level}
        onChange={(v) => updateDensitySettings({ level: v })}
      />

      <SegmentedToggle
        label="Metric"
        options={METRIC_OPTIONS}
        value={densitySettings.metric}
        onChange={(v) => updateDensitySettings({ metric: v })}
      />

      <SegmentedToggle
        label="View Mode"
        options={VIEW_OPTIONS}
        value={densitySettings.viewMode}
        onChange={(v) => updateDensitySettings({ viewMode: v })}
      />

      <SliderControl
        label="Opacity"
        value={densitySettings.opacity}
        min={0.1}
        max={1.0}
        step={0.05}
        onChange={(v) => updateDensitySettings({ opacity: v })}
        formatValue={(v) => `${Math.round(v * 100)}%`}
      />

      {/* Divider */}
      <div className="border-t border-dark-700/50 pt-5">
        {/* Color scheme picker */}
        <div>
          <span className="block text-xs font-medium text-dark-400 uppercase tracking-wider mb-2">
            Color Palette
          </span>
          <div className="grid grid-cols-2 gap-2">
            {COLOR_SCHEME_OPTIONS.map((opt) => {
              const ramp = DENSITY_COLOR_RAMPS[opt.id];
              const active = densitySettings.colorScheme === opt.id;
              return (
                <button
                  key={opt.id}
                  onClick={() => updateDensitySettings({ colorScheme: opt.id })}
                  className={`flex flex-col gap-1.5 p-2.5 rounded-xl transition-all ${
                    active
                      ? 'bg-dark-700 border border-dark-600'
                      : 'bg-dark-800 border border-transparent hover:border-dark-600'
                  }`}
                >
                  <div
                    className="w-full h-3 rounded-full"
                    style={{ background: ramp.gradient }}
                  />
                  <span className={`text-xs font-medium ${active ? 'text-white' : 'text-dark-400'}`}>
                    {opt.label}
                  </span>
                </button>
              );
            })}
          </div>
        </div>

        {/* Height scale — only relevant in 3D mode */}
        {densitySettings.viewMode === '3d' && (
          <div className="mt-5">
            <SegmentedToggle
              label="Height Scaling"
              options={HEIGHT_SCALE_OPTIONS}
              value={densitySettings.heightScale}
              onChange={(v) => updateDensitySettings({ heightScale: v })}
            />
          </div>
        )}
      </div>
    </div>
  );
}
