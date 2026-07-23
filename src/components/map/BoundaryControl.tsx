import { useState, useRef, useEffect } from 'react';
import { Layers } from 'lucide-react';
import { useAppModeStore } from '../../store/appModeStore';
import { useBoundaryStore } from '../../store/boundaryStore';
import {
  BOUNDARY_LEVELS,
  BOUNDARY_LEVEL_LABEL,
  type BoundaryLevel,
} from '../../services/boundaryTilesService';

/** A single labelled on/off switch. */
function LevelSwitch({
  level,
  on,
  onToggle,
}: {
  level: BoundaryLevel;
  on: boolean;
  onToggle: () => void;
}) {
  return (
    <button
      role="switch"
      aria-checked={on}
      onClick={onToggle}
      className="w-full flex items-center justify-between px-3 py-2.5 rounded-lg text-left transition-colors hover:bg-dark-700"
    >
      <span className={`text-xs font-medium ${on ? 'text-white' : 'text-dark-300'}`}>
        {BOUNDARY_LEVEL_LABEL[level]}
      </span>
      <span
        className={`relative w-9 h-5 rounded-full transition-colors flex-shrink-0 ${
          on ? 'bg-accent' : 'bg-dark-600'
        }`}
      >
        <span
          className={`absolute top-0.5 left-0.5 w-4 h-4 rounded-full bg-white transition-transform ${
            on ? 'translate-x-4' : 'translate-x-0'
          }`}
        />
      </span>
    </button>
  );
}

/** Boundaries overlay control — a Layers button opening three level switches
 *  (States / Counties / Municipalities). Lives in the bottom-left control
 *  stack, above the country + filter buttons. Map mode only. */
export function BoundaryControl() {
  const appMode = useAppModeStore((s) => s.appMode);
  const levels = useBoundaryStore((s) => s.levels);
  const toggleLevel = useBoundaryStore((s) => s.toggleLevel);

  const [open, setOpen] = useState(false);
  const panelRef = useRef<HTMLDivElement>(null);

  const activeCount = BOUNDARY_LEVELS.filter((l) => levels[l]).length;

  // Close on outside click
  useEffect(() => {
    if (!open) return;
    const handleClick = (e: MouseEvent) => {
      if (panelRef.current && !panelRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClick);
    return () => document.removeEventListener('mousedown', handleClick);
  }, [open]);

  if (appMode !== 'map') return null;

  return (
    <div ref={panelRef} className="map-layers-control absolute z-10 flex flex-col items-start">
      {open && (
        <div className="absolute z-10 bottom-full left-0 mb-3 w-52 bg-dark-800 rounded-md border border-dark-600 overflow-hidden shadow-xl shadow-black/40">
          <div className="px-3 py-2 border-b border-dark-600">
            <span className="text-[11px] font-semibold uppercase tracking-wider text-dark-400">
              Boundaries
            </span>
          </div>
          <div className="p-1.5 space-y-0.5">
            {BOUNDARY_LEVELS.map((level) => (
              <LevelSwitch
                key={level}
                level={level}
                on={levels[level]}
                onToggle={() => toggleLevel(level)}
              />
            ))}
          </div>
        </div>
      )}

      <button
        onClick={() => setOpen(!open)}
        aria-label="Boundary layers"
        aria-expanded={open}
        title="Boundary layers"
        className={`layers-trigger relative z-0 w-[40px] h-[40px] flex items-center justify-center rounded-md transition-colors
          bg-dark-800 border border-dark-600
          ${open || activeCount > 0 ? 'text-accent' : 'text-dark-300 hover:bg-dark-700'}`}
      >
        <Layers className="w-4 h-4" />
        {activeCount > 0 && (
          <span className="absolute -top-1.5 -right-1.5 min-w-[18px] h-[18px] px-1 rounded-full bg-accent text-white text-[10px] font-bold flex items-center justify-center tabular-nums border-2 border-dark-900">
            {activeCount}
          </span>
        )}
      </button>
    </div>
  );
}
