import { useState, useEffect } from 'react';
import { useCameraStore } from '../../store';
import { BottomSheet, type SnapPoint } from '../common/BottomSheet';
import { ChevronLeft, ChevronRight, Map as MapIcon } from 'lucide-react';

// ─── About This Map ─────────────────────────────────────────────────────────
const ABOUT_BUTTONS: { href: string; label: string; primary?: boolean }[] = [
  { href: 'https://deflock.org/app', label: 'Download the DeFlock App', primary: true },
  { href: 'https://deflock.me', label: 'Learn How to Contribute' },
  { href: 'https://www.openstreetmap.org/about', label: 'Learn About OpenStreetMap' },
];

function AboutContent() {
  return (
    <div className="px-6 py-5 space-y-4">
      <p className="text-xs text-dark-400 leading-relaxed">
        DeFlock is an open-source, volunteer-powered project for identifying
        and documenting automated license plate readers. The map is powered by
        OpenStreetMap. Camera locations come from volunteers and the
        OpenStreetMap community, not a private company or government agency.
      </p>

      <div className="bg-dark-800/50 rounded-xl p-4 border border-dark-700/50">
        <p className="text-sm text-dark-300 font-medium mb-1">See something incorrect?</p>
        <p className="text-xs text-dark-400 leading-relaxed">
          A camera may be missing, moved, or misidentified. Download the
          DeFlock app, sign in with a free OpenStreetMap account, and fix it
          right from your phone.
        </p>
      </div>

      <div className="space-y-2">
        {ABOUT_BUTTONS.map((btn) => (
          <a
            key={btn.label}
            href={btn.href}
            target="_blank"
            rel="noopener noreferrer"
            className={`block w-full text-center px-4 py-2.5 rounded-lg text-xs font-semibold transition-colors ${
              btn.primary
                ? 'bg-accent text-white hover:bg-accent/90'
                : 'border border-dark-600 text-dark-200 hover:bg-dark-800'
            }`}
          >
            {btn.label}
          </a>
        ))}
      </div>
    </div>
  );
}

// ─── MapPanelContent ────────────────────────────────────────────────────────
export function MapPanelContent() {
  const country = useCameraStore((s) => s.country);
  const ensureManifestLoaded = useCameraStore((s) => s.ensureManifestLoaded);

  // Warm the few-KB manifest so the filter button's option lists are ready
  // without any dataset download. Country switches reset manifestPhase, so
  // the country dep re-warms with the new country's dictionary.
  useEffect(() => {
    void ensureManifestLoaded();
  }, [country, ensureManifestLoaded]);

  return <AboutContent />;
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
