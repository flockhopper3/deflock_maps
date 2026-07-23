import { describe, it, expect, vi, beforeEach } from 'vitest';
import { useDensityStore } from './densityStore';
import { clearDensityCache } from '../services/densityDataService';

const STATES_URL = '/geo/states-metrics.geojson';
const COUNTIES_URL = '/geo/counties-metrics.geojson';

function fc(geoid: string, population = 100000) {
  return JSON.stringify({
    type: 'FeatureCollection',
    features: [{
      type: 'Feature',
      geometry: { type: 'Polygon', coordinates: [[[0, 0], [1, 0], [1, 1], [0, 0]]] },
      properties: { GEOID: geoid, population, cameraCount: 5 },
    }],
  });
}

function stubFetch(opts: { countiesDelayed?: boolean; failCounties?: boolean; failStates?: boolean } = {}) {
  let releaseCounties: () => void = () => {};
  const countiesGate = new Promise<void>(resolve => { releaseCounties = resolve; });

  const fetchMock = vi.fn(async (url: string) => {
    if (url === STATES_URL) {
      if (opts.failStates) return new Response('', { status: 500 });
      return new Response(fc('13'), { status: 200 });
    }
    if (url === COUNTIES_URL) {
      if (opts.countiesDelayed) await countiesGate;
      if (opts.failCounties) return new Response('', { status: 500 });
      return new Response(fc('13121'), { status: 200 });
    }
    throw new Error(`Unexpected fetch: ${url}`);
  });

  vi.stubGlobal('fetch', fetchMock);
  return { fetchMock, releaseCounties };
}

async function waitFor(predicate: () => boolean, timeoutMs = 1000) {
  const start = Date.now();
  while (!predicate()) {
    if (Date.now() - start > timeoutMs) throw new Error('waitFor timed out');
    await new Promise(r => setTimeout(r, 5));
  }
}

beforeEach(() => {
  vi.unstubAllGlobals();
  clearDensityCache();
  useDensityStore.setState({
    loadPhase: 'idle',
    statesData: null,
    countiesData: null,
    statesProgress: null,
    countiesProgress: null,
    error: null,
  });
});

describe('loadAllLevels progressive commits', () => {
  it('commits states and flips loadPhase to ready before counties arrive', async () => {
    const { releaseCounties } = stubFetch({ countiesDelayed: true });

    const loadPromise = useDensityStore.getState().loadAllLevels();
    await waitFor(() => useDensityStore.getState().loadPhase === 'ready');

    expect(useDensityStore.getState().statesData?.features).toHaveLength(1);
    expect(useDensityStore.getState().countiesData).toBeNull();

    releaseCounties();
    await loadPromise;

    expect(useDensityStore.getState().countiesData?.features).toHaveLength(1);
  });

  it('keeps states usable when only counties fail, and retry refetches only counties', async () => {
    const { fetchMock } = stubFetch({ failCounties: true });

    await useDensityStore.getState().loadAllLevels();

    expect(useDensityStore.getState().loadPhase).toBe('ready');
    expect(useDensityStore.getState().statesData).not.toBeNull();
    expect(useDensityStore.getState().error).not.toBeNull();

    fetchMock.mockClear();
    stubFetch({});
    await useDensityStore.getState().retryLoad();

    const retried = (globalThis.fetch as ReturnType<typeof vi.fn>).mock.calls
      .map(c => c[0]).filter(u => u === STATES_URL || u === COUNTIES_URL);
    expect(retried).toEqual([COUNTIES_URL]);
    expect(useDensityStore.getState().countiesData).not.toBeNull();
    expect(useDensityStore.getState().error).toBeNull();
  });

  it('sets loadPhase to error when the states fetch fails', async () => {
    stubFetch({ failStates: true });

    await useDensityStore.getState().loadAllLevels();

    expect(useDensityStore.getState().loadPhase).toBe('error');
    expect(useDensityStore.getState().error).not.toBeNull();
  });

  it('dedupes re-entrant loadAllLevels calls while counties are still streaming', async () => {
    const { fetchMock, releaseCounties } = stubFetch({ countiesDelayed: true });
    const v0 = useDensityStore.getState().dataVersion;

    const first = useDensityStore.getState().loadAllLevels();
    await waitFor(() => useDensityStore.getState().loadPhase === 'ready');

    const second = useDensityStore.getState().loadAllLevels();

    releaseCounties();
    await Promise.all([first, second]);

    const countyCalls = fetchMock.mock.calls.filter(c => c[0] === COUNTIES_URL);
    expect(countyCalls).toHaveLength(1);
    expect(useDensityStore.getState().dataVersion).toBe(v0 + 2);
  });
});
