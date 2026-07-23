import { create } from 'zustand';
import type { BoundaryLevel } from '../services/boundaryTilesService';

/** Identity of a hovered/clicked boundary, read from the tile feature. */
export interface BoundaryInfo {
  level: BoundaryLevel;
  name: string;
  /** municipalities only */
  type?: string;
  /** municipalities only — can be null (guard in UI) */
  county?: string | null;
  /** counties + municipalities: 2-letter (e.g. "IL") */
  state?: string;
  /** states only: 2-letter abbreviation */
  abbrev?: string;
}

/**
 * US boundaries overlay state — three independent layer toggles plus the
 * hovered/selected feature used for on-map identification.
 *
 * All levels default OFF: the vector source is only added to the map once at
 * least one level is on, so a user who never opens the Layers control makes
 * zero requests to the boundaries tileset.
 */
export interface BoundaryState {
  levels: Record<BoundaryLevel, boolean>;
  /** True when any level is on — gates the vector source mount. */
  anyOn: boolean;
  /** Feature under the cursor (desktop hover), or null. */
  hoverInfo: BoundaryInfo | null;
  /** Feature pinned by a click/tap, or null. */
  selected: BoundaryInfo | null;
  toggleLevel: (level: BoundaryLevel) => void;
  setLevel: (level: BoundaryLevel, on: boolean) => void;
  setHoverInfo: (info: BoundaryInfo | null) => void;
  setSelected: (info: BoundaryInfo | null) => void;
}

const DEFAULT_LEVELS: Record<BoundaryLevel, boolean> = {
  states: false,
  counties: false,
  municipalities: false,
};

const computeAnyOn = (levels: Record<BoundaryLevel, boolean>) =>
  levels.states || levels.counties || levels.municipalities;

export const useBoundaryStore = create<BoundaryState>((set) => ({
  levels: DEFAULT_LEVELS,
  anyOn: false,
  hoverInfo: null,
  selected: null,
  toggleLevel: (level) =>
    set((s) => {
      const levels = { ...s.levels, [level]: !s.levels[level] };
      const anyOn = computeAnyOn(levels);
      // Clear identification when the overlay goes fully off.
      return anyOn ? { levels, anyOn } : { levels, anyOn, hoverInfo: null, selected: null };
    }),
  setLevel: (level, on) =>
    set((s) => {
      const levels = { ...s.levels, [level]: on };
      const anyOn = computeAnyOn(levels);
      return anyOn ? { levels, anyOn } : { levels, anyOn, hoverInfo: null, selected: null };
    }),
  setHoverInfo: (info) => set({ hoverInfo: info }),
  setSelected: (info) => set({ selected: info }),
}));
