import { LegacyMapLink } from '@/components/common';

interface MapLoadingScreenProps {
  error: string;
  onRetry?: () => void;
}

/**
 * Full-screen error overlay for the map page. Shown only for boot/map-init
 * failures (WebGL missing, watchdog timeout, tile source stall) — the
 * happy-path loading curtain is gone: the shell renders immediately and the
 * map fades in as tiles paint. Post-boot GeoJSON failures are handled
 * in-panel / by LoadingPill instead.
 */
export function MapLoadingScreen({ error, onRetry }: MapLoadingScreenProps) {
  return (
    <div className="fixed inset-0 z-[100] flex flex-col bg-dark-900 overflow-hidden">
      <header className="h-[38px] lg:h-12 bg-dark-900 border-b border-hairline flex items-center shrink-0">
        <div className="w-full px-4 lg:px-5">
          <a href="https://deflock.org" className="flex items-center gap-2">
            <img src="/deflock-icon.png" alt="DeFlock Icon" className="h-5 lg:h-8 w-auto object-contain" />
            <img src="/deflock-logo.svg" alt="DeFlock Logo" className="h-5 lg:h-8 w-auto object-contain" />
          </a>
        </div>
      </header>

      <div className="flex-1 flex items-center justify-center relative">
        <div className="relative z-10 flex flex-col items-center gap-6 px-6 max-w-md text-center">
          <div className="flex items-center gap-2 lg:gap-3 opacity-50">
            <img src="/deflock-icon.png" alt="" className="h-12 lg:h-20 w-auto object-contain" />
            <img src="/deflock-logo.svg" alt="DeFlock" className="h-12 lg:h-20 w-auto object-contain" />
          </div>
          <div>
            <h2 className="text-xl font-display font-bold text-white mb-2">
              Couldn't Load Map
            </h2>
            <p className="text-dark-300 text-sm">{error}</p>
          </div>
          <div className="flex flex-col gap-3 w-full max-w-xs">
            <button
              onClick={onRetry}
              className="w-full px-6 py-3 bg-accent hover:bg-accent-hover text-white font-semibold rounded-md transition-colors"
            >
              Try Again
            </button>
            <LegacyMapLink variant="button" className="flex-none" />
          </div>
        </div>
      </div>
    </div>
  );
}
