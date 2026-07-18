import { useState, useEffect, useMemo, useRef } from 'react';
import { useCameraStore } from '../../store';
import { useAppModeStore } from '../../store/appModeStore';
import { Filter, X, ChevronDown, Search } from 'lucide-react';

// ─── Constants (moved from MapPanel) ────────────────────────────────────────
const SURVEILLANCE_ZONES = [
  { value: 'traffic', label: 'Traffic' },
  { value: 'town', label: 'Town' },
  { value: 'parking', label: 'Parking' },
  { value: 'other', label: 'Other' },
] as const;

const MOUNT_TYPES = [
  { value: 'pole', label: 'Pole' },
  { value: 'wall', label: 'Wall' },
  { value: 'street_light', label: 'Street Light' },
  { value: 'other', label: 'Other' },
] as const;

// ─── Searchable Multi-Select (Staged) ───────────────────────────────────────
function SearchableMultiSelect({
  label,
  items,
  selected,
  onToggle,
  maxVisible = 50,
  note,
}: {
  label: string;
  items: string[];
  selected: string[];
  onToggle: (item: string) => void;
  maxVisible?: number;
  note?: string;
}) {
  const [search, setSearch] = useState('');
  const [isExpanded, setIsExpanded] = useState(false);

  const filtered = useMemo(() => {
    const q = search.toLowerCase();
    return items.filter((item) => item.toLowerCase().includes(q)).slice(0, maxVisible);
  }, [items, search, maxVisible]);

  return (
    <div>
      <button
        onClick={() => setIsExpanded(!isExpanded)}
        aria-expanded={isExpanded}
        className="w-full flex items-center justify-between py-2"
      >
        <span className="text-xs font-medium text-dark-300 uppercase tracking-wider">
          {label}
          {selected.length > 0 && (
            <span className="ml-2 px-1.5 py-0.5 rounded-full bg-accent/10 text-accent text-xs font-semibold normal-case tracking-normal">
              {selected.length}
            </span>
          )}
        </span>
        <ChevronDown
          className={`w-4 h-4 text-dark-400 transition-transform ${isExpanded ? 'rotate-180' : ''}`}
        />
      </button>

      {isExpanded && (
        <div className="mt-1 mb-3">
          <div className="relative mb-2">
            <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-dark-500" />
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder={`Search ${label.toLowerCase()}...`}
              className="w-full pl-8 pr-3 py-1.5 text-xs bg-dark-800 border border-dark-600 rounded-lg text-white placeholder:text-dark-500 focus:outline-none focus:border-accent/50"
            />
          </div>

          {note && <p className="text-xs text-dark-500 mb-2">{note}</p>}

          <div className="max-h-60 overflow-y-auto space-y-0.5 scrollbar-thin">
            {filtered.length === 0 ? (
              <p className="text-xs text-dark-500 py-2 text-center">No results</p>
            ) : (
              filtered.map((item) => {
                const isChecked = selected.includes(item);
                return (
                  <button
                    key={item}
                    onClick={() => onToggle(item)}
                    className={`w-full flex items-center gap-2.5 px-2.5 py-1.5 rounded-lg text-left transition-colors ${
                      isChecked
                        ? 'bg-accent/10 text-white'
                        : 'text-dark-300 hover:bg-dark-800'
                    }`}
                  >
                    <div
                      className={`w-3.5 h-3.5 rounded border flex-shrink-0 flex items-center justify-center transition-colors ${
                        isChecked
                          ? 'bg-accent border-accent'
                          : 'border-dark-500 bg-dark-800'
                      }`}
                    >
                      {isChecked && (
                        <svg className="w-2.5 h-2.5 text-white" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3">
                          <path d="M5 13l4 4L19 7" />
                        </svg>
                      )}
                    </div>
                    <span className="text-xs truncate">{item}</span>
                  </button>
                );
              })
            )}
          </div>
        </div>
      )}
    </div>
  );
}

// ─── Collapsible Checkbox Group (Staged) ────────────────────────────────────
function CheckboxGroup({
  label,
  options,
  selected,
  onToggle,
}: {
  label: string;
  options: readonly { value: string; label: string }[];
  selected: string[];
  onToggle: (value: string) => void;
}) {
  const [isExpanded, setIsExpanded] = useState(false);

  return (
    <div>
      <button
        onClick={() => setIsExpanded(!isExpanded)}
        aria-expanded={isExpanded}
        className="w-full flex items-center justify-between py-2"
      >
        <span className="text-xs font-medium text-dark-300 uppercase tracking-wider">
          {label}
          {selected.length > 0 && (
            <span className="ml-2 px-1.5 py-0.5 rounded-full bg-accent/10 text-accent text-xs font-semibold normal-case tracking-normal">
              {selected.length}
            </span>
          )}
        </span>
        <ChevronDown
          className={`w-4 h-4 text-dark-400 transition-transform ${isExpanded ? 'rotate-180' : ''}`}
        />
      </button>

      {isExpanded && (
        <div className="mt-1 mb-3 space-y-0.5">
          {options.map(({ value, label: optLabel }) => {
            const isChecked = selected.includes(value);
            return (
              <button
                key={value}
                onClick={() => onToggle(value)}
                className={`w-full flex items-center gap-2.5 px-2.5 py-1.5 rounded-lg text-left transition-colors ${
                  isChecked
                    ? 'bg-accent/10 text-white'
                    : 'text-dark-300 hover:bg-dark-800'
                }`}
              >
                <div
                  className={`w-3.5 h-3.5 rounded border flex-shrink-0 flex items-center justify-center transition-colors ${
                    isChecked
                      ? 'bg-accent border-accent'
                      : 'border-dark-500 bg-dark-800'
                  }`}
                >
                  {isChecked && (
                    <svg className="w-2.5 h-2.5 text-white" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3">
                      <path d="M5 13l4 4L19 7" />
                    </svg>
                  )}
                </div>
                <span className="text-xs">{optLabel}</span>
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}

/**
 * Gates the filter controls on the few-KB manifest instead of the full
 * dataset. Legacy fallback: if the manifest fails, load the GeoJSON and
 * derive the option lists from it (today's behavior).
 */
function FilterDataGate({ children }: { children: React.ReactNode }) {
  const manifestPhase = useCameraStore((s) => s.manifestPhase);
  const ensureManifestLoaded = useCameraStore((s) => s.ensureManifestLoaded);
  const isInitialized = useCameraStore((s) => s.isInitialized);
  const loadPhase = useCameraStore((s) => s.loadPhase);
  const ensureCamerasLoaded = useCameraStore((s) => s.ensureCamerasLoaded);
  const retryCameraLoad = useCameraStore((s) => s.retryCameraLoad);

  useEffect(() => {
    void ensureManifestLoaded();
  }, [ensureManifestLoaded]);

  // Manifest failed → legacy path: full dataset download + derived lists
  useEffect(() => {
    if (manifestPhase === 'error') void ensureCamerasLoaded().catch(() => {});
  }, [manifestPhase, ensureCamerasLoaded]);

  const ready = manifestPhase === 'ready' || isInitialized;
  if (!ready) {
    const bothFailed = manifestPhase === 'error' && loadPhase === 'error';
    return (
      <div className="flex flex-col items-center gap-2 py-6">
        {bothFailed ? (
          <>
            <span className="text-xs text-dark-400">Couldn't load camera data</span>
            <button
              onClick={() => void retryCameraLoad().catch(() => {})}
              className="text-xs text-accent hover:underline"
            >
              Retry
            </button>
          </>
        ) : (
          <>
            <div className="w-5 h-5 border-2 border-dark-600 border-t-accent rounded-full animate-spin" />
            <span className="text-xs text-dark-400">Loading filters…</span>
          </>
        )}
      </div>
    );
  }
  return <>{children}</>;
}

/**
 * Floating filter button + popover on the map surface (map mode only).
 * Replaces the old "Filters" section that was buried in the side panel /
 * mobile drawer. Staged UX is unchanged: selections are pending until Apply.
 */
export function CameraFilterControl() {
  const appMode = useAppModeStore((s) => s.appMode);
  const [open, setOpen] = useState(false);
  const rootRef = useRef<HTMLDivElement>(null);

  const filters = useCameraStore((s) => s.filters);
  const availableBrands = useCameraStore((s) => s.availableBrands);
  const availableOperators = useCameraStore((s) => s.availableOperators);
  const pendingFilters = useCameraStore((s) => s.pendingFilters);
  const togglePendingFilter = useCameraStore((s) => s.togglePendingFilter);
  const applyPendingFilters = useCameraStore((s) => s.applyPendingFilters);
  const resetAllFilters = useCameraStore((s) => s.resetAllFilters);
  const manifest = useCameraStore((s) => s.manifest);
  const country = useCameraStore((s) => s.country);

  const brandOptions = useMemo(
    () =>
      country === 'us' && manifest
        ? manifest.brands.map((b) => b.label)
        : availableBrands,
    [country, manifest, availableBrands]
  );
  const operatorOptions = useMemo(
    () =>
      country === 'us' && manifest
        ? manifest.operators.map((o) => o.label)
        : availableOperators,
    [country, manifest, availableOperators]
  );

  // Re-stage pending filters from the applied set each time the popover opens
  useEffect(() => {
    if (!open) return;
    const applied = useCameraStore.getState().filters;
    useCameraStore.setState({
      pendingFilters: {
        brands: [...applied.brands],
        operators: [...applied.operators],
        surveillanceZones: [...applied.surveillanceZones],
        mountTypes: [...applied.mountTypes],
      },
    });
  }, [open]);

  // Close on outside click
  useEffect(() => {
    if (!open) return;
    const handleClick = (e: MouseEvent) => {
      if (rootRef.current && !rootRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClick);
    return () => document.removeEventListener('mousedown', handleClick);
  }, [open]);

  const pendingChangeCount = useMemo(() => {
    let count = 0;
    for (const key of ['brands', 'operators', 'surveillanceZones', 'mountTypes'] as const) {
      const pending = new Set(pendingFilters[key]);
      const applied = new Set(filters[key]);
      for (const v of pending) if (!applied.has(v)) count++;
      for (const v of applied) if (!pending.has(v)) count++;
    }
    return count;
  }, [pendingFilters, filters]);

  const appliedFilterCount =
    filters.brands.length +
    filters.operators.length +
    filters.surveillanceZones.length +
    filters.mountTypes.length;

  if (appMode !== 'map') return null;

  return (
    <div ref={rootRef} className="map-filter-control absolute z-20 flex flex-col items-end">
      {/* Popover */}
      {open && (
        <div className="absolute bottom-full right-0 mb-2 w-[320px] max-w-[calc(100vw-24px)] bg-dark-900/95 backdrop-blur-md rounded-xl border border-dark-600 shadow-xl shadow-black/40 overflow-hidden">
          {/* Header */}
          <div className="flex items-center justify-between px-4 py-3 border-b border-dark-700/50">
            <div className="flex items-center gap-2.5">
              <span className="text-[13px] font-semibold text-white tracking-tight">Filters</span>
              {appliedFilterCount > 0 && (
                <span className="min-w-[20px] h-5 px-1.5 rounded-md bg-accent/15 text-accent text-[11px] font-bold flex items-center justify-center tabular-nums">
                  {appliedFilterCount}
                </span>
              )}
            </div>
            <button
              onClick={() => setOpen(false)}
              aria-label="Close filters"
              className="w-7 h-7 rounded-md flex items-center justify-center text-dark-400 hover:text-white hover:bg-dark-800 transition-colors"
            >
              <X className="w-4 h-4" />
            </button>
          </div>

          {/* Body — mobile cap keeps the popover's top edge below the search
              bar (button sits at drawer+120px from the bottom; search bar
              occupies the top ~115px; header+footer eat ~106px) */}
          <div className="px-4 py-2 max-h-[calc(100dvh-425px)] lg:max-h-[min(60vh,480px)] overflow-y-auto scrollbar-thin">
            <FilterDataGate>
              <div className="space-y-1">
                <SearchableMultiSelect
                  label="Brand"
                  items={brandOptions}
                  selected={pendingFilters.brands}
                  onToggle={(v) => togglePendingFilter('brands', v)}
                />
                <SearchableMultiSelect
                  label="Operator"
                  items={operatorOptions}
                  selected={pendingFilters.operators}
                  onToggle={(v) => togglePendingFilter('operators', v)}
                  note="~28% of cameras have operator data"
                />
                <CheckboxGroup
                  label="Surveillance Zone"
                  options={SURVEILLANCE_ZONES}
                  selected={pendingFilters.surveillanceZones}
                  onToggle={(v) => togglePendingFilter('surveillanceZones', v)}
                />
                <CheckboxGroup
                  label="Mount Type"
                  options={MOUNT_TYPES}
                  selected={pendingFilters.mountTypes}
                  onToggle={(v) => togglePendingFilter('mountTypes', v)}
                />
              </div>
            </FilterDataGate>
          </div>

          {/* Footer: Apply / Reset */}
          <div className="flex gap-2 px-4 py-3 border-t border-dark-700/50">
            <button
              onClick={resetAllFilters}
              className="flex-1 px-3 py-2 rounded-lg text-[11px] font-medium text-dark-400 hover:text-dark-200 hover:bg-dark-800 transition-colors"
            >
              Reset
            </button>
            <button
              onClick={applyPendingFilters}
              disabled={pendingChangeCount === 0}
              className={`flex-1 px-3 py-2 rounded-lg text-[11px] font-semibold transition-all duration-150 ${
                pendingChangeCount > 0
                  ? 'bg-accent text-white hover:bg-accent/90'
                  : 'bg-dark-800 text-dark-600 cursor-not-allowed'
              }`}
            >
              Apply{pendingChangeCount > 0 ? ` (${pendingChangeCount})` : ''}
            </button>
          </div>
        </div>
      )}

      {/* Trigger */}
      <button
        onClick={() => setOpen(!open)}
        aria-label="Filter cameras"
        aria-expanded={open}
        title="Filters"
        className={`filter-trigger relative w-[40px] h-[40px] flex items-center justify-center rounded-md transition-colors
          bg-dark-800 border border-dark-600
          ${open ? 'text-accent' : 'text-dark-300 hover:bg-dark-700 hover:text-white'}`}
      >
        <Filter className="w-4 h-4" fill={appliedFilterCount > 0 ? 'currentColor' : 'none'} />
        {appliedFilterCount > 0 && (
          <span className="absolute -top-1.5 -right-1.5 min-w-[18px] h-[18px] px-1 rounded-full bg-accent text-white text-[10px] font-bold flex items-center justify-center tabular-nums border-2 border-dark-900">
            {appliedFilterCount}
          </span>
        )}
      </button>
    </div>
  );
}
