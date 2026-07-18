import { useNetworkStore } from '../../store/networkStore';
import { StatusPill } from '../common/StatusPill';
import { formatBytes } from '../../utils/formatting';

/** Floating progress pill for the Network mode data download. Nodes phase
 *  first (dots), then adjacency (connections). Mobile and desktop. */
export function NetworkLoadingPill() {
  const loadPhase = useNetworkStore(s => s.loadPhase);
  const adjacencyReady = useNetworkStore(s => s.adjacencyReady);
  const nodesProgress = useNetworkStore(s => s.nodesProgress);
  const adjacencyProgress = useNetworkStore(s => s.adjacencyProgress);
  const error = useNetworkStore(s => s.error);
  const loadNetworkData = useNetworkStore(s => s.loadNetworkData);

  const nodesLoading = loadPhase === 'idle' || loadPhase === 'fetching';
  const progress = nodesLoading ? nodesProgress : adjacencyProgress;
  const progressText = progress && (progress.percent != null || progress.loadedBytes > 0)
    ? progress.percent != null
      ? `${progress.percent}%`
      : formatBytes(progress.loadedBytes)
    : null;

  return (
    <StatusPill
      loading={(nodesLoading || !adjacencyReady) && !error}
      text={nodesLoading ? 'Loading agencies…' : 'Loading connections…'}
      progressText={progressText}
      error={error ? "Couldn't load network data. Tap to retry." : null}
      onRetry={() => { void loadNetworkData(); }}
    />
  );
}
