import { useState, useEffect, useMemo } from 'react';
import { useCameraStore, useMapStore } from '../../store';
import { useMapModeStore } from '../../store/mapModeStore';
import type { MapVisualization, ActiveView, OverlayState } from '../../store/mapModeStore';
import type { BoundaryLevel } from '../../services/boundaryDataService';
import { BottomSheet, type SnapPoint } from '../common/BottomSheet';
import { HeatmapControls } from '../../modes/heatmap/HeatmapControls';
import { HeatmapLegend } from '../../modes/heatmap/HeatmapLegend';
import { ChevronLeft, ChevronRight, ChevronDown, Map as MapIcon } from 'lucide-react';

// ─── Constants ──────────────────────────────────────────────────────────────
const CAMERA_VIEW_OPTIONS: { id: MapVisualization; label: string; description: string }[] = [
  { id: 'auto', label: 'Auto', description: 'Dots that sharpen as you zoom' },
  { id: 'heatmap', label: 'Heatmap', description: 'Density blobs' },
];

// ─── About This Map ─────────────────────────────────────────────────────────
const ABOUT_ITEMS: { title: string; body: string; link?: { href: string; label: string } }[] = [
  {
    title: 'How it works',
    body: 'Every marker is an automated license plate reader (ALPR) documented by DeFlock and OpenStreetMap contributors. The map refreshes hourly. Zoom in to see individual cameras and the direction they face.',
  },
  {
    title: 'Contribute',
    body: 'Anyone can add cameras. Spot an ALPR that is not on the map? Add it to OpenStreetMap and it will show up here.',
    link: { href: 'https://deflock.me', label: 'Learn how to contribute' },
  },
  {
    title: 'Fix a camera',
    body: 'See a camera that is wrong or has been removed? Open its popup and use the View OSM link to correct it.',
  },
  {
    title: 'About DeFlock',
    body: 'DeFlock is a volunteer project that maps ALPR surveillance so everyone can see who is watching.',
    link: { href: 'https://deflock.org', label: 'Visit deflock.org' },
  },
];

function AboutSection() {
  return (
    <Section title="About This Map" defaultOpen>
      <div className="space-y-3">
        {ABOUT_ITEMS.map((item) => (
          <div key={item.title} className="bg-dark-800/50 rounded-xl p-4 border border-dark-700/50">
            <p className="text-sm text-dark-300 font-medium mb-1">{item.title}</p>
            <p className="text-xs text-dark-400 leading-relaxed">{item.body}</p>
            {item.link && (
              <a
                href={item.link.href}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-block mt-2 text-xs font-medium text-accent hover:underline"
              >
                {item.link.label} →
              </a>
            )}
          </div>
        ))}
      </div>
    </Section>
  );
}

// ─── Collapsible Section (top-level) ────────────────────────────────────────
function Section({
  title,
  badge,
  defaultOpen = false,
  children,
}: {
  title: string;
  badge?: number;
  defaultOpen?: boolean;
  children: React.ReactNode;
}) {
  const [isOpen, setIsOpen] = useState(defaultOpen);

  return (
    <div className="border-b border-dark-700/50">
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="w-full flex items-center justify-between px-6 py-3.5 hover:bg-dark-800/30 transition-colors"
        aria-expanded={isOpen}
      >
        <div className="flex items-center gap-2.5">
          <span className="text-[13px] font-semibold text-white tracking-tight">{title}</span>
          {badge !== undefined && badge > 0 && (
            <span className="min-w-[20px] h-5 px-1.5 rounded-md bg-accent/15 text-accent text-[11px] font-bold flex items-center justify-center tabular-nums">
              {badge}
            </span>
          )}
        </div>
        <ChevronDown
          className={`w-3.5 h-3.5 text-dark-500 transition-transform duration-200 ${isOpen ? 'rotate-180' : ''}`}
        />
      </button>
      {isOpen && <div className="px-6 pb-5">{children}</div>}
    </div>
  );
}

// ─── Sub-label (within a section) ───────────────────────────────────────────
function SubLabel({ children }: { children: React.ReactNode }) {
  return (
    <span className="block text-[10px] font-semibold text-dark-500 uppercase tracking-[0.08em] mb-2">
      {children}
    </span>
  );
}

// ─── Camera View Radio Group ────────────────────────────────────────────────
function CameraViewSelector({
  visualization,
  activeView,
  onChange,
}: {
  visualization: MapVisualization;
  activeView: ActiveView;
  onChange: (viz: MapVisualization) => void;
}) {
  return (
    <div>
      <SubLabel>Camera View</SubLabel>
      <div className="grid grid-cols-2 gap-1.5">
        {CAMERA_VIEW_OPTIONS.map(({ id, label, description }) => {
          const isSelected = visualization === id;
          const autoSuffix = id === 'auto' && isSelected
            ? ` (${activeView.charAt(0).toUpperCase() + activeView.slice(1)})`
            : '';

          return (
            <button
              key={id}
              onClick={() => onChange(id)}
              className={`flex items-center gap-2 px-2.5 py-2 rounded-lg text-left transition-all duration-150 ${
                isSelected
                  ? 'bg-accent/10 ring-1 ring-accent/30'
                  : 'hover:bg-dark-800/80'
              }`}
            >
              <div
                className={`w-3 h-3 rounded-full border-[1.5px] flex-shrink-0 flex items-center justify-center transition-colors ${
                  isSelected ? 'border-accent' : 'border-dark-600'
                }`}
              >
                {isSelected && <div className="w-1.5 h-1.5 rounded-full bg-accent" />}
              </div>
              <div className="min-w-0">
                <span className={`text-xs font-medium leading-none ${isSelected ? 'text-white' : 'text-dark-300'}`}>
                  {label}{autoSuffix}
                </span>
                <p className="text-[10px] text-dark-500 leading-tight mt-0.5">{description}</p>
              </div>
            </button>
          );
        })}
      </div>
    </div>
  );
}

// ─── Overlay Toggle ─────────────────────────────────────────────────────────
function OverlayToggle({
  label,
  enabled,
  onToggle,
  loading,
}: {
  label: string;
  enabled: boolean;
  onToggle: () => void;
  loading?: boolean;
}) {
  return (
    <button
      onClick={onToggle}
      role="switch"
      aria-checked={enabled}
      aria-label={`Toggle ${label}`}
      className="w-full flex items-center justify-between px-2.5 py-2 rounded-lg transition-colors hover:bg-dark-800/60"
    >
      <div className="flex items-center gap-2">
        <span className={`text-xs ${enabled ? 'text-dark-200' : 'text-dark-400'}`}>
          {label}
        </span>
        {loading && (
          <div className="w-3 h-3 border border-dark-400 border-t-transparent rounded-full animate-spin" />
        )}
      </div>
      <div
        className={`w-8 h-[18px] rounded-full relative transition-colors duration-200 ${
          enabled ? 'bg-accent' : 'bg-dark-700'
        }`}
      >
        <div
          className={`absolute top-[2px] w-[14px] h-[14px] rounded-full bg-white shadow-sm transition-transform duration-200 ${
            enabled ? 'translate-x-[16px]' : 'translate-x-[2px]'
          }`}
        />
      </div>
    </button>
  );
}

// ─── MapPanelContent ────────────────────────────────────────────────────────
export function MapPanelContent() {
  const visualization = useMapModeStore((s) => s.visualization);
  const activeView = useMapModeStore((s) => s.activeView);
  const setVisualization = useMapModeStore((s) => s.setVisualization);
  const overlays = useMapModeStore((s) => s.overlays);
  const toggleOverlay = useMapModeStore((s) => s.toggleOverlay);
  const boundaryLoading = useMapModeStore((s) => s.boundaryLoading);
  const fetchBoundary = useMapModeStore((s) => s.fetchBoundary);
  const currentZoom = useMapStore(s => s.zoom);

  const handleBoundaryToggle = (overlayKey: keyof OverlayState, level: BoundaryLevel) => {
    toggleOverlay(overlayKey);
    if (!overlays[overlayKey]) {
      fetchBoundary(level);
    }
  };

  // Viewport-reactive stats (respects active filters)
  const bounds = useMapStore(s => s.bounds);
  const filteredCameras = useCameraStore((s) => s.filteredCameras);
  // Tiles mode reports the rendered viewport count before the (lazily-loaded)
  // GeoJSON dataset exists — prefer it so the hero stat isn't stuck at 0.
  const tileViewCameraCount = useMapStore(s => s.tileViewCameraCount);

  const viewportCount = useMemo(() => {
    if (!bounds) return 0;
    return filteredCameras.filter(
      (c) => c.lat >= bounds.south && c.lat <= bounds.north && c.lon >= bounds.west && c.lon <= bounds.east
    ).length;
  }, [bounds, filteredCameras]);

  // In tiles mode (default render path), filteredCameras is empty until the
  // GeoJSON dataset lazy-loads, so viewportCount reads 0. Prefer the
  // tile-rendered viewport count when available — same pattern as CameraStats.tsx.
  const heroViewCount = tileViewCameraCount !== null ? tileViewCameraCount : viewportCount;

  const country = useCameraStore((s) => s.country);
  const ensureManifestLoaded = useCameraStore((s) => s.ensureManifestLoaded);

  // Warm the few-KB manifest so the filter button's option lists are ready
  // without any dataset download. Country switches reset manifestPhase, so
  // the country dep re-warms with the new country's dictionary.
  useEffect(() => {
    void ensureManifestLoaded();
  }, [country, ensureManifestLoaded]);

  return (
    <div className="flex flex-col">
      {/* Hero: Cameras in View */}
      <div className="px-6 pt-4 pb-3">
        <div className="bg-gradient-to-br from-accent/10 to-accent/[0.03] border border-accent/15 rounded-xl px-5 py-4 text-center">
          <div className="flex items-baseline justify-center gap-1.5">
            <div className="w-2 h-2 rounded-full bg-accent shadow-[0_0_8px_rgba(56,189,248,0.5)] flex-shrink-0 relative -top-0.5" />
            <span className="text-[40px] font-bold text-accent tracking-tight leading-none tabular-nums">
              {heroViewCount.toLocaleString()}
            </span>
          </div>
          <p className="text-[11px] text-dark-500 uppercase tracking-[1.5px] mt-1">
            cameras in view
          </p>
        </div>
      </div>

      {/* Divider before sections */}
      <div className="h-px bg-dark-700/50 mx-6" />

      {/* Section: About */}
      <AboutSection />

      {/* Section: Layers */}
      <Section title="Layers">
        <CameraViewSelector
          visualization={visualization}
          activeView={activeView}
          onChange={(viz) => setVisualization(viz, currentZoom)}
        />

        <div className="mt-4 pt-4 border-t border-dark-700/30">
          <SubLabel>Overlays</SubLabel>
          <div className="space-y-0.5">
            <OverlayToggle
              label="State Boundaries"
              enabled={overlays.stateBoundaries}
              onToggle={() => handleBoundaryToggle('stateBoundaries', 'state')}
              loading={boundaryLoading.state === 'loading'}
            />
            <OverlayToggle
              label="County Boundaries"
              enabled={overlays.countyBoundaries}
              onToggle={() => handleBoundaryToggle('countyBoundaries', 'county')}
              loading={boundaryLoading.county === 'loading'}
            />
            <OverlayToggle
              label="Municipal Boundaries"
              enabled={overlays.municipalBoundaries}
              onToggle={() => handleBoundaryToggle('municipalBoundaries', 'municipal')}
              loading={boundaryLoading.municipal === 'loading'}
            />
          </div>
        </div>
      </Section>

      {/* Section: Heatmap Settings */}
      {activeView === 'heatmap' && (
        <Section title="Heatmap Settings">
          <HeatmapControls />
          <div className="mt-4">
            <HeatmapLegend />
          </div>
        </Section>
      )}

    </div>
  );
}

// ─── MapPanel (exported) ────────────────────────────────────────────────────
export function MapPanel() {
  const [isMobile, setIsMobile] = useState(false);
  const [snapPoint, setSnapPoint] = useState<SnapPoint>('minimized');
  const [isCollapsed, setIsCollapsed] = useState(false);
  const [hasAnimated, setHasAnimated] = useState(false);

  const cameraCount = useCameraStore((s) => s.cameras.length);
  const filteredCount = useCameraStore((s) => s.filteredCameras.length);
  const filters = useCameraStore((s) => s.filters);

  const activeFilterCount =
    filters.brands.length +
    filters.operators.length +
    filters.surveillanceZones.length +
    filters.mountTypes.length +
    (filters.state ? 1 : 0);

  useEffect(() => {
    const checkMobile = () => setIsMobile(window.innerWidth < 1024);
    checkMobile();
    window.addEventListener('resize', checkMobile);
    return () => window.removeEventListener('resize', checkMobile);
  }, []);

  useEffect(() => {
    const timer = setTimeout(() => setHasAnimated(true), 50);
    return () => clearTimeout(timer);
  }, []);

  // Mobile: Bottom Sheet
  if (isMobile) {
    return (
      <BottomSheet
        snapPoint={snapPoint}
        onSnapPointChange={setSnapPoint}
        minimizedHeight={84}
        peekHeight={84}
        fullHeight={85}
        headerContent={
          <button
            onClick={() => setSnapPoint('full')}
            className="w-full flex items-center justify-between py-1"
          >
            <div className="flex items-center gap-3">
              <div className="w-9 h-9 rounded-xl bg-accent/10 border border-dark-600 flex items-center justify-center">
                <MapIcon className="w-4 h-4 text-accent" />
              </div>
              <div className="text-left">
                <div className="flex items-center gap-2">
                  <p className="text-sm font-semibold text-white">DeFlock Maps</p>
                  {activeFilterCount > 0 && (
                    <span className="px-1.5 py-0.5 rounded-full bg-accent/10 text-accent text-xs font-semibold">
                      {activeFilterCount} filter{activeFilterCount !== 1 ? 's' : ''}
                    </span>
                  )}
                </div>
                <p className="text-xs text-dark-400">
                  {filteredCount === cameraCount
                    ? `${cameraCount.toLocaleString()} cameras`
                    : `${filteredCount.toLocaleString()} / ${cameraCount.toLocaleString()} cameras`}
                </p>
              </div>
            </div>
            <svg className="w-5 h-5 text-dark-400" viewBox="0 0 24 24" fill="currentColor">
              <path d="M7.41 15.41L12 10.83l4.59 4.58L18 14l-6-6-6 6z" />
            </svg>
          </button>
        }
      >
        {snapPoint === 'full' && (
          <div className="pb-8">
            <MapPanelContent />
            <div className="mt-6 pt-4 border-t border-dark-700/50">
              <p className="text-[10px] text-dark-500 text-center">
                Maps by{' '}
                <a href="https://openroadlabs.org" target="_blank" rel="noopener noreferrer" className="hover:text-dark-300 transition-colors">OpenRoad Labs LLC</a>
              </p>
            </div>
          </div>
        )}
      </BottomSheet>
    );
  }

  // Desktop: Side Panel
  return (
    <div className="hidden lg:block relative h-full">
      <div
        className={`flex flex-col h-full bg-dark-900 border-r border-dark-700/50 ${
          hasAnimated ? 'transition-all duration-300' : ''
        } ${isCollapsed ? 'w-0 overflow-hidden' : 'w-[400px]'}`}
      >
        {/* Header */}
        <div className="flex-shrink-0 px-6 py-5 border-b border-dark-700/50">
          <h2 className="text-lg font-display font-semibold text-white mb-1">DeFlock Maps</h2>
          <p className="text-xs text-dark-400 leading-relaxed">
            Crowdsourced ALPR surveillance map. Data from{' '}
            <a
              href="https://deflock.me"
              target="_blank"
              rel="noopener noreferrer"
              className="text-accent hover:underline"
            >
              DeFlock
            </a>{' '}
            &amp;{' '}
            <a
              href="https://www.openstreetmap.org"
              target="_blank"
              rel="noopener noreferrer"
              className="text-accent hover:underline"
            >
              OSM
            </a>{' '}
            contributors.
          </p>
        </div>

        {/* Scrollable content */}
        <div className="flex-1 overflow-y-auto">
          <MapPanelContent />
        </div>

        {/* Footer */}
        <div className="flex-shrink-0 px-6 py-3 border-t border-dark-700/50 bg-dark-800/50">
          <p className="text-[10px] text-dark-500 text-center">
            Maps by{' '}
            <a href="https://openroadlabs.org" target="_blank" rel="noopener noreferrer" className="hover:text-dark-300 transition-colors">OpenRoad Labs LLC</a>
          </p>
        </div>
      </div>

      {/* Expand/Collapse Toggle */}
      <button
        onClick={() => setIsCollapsed(!isCollapsed)}
        className={`absolute z-50 top-1/2 -translate-y-1/2 ${
          hasAnimated ? 'transition-all duration-300' : ''
        } ${isCollapsed ? 'left-0' : 'left-[400px]'} w-6 h-16 bg-dark-800 hover:bg-dark-700 border border-dark-600 border-l-0 rounded-r-lg flex items-center justify-center group`}
        aria-label={isCollapsed ? 'Expand panel' : 'Collapse panel'}
      >
        {isCollapsed ? (
          <ChevronRight className="w-4 h-4 text-dark-300 group-hover:text-white transition-colors" />
        ) : (
          <ChevronLeft className="w-4 h-4 text-dark-300 group-hover:text-white transition-colors" />
        )}
      </button>
    </div>
  );
}
