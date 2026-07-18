import { useAppModeStore } from '../../store';
import { useDensityStore } from '../../store/densityStore';
import { StatusPill } from '../common/StatusPill';
import { formatBytes } from '../../utils/formatting';

/** Floating progress pill for Analysis mode data. States phase first (the
 *  interim choropleth), then county detail while it streams in behind. */
export function DensityLoadingPill() {
  const loadPhase = useDensityStore(s => s.loadPhase);
  const countiesData = useDensityStore(s => s.countiesData);
  const statesProgress = useDensityStore(s => s.statesProgress);
  const countiesProgress = useDensityStore(s => s.countiesProgress);
  const error = useDensityStore(s => s.error);
  const retryLoad = useDensityStore(s => s.retryLoad);
  const level = useAppModeStore(s => s.densitySettings.level);

  const statesLoading = loadPhase === 'idle' || loadPhase === 'fetching';
  const countiesLoading = level === 'county' && !countiesData;
  const progress = statesLoading ? statesProgress : countiesProgress;
  const progressText = progress && (progress.percent != null || progress.loadedBytes > 0)
    ? progress.percent != null
      ? `${progress.percent}%`
      : formatBytes(progress.loadedBytes)
    : null;

  return (
    <StatusPill
      loading={(statesLoading || countiesLoading) && !error}
      text={statesLoading ? 'Loading regions…' : 'Loading county detail…'}
      progressText={progressText}
      error={error ? "Couldn't load analysis data. Tap to retry." : null}
      onRetry={() => { void retryLoad(); }}
    />
  );
}
