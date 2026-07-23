import { describe, it, expect, vi, beforeEach } from 'vitest';
import { useNetworkStore, type NetworkNode } from './networkStore';

const NODES_URL = '/sharing-network-nodes.geojson';
const ADJ_URL = '/sharing-network-adjacency.json';

function nodeFeature(id: string, lng = -84.4, lat = 33.7) {
  return {
    type: 'Feature',
    geometry: { type: 'Point', coordinates: [lng, lat] },
    properties: { id, name: `Agency ${id}`, type: 'pd', isPortal: true, geocodeMethod: 'exact' },
  };
}

const NODES_BODY = JSON.stringify({
  type: 'FeatureCollection',
  features: [nodeFeature('a'), nodeFeature('b'), nodeFeature('c')],
});
const ADJ_BODY = JSON.stringify({ a: ['b'], b: ['a', 'c'] });

/** fetch stub with a manually-resolvable adjacency response */
function stubFetch(opts: { adjacencyDelayed?: boolean; failAdjacency?: boolean; failNodes?: boolean } = {}) {
  let releaseAdjacency: () => void = () => {};
  const adjacencyGate = new Promise<void>(resolve => { releaseAdjacency = resolve; });

  const fetchMock = vi.fn(async (url: string) => {
    if (url === NODES_URL) {
      if (opts.failNodes) return new Response('', { status: 500 });
      return new Response(NODES_BODY, { status: 200 });
    }
    if (url === ADJ_URL) {
      if (opts.adjacencyDelayed) await adjacencyGate;
      if (opts.failAdjacency) return new Response('', { status: 500 });
      return new Response(ADJ_BODY, { status: 200 });
    }
    throw new Error(`Unexpected fetch: ${url}`);
  });

  vi.stubGlobal('fetch', fetchMock);
  return { fetchMock, releaseAdjacency };
}

/** Poll until the store satisfies a predicate (progressive commits are async). */
async function waitFor(predicate: () => boolean, timeoutMs = 1000) {
  const start = Date.now();
  while (!predicate()) {
    if (Date.now() - start > timeoutMs) throw new Error('waitFor timed out');
    await new Promise(r => setTimeout(r, 5));
  }
}

beforeEach(() => {
  vi.unstubAllGlobals();
  useNetworkStore.setState({
    loadPhase: 'idle',
    adjacencyReady: false,
    nodesMap: new Map(),
    nodesArray: [],
    adjacency: {},
    reverseAdjacency: {},
    selectedNodeId: null,
    selectedNode: null,
    selectedArcs: [],
    nodesProgress: null,
    adjacencyProgress: null,
    error: null,
  });
});

describe('loadNetworkData progressive commits', () => {
  it('commits nodes and flips loadPhase to ready before adjacency arrives', async () => {
    const { releaseAdjacency } = stubFetch({ adjacencyDelayed: true });

    const loadPromise = useNetworkStore.getState().loadNetworkData();
    await waitFor(() => useNetworkStore.getState().loadPhase === 'ready');

    expect(useNetworkStore.getState().nodesArray).toHaveLength(3);
    expect(useNetworkStore.getState().adjacencyReady).toBe(false);

    releaseAdjacency();
    await loadPromise;

    expect(useNetworkStore.getState().adjacencyReady).toBe(true);
    expect(useNetworkStore.getState().reverseAdjacency['a']).toEqual(['b']);
  });

  it('backfills arcs for a selection made while adjacency was streaming', async () => {
    const { releaseAdjacency } = stubFetch({ adjacencyDelayed: true });

    const loadPromise = useNetworkStore.getState().loadNetworkData();
    await waitFor(() => useNetworkStore.getState().loadPhase === 'ready');

    useNetworkStore.getState().setSelectedNodeId('a');
    expect(useNetworkStore.getState().selectedArcs).toHaveLength(0);

    releaseAdjacency();
    await loadPromise;

    const arcs = useNetworkStore.getState().selectedArcs;
    expect(arcs).toHaveLength(1);
    expect(arcs[0].target.id).toBe('b');
    expect(arcs[0].direction).toBe('mutual');
  });

  it('keeps nodes usable when only adjacency fails, and retries just adjacency', async () => {
    const { fetchMock } = stubFetch({ failAdjacency: true });

    await useNetworkStore.getState().loadNetworkData();

    expect(useNetworkStore.getState().loadPhase).toBe('ready');
    expect(useNetworkStore.getState().nodesArray).toHaveLength(3);
    expect(useNetworkStore.getState().error).toMatch(/Adjacency/);

    // Retry: only the adjacency URL is refetched
    fetchMock.mockClear();
    stubFetch({});
    await useNetworkStore.getState().loadNetworkData();

    const retried = (globalThis.fetch as ReturnType<typeof vi.fn>).mock.calls.map(c => c[0]);
    expect(retried).toEqual([ADJ_URL]);
    expect(useNetworkStore.getState().adjacencyReady).toBe(true);
    expect(useNetworkStore.getState().error).toBeNull();
  });

  it('sets loadPhase to error when the nodes fetch fails', async () => {
    stubFetch({ failNodes: true });

    await useNetworkStore.getState().loadNetworkData();

    expect(useNetworkStore.getState().loadPhase).toBe('error');
    expect(useNetworkStore.getState().error).toMatch(/Nodes/);
  });
});

/* ------------------------------------------------------------------ */
/*  Inferred-connection gating                                         */
/* ------------------------------------------------------------------ */

function makeNode(id: string, isPortal: boolean): NetworkNode {
  return {
    id,
    name: id,
    city: '',
    state: 'TX',
    type: 'pd',
    isPortal,
    isInactive: false,
    isLikelyAggregator: false,
    portalSlug: isPortal ? id : null,
    aliases: [],
    cameras: 0,
    searches: 0,
    vehiclesCaptured: 0,
    connectionCount: 1,
    population: 0,
    hotlistHits: 0,
    geocodeMethod: 'city',
    coordinates: [-97, 32],
  };
}

describe('networkStore defaults', () => {
  it('shows all agencies by default (portalOnly off)', () => {
    expect(useNetworkStore.getState().portalOnly).toBe(false);
  });
});

describe('inferred-connection gating', () => {
  const portalA = makeNode('portalA', true);
  const plainB = makeNode('plainB', false);

  beforeEach(() => {
    useNetworkStore.setState({
      nodesMap: new Map([
        ['portalA', portalA],
        ['plainB', plainB],
      ]),
      nodesArray: [portalA, plainB],
      adjacency: { portalA: ['plainB'] },
      reverseAdjacency: { plainB: ['portalA'] },
      adjacencyReady: true,
      inferredConnectionsEnabled: false,
    });
  });

  it('portal selection yields arcs while the flag is off', () => {
    useNetworkStore.getState().setSelectedNodeId('portalA');
    const arcs = useNetworkStore.getState().selectedArcs;
    expect(arcs).toHaveLength(1);
    expect(arcs[0].target.id).toBe('plainB');
  });

  it('non-portal selection yields no arcs while the flag is off', () => {
    useNetworkStore.getState().setSelectedNodeId('plainB');
    expect(useNetworkStore.getState().selectedNode?.id).toBe('plainB');
    expect(useNetworkStore.getState().selectedArcs).toHaveLength(0);
  });

  it('toggling the flag on populates arcs for the selected non-portal node', () => {
    useNetworkStore.getState().setSelectedNodeId('plainB');
    useNetworkStore.getState().toggleInferredConnections();
    const arcs = useNetworkStore.getState().selectedArcs;
    expect(useNetworkStore.getState().inferredConnectionsEnabled).toBe(true);
    expect(arcs).toHaveLength(1);
    expect(arcs[0].direction).toBe('incoming');
  });

  it('toggling the flag off clears arcs for the selected non-portal node', () => {
    useNetworkStore.setState({ inferredConnectionsEnabled: true });
    useNetworkStore.getState().setSelectedNodeId('plainB');
    expect(useNetworkStore.getState().selectedArcs).toHaveLength(1);
    useNetworkStore.getState().toggleInferredConnections();
    expect(useNetworkStore.getState().selectedArcs).toHaveLength(0);
  });

  it('toggling the flag leaves a selected portal node untouched', () => {
    useNetworkStore.getState().setSelectedNodeId('portalA');
    useNetworkStore.getState().toggleInferredConnections();
    expect(useNetworkStore.getState().selectedArcs).toHaveLength(1);
  });
});
