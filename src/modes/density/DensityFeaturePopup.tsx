import { useEffect, useCallback, useState } from 'react';
import { X } from 'lucide-react';
import { useDensityStore } from '../../store/densityStore';
import { useAppModeStore } from '../../store';
import { DENSITY_COLOR_RAMPS } from '../../components/map/layers/DensityLayers';

function formatCompact(n: number): string {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 1_000) return `${(n / 1_000).toFixed(1)}K`;
  return n.toLocaleString();
}

function RankTrack({
  label,
  rank,
  total,
  percentile,
  detail,
  gradient,
}: {
  label: string;
  rank: number | null;
  total: number;
  percentile: number;
  detail: string;
  gradient: string;
}) {
  const hasData = rank != null && rank > 0;

  return (
    <div>
      <p className="text-xs text-dark-400 uppercase tracking-wider font-medium mb-2.5">{label}</p>

      {hasData ? (
        <div className="flex items-start gap-3">
          {/* Big rank number — left side */}
          <div className="flex-shrink-0">
            <p className="text-2xl font-display font-bold text-white tabular-nums leading-none">
              #{Math.round(rank)}
            </p>
            <p className="text-xs text-dark-400 mt-0.5">of {total.toLocaleString()}</p>
          </div>

          {/* Track + detail — right side */}
          <div className="flex-1 min-w-0 pt-1">
            <div className="relative h-2.5 rounded-full overflow-hidden">
              <div className="absolute inset-0 rounded-full" style={{ background: gradient }} />
              <div
                className="absolute top-1/2 -translate-y-1/2 w-3.5 h-3.5 rounded-full bg-white border-2 border-dark-900/40"
                style={{
                  left: `${Math.min(Math.max(percentile, 2), 98)}%`,
                  transform: 'translate(-50%, -50%)',
                  boxShadow: '0 0 6px rgba(255,255,255,0.5)',
                }}
              />
            </div>
            <p className="text-xs text-dark-400 mt-1.5">{detail}</p>
          </div>
        </div>
      ) : (
        <p className="text-sm text-dark-400">No cameras</p>
      )}
    </div>
  );
}

export function DensityFeaturePopup() {
  const selectedFeature = useDensityStore((s) => s.selectedFeature);
  const setSelectedFeature = useDensityStore((s) => s.setSelectedFeature);
  const colorScheme = useAppModeStore((s) => s.densitySettings.colorScheme);
  const trackGradient = DENSITY_COLOR_RAMPS[colorScheme].gradient.replace('90deg', 'to right');
  const [isMobile, setIsMobile] = useState(false);

  useEffect(() => {
    const check = () => setIsMobile(window.innerWidth < 1024);
    check();
    window.addEventListener('resize', check);
    return () => window.removeEventListener('resize', check);
  }, []);

  const handleClose = useCallback(() => {
    setSelectedFeature(null);
  }, [setSelectedFeature]);

  useEffect(() => {
    if (!selectedFeature) return;
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') handleClose(); };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [selectedFeature, handleClose]);

  if (!selectedFeature) return null;

  const f = selectedFeature;
  const total = f.level === 'state' ? 51 : 3222;

  const perCapitaDetail = `${formatCompact(f.population)} pop · ${f.camerasPerCapita.toFixed(2)} per 10K`;
  const hasRoadData = f.roadMiles != null && f.percentilePerRoadMile != null;
  const perMileDetail = hasRoadData
    ? `${formatCompact(f.roadMiles!)} mi · ${(f.camerasPerRoadMile * 1000) >= 10 ? Math.round(f.camerasPerRoadMile * 1000).toLocaleString() : (f.camerasPerRoadMile * 1000).toFixed(1)} per 1K mi`
    : 'Road data unavailable';

  const content = (
    <div className="p-4">
      {/* Header */}
      <div className="flex items-start justify-between gap-3 mb-1">
        <div className="min-w-0">
          <span className="text-xs text-dark-400 uppercase tracking-wider font-medium">
            {f.level === 'state' ? 'State' : 'County'}
          </span>
          <p className="text-[15px] font-display font-semibold text-white leading-snug mt-0.5 truncate">
            {f.name}
          </p>
        </div>
        <button
          onClick={handleClose}
          className="flex-shrink-0 w-6 h-6 rounded-lg bg-dark-700/60 hover:bg-dark-600 flex items-center justify-center transition-colors mt-0.5"
          aria-label="Close"
        >
          <X className="w-3.5 h-3.5 text-dark-400" />
        </button>
      </div>

      {/* Camera count */}
      <p className="text-sm text-accent font-medium tabular-nums mb-4">
        {f.cameraCount.toLocaleString()} camera{f.cameraCount !== 1 ? 's' : ''}
      </p>

      <div className="border-t border-dark-700/40 mb-4" />

      {/* Per Capita rank track */}
      <RankTrack
        label="Cameras Per Capita"
        rank={f.rankPerCapita}
        total={total}
        percentile={f.percentilePerCapita}
        detail={perCapitaDetail}
        gradient={trackGradient}
      />

      <div className="border-t border-dark-700/40 my-4" />

      {/* Per Road Mile rank track */}
      <RankTrack
        label="Cameras Per Road Mile"
        rank={f.rankPerRoadMile}
        total={total}
        percentile={f.percentilePerRoadMile ?? 0}
        detail={perMileDetail}
        gradient={trackGradient}
      />
    </div>
  );

  const cardClass =
    'bg-dark-800 border border-dark-600 rounded-md';

  if (isMobile) {
    return (
      <div className={`fixed bottom-[68px] left-3 right-3 z-40 ${cardClass} lg:hidden`}>
        {content}
      </div>
    );
  }

  return (
    <div className={`absolute bottom-6 right-6 z-20 w-80 ${cardClass} hidden lg:block`}>
      {content}
    </div>
  );
}
