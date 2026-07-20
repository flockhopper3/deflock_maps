# Network Non-Portal Gating Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Show all agencies on the Network tab by default; non-portal agencies are selectable but their inferred connections stay hidden behind a new "Inferred Connections" switch with explanatory warning/info banners.

**Architecture:** The gate lives entirely in `networkStore` (a single `arcsFor()` helper used by selection, adjacency backfill, and the new toggle), so the map layers, side panel, and mobile peek all follow from `selectedArcs` being empty. UI components only add presentational branches keyed off `selectedNode.isPortal` and the new flag.

**Tech Stack:** React 18 + TypeScript, Zustand, deck.gl, Tailwind, Vitest (`npm test`), Playwright (in project node_modules) for e2e.

## Global Constraints

- Spec: `docs/superpowers/specs/2026-07-19-network-nonportal-gating-design.md`
- User-facing copy never uses em dashes; plain declarative sentences.
- `npm run lint` and `tsc` must stay clean (zero new issues; concurrent sessions share this tree).
- Commit each task atomically; do not stage unrelated WIP (`worker/`, `flockhopper-tiles/` have another session's changes).
- Portal agencies must behave exactly as today in every state.
- Both flags are session-only (no persistence).

---

### Task 1: Store gating + defaults (TDD)

**Files:**
- Modify: `src/store/networkStore.ts`
- Test: `src/store/networkStore.test.ts` (create)

**Interfaces:**
- Produces: `inferredConnectionsEnabled: boolean` (default `false`) and `toggleInferredConnections(): void` on `NetworkState`; `portalOnly` default becomes `false`. Selecting a non-portal node while the flag is off yields `selectedArcs: []`; toggling the flag recomputes arcs for the current selection in place.

- [ ] **Step 1: Write the failing test**

Create `src/store/networkStore.test.ts`:

```ts
import { describe, it, expect, beforeEach } from 'vitest';
import { useNetworkStore, type NetworkNode } from './networkStore';

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
    selectedNodeId: null,
    selectedNode: null,
    selectedArcs: [],
  });
});

describe('networkStore defaults', () => {
  it('shows all agencies by default (portalOnly off)', () => {
    expect(useNetworkStore.getState().portalOnly).toBe(false);
  });
});

describe('inferred-connection gating', () => {
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
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm test -- src/store/networkStore.test.ts`
Expected: FAIL. `portalOnly` is `true`, `toggleInferredConnections` is not a function, and the non-portal gating assertions fail.

- [ ] **Step 3: Implement the store changes**

In `src/store/networkStore.ts`:

3a. Add to the `NetworkState` interface (after `portalOnly: boolean;`):

```ts
  /** When false, non-portal selections get no arcs (their data is inferred). */
  inferredConnectionsEnabled: boolean;
```

and after `togglePortalOnly: () => void;`:

```ts
  toggleInferredConnections: () => void;
```

3b. Change the `portalOnly` initial value from `true` to `false`, and add the new initial value below it:

```ts
  portalOnly: false,
  inferredConnectionsEnabled: false,
```

3c. Inside the `create<NetworkState>((set, get) => ...)` factory, add a gate helper above `loadNetworkData` (it needs `get`, so it lives inside the factory object as a plain closure; define it just before the returned object's actions by converting the object literal's first lines — simplest is a `const` above the `return`-style object is not possible in this literal, so define it as a module-level function taking state):

Add this module-level function next to `classifyArcs`:

```ts
/** Arcs for a selection, honoring the inferred-connections gate: non-portal
 *  agencies have no disclosures of their own, so their arcs (mentions in
 *  other agencies' portals) stay hidden until the user opts in. */
function gatedArcs(
  source: NetworkNode,
  state: Pick<NetworkState, 'nodesMap' | 'adjacency' | 'reverseAdjacency' | 'inferredConnectionsEnabled'>,
): DirectionalArc[] {
  if (!source.isPortal && !state.inferredConnectionsEnabled) return [];
  return classifyArcs(source, state.nodesMap, state.adjacency, state.reverseAdjacency);
}
```

3d. Use it in `setSelectedNodeId` (replace the `classifyArcs(...)` call):

```ts
    const arcs = gatedArcs(sourceNode, get());
```

3e. Use it in the adjacency backfill inside `loadNetworkData` (replace the `classifyArcs(...)` call):

```ts
            const backfillState = get();
            const source = backfillState.selectedNodeId
              ? backfillState.nodesMap.get(backfillState.selectedNodeId)
              : undefined;
            if (source) {
              set({ selectedArcs: gatedArcs(source, backfillState) });
            }
```

(Keep the surrounding structure; only the arc computation changes.)

3f. Add the toggle action next to `togglePortalOnly`:

```ts
  toggleInferredConnections: () => {
    set((s) => ({ inferredConnectionsEnabled: !s.inferredConnectionsEnabled }));
    const { selectedNode } = get();
    if (selectedNode) {
      set({ selectedArcs: gatedArcs(selectedNode, get()) });
    }
  },
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `npm test -- src/store/networkStore.test.ts`
Expected: PASS (6 tests). Also run `npm test` to confirm no other suite broke.

- [ ] **Step 5: Commit**

```bash
git add src/store/networkStore.ts src/store/networkStore.test.ts
git commit -m "feat: gate non-portal network arcs behind inferredConnectionsEnabled

portalOnly now defaults off so the whole network is visible; non-portal
selections compute no arcs until the new flag is on. Gate lives in one
helper used by selection, adjacency backfill, and the toggle.

Co-Authored-By: Claude Fable 5 <noreply@anthropic.com>"
```

---

### Task 2: Hover-preview gate in NetworkLayers

**Files:**
- Modify: `src/components/map/layers/NetworkLayers.tsx:69-90` (`handleNodeHover`)

**Interfaces:**
- Consumes: `inferredConnectionsEnabled` from `useNetworkStore` (Task 1).

- [ ] **Step 1: Subscribe to the flag**

Below the existing `const hoverArcsEnabled = useNetworkStore(s => s.hoverArcsEnabled);` line add:

```ts
  const inferredConnectionsEnabled = useNetworkStore(s => s.inferredConnectionsEnabled);
```

- [ ] **Step 2: Gate the debounced hover-arc computation**

In `handleNodeHover`, change the condition

```ts
      if (hoverArcsEnabled && !selectedNodeId) {
```

to

```ts
      if (hoverArcsEnabled && !selectedNodeId && (info.object.isPortal || inferredConnectionsEnabled)) {
```

and add `inferredConnectionsEnabled` to the `useCallback` dependency array. The tooltip and `setHoveredNode` stay unconditional (hovering still identifies the agency; only inferred arcs are gated).

- [ ] **Step 3: Verify**

Run: `npx eslint src/components/map/layers/NetworkLayers.tsx && npx tsc --noEmit`
Expected: no output (clean).

- [ ] **Step 4: Commit**

```bash
git add src/components/map/layers/NetworkLayers.tsx
git commit -m "feat: skip hover-preview arcs for gated non-portal agencies

Co-Authored-By: Claude Fable 5 <noreply@anthropic.com>"
```

---

### Task 3: Panel UI (warning card, inferred banner, legend row, options switches)

**Files:**
- Modify: `src/components/panels/NetworkPanelContent.tsx`

**Interfaces:**
- Consumes: `inferredConnectionsEnabled`, `toggleInferredConnections` from `useNetworkStore` (Task 1).

- [ ] **Step 1: Wire the store**

Add `inferredConnectionsEnabled, toggleInferredConnections,` to the destructured `useNetworkStore()` call, and below the destructuring add:

```ts
  const gatedSelection = !!selectedNode && !selectedNode.isPortal && !inferredConnectionsEnabled;
```

- [ ] **Step 2: Suppress misleading connection rows for gated selections**

In the selected-node stats block:
- Change `{adjacencyReady && mutualCount + outgoingCount + incomingCount === 0 && (` to `{adjacencyReady && !gatedSelection && mutualCount + outgoingCount + incomingCount === 0 && (` so a gated card never reads "Connections: 0".
- Change the loading spinner condition `{!adjacencyReady && (` to `{!adjacencyReady && !gatedSelection && (` so gated cards never say "Loading connections…".

- [ ] **Step 3: Add the gated warning card**

Directly after the stats `</div>` (before the `!adjacencyReady` spinner block), insert:

```tsx
              {gatedSelection && (
                <div role="status" className="mb-4 p-3 rounded-lg bg-amber-500/10 border border-amber-500/30">
                  <div className="flex gap-2.5">
                    <AlertTriangle className="w-4 h-4 text-amber-400 flex-shrink-0 mt-0.5" aria-hidden />
                    <div className="text-xs text-amber-100/90 leading-relaxed">
                      <p className="font-medium text-amber-300 mb-1">No transparency portal</p>
                      <p>
                        This agency does not publish a Flock transparency portal, so its data
                        sharing cannot be confirmed. Some connections can be inferred from
                        portals run by other agencies.
                      </p>
                    </div>
                  </div>
                  <button
                    onClick={toggleInferredConnections}
                    className="mt-2.5 w-full px-3 py-2 rounded-lg bg-amber-500/15 hover:bg-amber-500/25 active:bg-amber-500/30 text-amber-200 text-xs font-semibold transition-colors"
                  >
                    Show inferred connections
                  </button>
                </div>
              )}
```

- [ ] **Step 4: Add the inferred info banner (unlocked non-portal)**

Immediately after the block from Step 3, insert:

```tsx
              {selectedNode && !selectedNode.isPortal && inferredConnectionsEnabled && (
                <div role="status" className="mb-4 flex gap-2.5 p-3 rounded-lg bg-sky-500/10 border border-sky-500/30">
                  <Link2 className="w-4 h-4 text-sky-400 flex-shrink-0 mt-0.5" aria-hidden />
                  <div className="text-xs text-sky-100/90 leading-relaxed">
                    <p className="font-medium text-sky-300 mb-1">Inferred connections</p>
                    <p>
                      This agency has no transparency portal. These connections were found in
                      other agencies' portals that list it as a sharing partner. The real list
                      is likely longer.
                    </p>
                  </div>
                </div>
              )}
```

(`Link2` is already imported.)

- [ ] **Step 5: Add the legend third row (intro/empty state)**

After the red-ring legend row, add:

```tsx
                <div className="flex items-center gap-2">
                  <span className="inline-block w-3 h-3 rounded-full bg-accent flex-shrink-0" aria-hidden />
                  <span className="text-xs text-dark-300">No ring = no transparency portal (most agencies)</span>
                </div>
```

- [ ] **Step 6: Options section: sub-labels + new switch**

Replace the "Portal only toggle" block with:

```tsx
            {/* Portal only toggle */}
            <div className="flex items-center justify-between gap-3">
              <div className="flex-1 min-w-0">
                <span className="text-xs text-dark-400 uppercase tracking-wider font-medium">Portal Agencies Only</span>
                <p className="text-[11px] text-dark-500 mt-0.5">Hide agencies without a transparency portal</p>
              </div>
              <button
                onClick={togglePortalOnly}
                role="switch"
                aria-checked={portalOnly}
                aria-label="Portal agencies only"
                className={`relative flex-shrink-0 w-10 h-[22px] rounded-full transition-colors ${
                  portalOnly ? 'bg-accent' : 'bg-dark-700'
                }`}
              >
                <span
                  className={`absolute top-0.5 left-0.5 w-[18px] h-[18px] rounded-full bg-white transition-transform ${
                    portalOnly ? 'translate-x-[18px]' : ''
                  }`}
                />
              </button>
            </div>

            {/* Inferred connections toggle */}
            <div className="flex items-center justify-between gap-3">
              <div className="flex-1 min-w-0">
                <span className="text-xs text-dark-400 uppercase tracking-wider font-medium">Inferred Connections</span>
                <p className="text-[11px] text-dark-500 mt-0.5">Explore agencies that only appear in other agencies' portals</p>
              </div>
              <button
                onClick={toggleInferredConnections}
                role="switch"
                aria-checked={inferredConnectionsEnabled}
                aria-label="Inferred connections"
                className={`relative flex-shrink-0 w-10 h-[22px] rounded-full transition-colors ${
                  inferredConnectionsEnabled ? 'bg-accent' : 'bg-dark-700'
                }`}
              >
                <span
                  className={`absolute top-0.5 left-0.5 w-[18px] h-[18px] rounded-full bg-white transition-transform ${
                    inferredConnectionsEnabled ? 'translate-x-[18px]' : ''
                  }`}
                />
              </button>
            </div>
```

- [ ] **Step 7: Verify**

Run: `npx eslint src/components/panels/NetworkPanelContent.tsx && npx tsc --noEmit`
Expected: clean.

- [ ] **Step 8: Commit**

```bash
git add src/components/panels/NetworkPanelContent.tsx
git commit -m "feat: network panel UI for gated non-portal agencies

Warning card with inline enable button while gated, inferred-connections
info banner when unlocked, no-ring legend row, and an Inferred
Connections switch with sub-labels in options.

Co-Authored-By: Claude Fable 5 <noreply@anthropic.com>"
```

---

### Task 4: Mobile peek note

**Files:**
- Modify: `src/components/panels/MobileTabDrawer.tsx` (`NetworkPeekSummary`, ~line 135)

**Interfaces:**
- Consumes: `inferredConnectionsEnabled` from `useNetworkStore` (Task 1).

- [ ] **Step 1: Gate the connection count line**

In `NetworkPeekSummary`, add below the existing store reads:

```ts
  const inferredConnectionsEnabled = useNetworkStore(s => s.inferredConnectionsEnabled);
```

and replace the connections `<p>` with:

```tsx
          {!node.isPortal && !inferredConnectionsEnabled ? (
            <p className="text-xs text-amber-400/90 mt-1.5">No transparency portal</p>
          ) : (
            <p className="text-xs text-dark-400 mt-1.5 tabular-nums">
              {connections.toLocaleString()} connection{connections !== 1 ? 's' : ''}
              {node.isPortal && node.cameras > 0 && <> · {node.cameras.toLocaleString()} cameras</>}
            </p>
          )}
```

- [ ] **Step 2: Verify**

Run: `npx eslint src/components/panels/MobileTabDrawer.tsx && npx tsc --noEmit`
Expected: clean.

- [ ] **Step 3: Commit**

```bash
git add src/components/panels/MobileTabDrawer.tsx
git commit -m "feat: mobile network peek shows no-portal note for gated agencies

Co-Authored-By: Claude Fable 5 <noreply@anthropic.com>"
```

---

### Task 5: End-to-end verification (Playwright)

**Files:**
- Create: `.superpowers/verify-network-gating.mjs`

**Interfaces:**
- Consumes: the full UI from Tasks 1-4. Non-portal search results are identified by their dropdown rows lacking the "cameras" suffix (only portal rows show `· N cameras`).

- [ ] **Step 1: Write the script**

```js
// Verify: network tab non-portal gating. Desktop viewport (panel visible).
// Portal rows in the agency search dropdown show "· N cameras"; non-portal
// rows do not. Uses that to pick each kind deterministically.
import { chromium } from 'playwright';

const URL = 'http://localhost:3000';
const browser = await chromium.launch({ headless: true });
const page = await browser.newPage({ viewport: { width: 1280, height: 800 } });

const fail = async (msg) => {
  await page.screenshot({ path: '.superpowers/network-gating-fail.png' });
  console.error('FAIL:', msg);
  await browser.close();
  process.exit(1);
};

await page.goto(URL, { waitUntil: 'domcontentloaded' });

// Enter network mode via the header tab
const networkTab = page.getByRole('button', { name: /network/i }).first();
await networkTab.waitFor({ state: 'visible', timeout: 30000 }).catch(() => fail('no Network tab'));
await networkTab.click();

const search = page.locator('#network-agency-search');
await search.waitFor({ state: 'visible', timeout: 30000 }).catch(() => fail('network panel never loaded'));

// New switch exists, default off; portalOnly switch default off
const inferredSwitch = page.getByRole('switch', { name: 'Inferred connections' });
const portalSwitch = page.getByRole('switch', { name: 'Portal agencies only' });
if (await inferredSwitch.getAttribute('aria-checked') !== 'false') await fail('inferred switch not default-off');
if (await portalSwitch.getAttribute('aria-checked') !== 'false') await fail('portalOnly not default-off');
console.log('PASS: both switches present, default off');

// Pick a NON-portal agency from search (row without "cameras", with connections > 0)
await search.fill('county');
const rows = page.locator('div.absolute.top-full button');
await rows.first().waitFor({ timeout: 10000 }).catch(() => fail('no search results'));
const n = await rows.count();
let picked = false;
for (let i = 0; i < n; i++) {
  const text = await rows.nth(i).innerText();
  const m = text.match(/(\d+) connections/);
  if (!text.includes('cameras') && m && Number(m[1]) > 0) {
    await rows.nth(i).click();
    picked = true;
    break;
  }
}
if (!picked) await fail('no non-portal result with connections found');

// Gated: warning card, enable button, no connection tabs, no "Connections" stat
await page.getByText('No transparency portal').first().waitFor({ timeout: 10000 })
  .catch(() => fail('gated warning card missing'));
if (await page.getByRole('tab', { name: /All \(/ }).count() > 0) await fail('connection tabs visible while gated');
if (await page.getByText('Connection Types').count() > 0) await fail('arc legend visible while gated');
console.log('PASS: non-portal selection is gated with warning card');

// Inline enable button unlocks in place
await page.getByRole('button', { name: 'Show inferred connections' }).click();
// Banner asserted by its unique body copy (the title would also match the options switch label)
await page.getByText('The real list is likely longer').waitFor({ timeout: 5000 })
  .catch(() => fail('inferred banner missing after enable'));
if (await inferredSwitch.getAttribute('aria-checked') !== 'true') await fail('switch did not flip');
await page.getByRole('tab', { name: /All \(/ }).waitFor({ timeout: 5000 })
  .catch(() => fail('connection tabs missing after enable'));
console.log('PASS: inline button unlocks arcs, banner and tabs appear');

// Portal agency flow unchanged: pick a row WITH "cameras", expect stats, no warning
await search.fill('police');
await rows.first().waitFor({ timeout: 10000 });
const n2 = await rows.count();
let pickedPortal = false;
for (let i = 0; i < n2; i++) {
  if ((await rows.nth(i).innerText()).includes('cameras')) {
    await rows.nth(i).click();
    pickedPortal = true;
    break;
  }
}
if (!pickedPortal) await fail('no portal result found');
await page.getByText('Cameras').first().waitFor({ timeout: 10000 }).catch(() => fail('portal stats missing'));
if (await page.getByText('No transparency portal').count() > 0) await fail('portal shows gating warning');
console.log('PASS: portal agency unaffected');

await browser.close();
console.log('ALL PASS');
```

- [ ] **Step 2: Run it**

Run (dev server must be on port 3000): `node .superpowers/verify-network-gating.mjs`
Expected: five PASS lines then ALL PASS. If a selector mismatch surfaces, fix the script or the UI (whichever is wrong) and re-run.

- [ ] **Step 3: Full gates**

Run: `npm test && npm run lint && npx tsc --noEmit`
Expected: all clean.

- [ ] **Step 4: Commit**

```bash
git add .superpowers/verify-network-gating.mjs
git commit -m "test: e2e verify script for network non-portal gating

Co-Authored-By: Claude Fable 5 <noreply@anthropic.com>"
```
