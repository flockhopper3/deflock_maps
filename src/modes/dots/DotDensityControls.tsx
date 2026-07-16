import { useAppModeStore } from '../../store';

const DOT_COLORS = [
  { id: '#4DA6FF', name: 'Blue', preview: '#4DA6FF' },
  { id: '#f97316', name: 'Orange', preview: '#f97316' },
  { id: '#eab308', name: 'Yellow', preview: '#eab308' },
  { id: '#22c55e', name: 'Green', preview: '#22c55e' },
  { id: '#06b6d4', name: 'Cyan', preview: '#06b6d4' },
  { id: '#ffffff', name: 'White', preview: '#ffffff' },
];

export function DotDensityControls() {
  const dotColor = useAppModeStore((s) => s.dotDensitySettings.color);
  const updateDotDensitySettings = useAppModeStore((s) => s.updateDotDensitySettings);

  return (
    <div className="space-y-6">
      {/* Dot Color */}
      <div>
        <span className="block text-xs font-medium text-dark-400 uppercase tracking-wider mb-3">
          Dot Color
        </span>
        <div className="grid grid-cols-3 gap-2">
          {DOT_COLORS.map((c) => {
            const isActive = dotColor === c.id;
            return (
              <button
                key={c.id}
                onClick={() => updateDotDensitySettings({ color: c.id })}
                className={`flex items-center gap-2.5 px-3 py-2.5 rounded-xl border transition-all ${
                  isActive
                    ? 'bg-dark-700 border-dark-600'
                    : 'bg-dark-800 border-dark-600 hover:border-dark-500'
                }`}
              >
                <div
                  className="w-4 h-4 rounded-full flex-shrink-0 border border-dark-500"
                  style={{ backgroundColor: c.preview }}
                />
                <span className={`text-xs font-medium ${isActive ? 'text-white' : 'text-dark-300'}`}>
                  {c.name}
                </span>
              </button>
            );
          })}
        </div>
      </div>

      {/* About */}
      <div className="bg-dark-800/50 rounded-xl p-4 border border-dark-700/50">
        <div className="flex items-start gap-3">
          <div className="w-8 h-8 rounded-lg bg-accent/10 flex items-center justify-center flex-shrink-0">
            <svg className="w-4 h-4 text-accent" viewBox="0 0 24 24" fill="currentColor">
              <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm1 15h-2v-6h2v6zm0-8h-2V7h2v2z" />
            </svg>
          </div>
          <div>
            <p className="text-sm text-dark-300 font-medium mb-1">About Dot Density</p>
            <p className="text-xs text-dark-400 leading-relaxed">
              Each camera is one dot. Zoomed out, dots are small and translucent, so
              where cameras cluster the overlaps stack into brighter, more solid areas —
              density you can read at a glance. Zoom in and dots grow into individual
              cameras.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
