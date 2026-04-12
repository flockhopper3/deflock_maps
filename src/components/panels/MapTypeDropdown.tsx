import { useState } from 'react';
import { useAppModeStore } from '../../store';
import type { MapVisualizationType } from '../../store/appModeStore';
import { Layers, ChevronDown } from 'lucide-react';

export const VIZ_OPTIONS: { id: MapVisualizationType; label: string; description: string }[] = [
  { id: 'heatmap', label: 'Heatmap', description: 'Smooth density blobs' },
  { id: 'dots', label: 'Dot Density', description: 'Plain dots, stacking opacity' },
];

export function MapTypeDropdown() {
  const { mapVisualization, setMapVisualization } = useAppModeStore();
  const [isOpen, setIsOpen] = useState(false);

  const active = VIZ_OPTIONS.find((o) => o.id === mapVisualization)!;

  return (
    <div className="relative">
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="w-full flex items-center justify-between px-4 py-3 bg-dark-800 border border-dark-600 rounded-xl hover:border-dark-500 transition-colors"
      >
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 rounded-lg bg-accent/10 flex items-center justify-center">
            <Layers className="w-4 h-4 text-accent" />
          </div>
          <div className="text-left">
            <p className="text-sm font-medium text-white">{active.label}</p>
            <p className="text-xs text-dark-400">{active.description}</p>
          </div>
        </div>
        <ChevronDown className={`w-4 h-4 text-dark-400 transition-transform ${isOpen ? 'rotate-180' : ''}`} />
      </button>

      {isOpen && (
        <div className="absolute z-50 w-full mt-1.5 bg-dark-800 border border-dark-600 rounded-xl shadow-2xl shadow-black/40 overflow-hidden">
          {VIZ_OPTIONS.map((option) => (
            <button
              key={option.id}
              onClick={() => {
                setMapVisualization(option.id);
                setIsOpen(false);
              }}
              className={`w-full flex items-center gap-3 px-4 py-3 text-left transition-colors ${
                option.id === mapVisualization
                  ? 'bg-accent/10'
                  : 'hover:bg-dark-700'
              }`}
            >
              <div className={`w-2 h-2 rounded-full ${
                option.id === mapVisualization ? 'bg-accent' : 'bg-dark-600'
              }`} />
              <div>
                <p className={`text-sm font-medium ${
                  option.id === mapVisualization ? 'text-white' : 'text-dark-200'
                }`}>{option.label}</p>
                <p className="text-xs text-dark-500">{option.description}</p>
              </div>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
