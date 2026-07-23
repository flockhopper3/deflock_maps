# Viewport Brand Breakdown Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Live, viewport-reactive camera brand breakdown (stacked bar + legend) on the Map tab: a section above About in the desktop left panel and a live strip in the minimized mobile drawer.

**Architecture:** The FHIX positions index (`cameraIndexService.ts`) already walks a CSR grid to count cameras in view; a new `tallyInBounds` does the same walk while tallying per-brand counts into a `Uint32Array(256)`. `MapLibreContainer` writes a derived top-4 summary to a new `mapStore.tileViewBrandStats`, and one `BrandBreakdown` component (full/strip variants) renders it. Breakdown is index-only: it hides (stats = `null`) whenever `renderMode !== 'tiles'` or the index isn't loaded.

**Tech Stack:** React 18 + TypeScript, Zustand, Tailwind, vitest (logic tests only — no React Testing Library in this repo).

**Spec:** `docs/superpowers/specs/2026-07-19-viewport-brand-breakdown-design.md`

## Global Constraints

- User-facing strings are plain declarative statements; NEVER use em dashes in UI copy.
- Lint gate: `npm run lint` must introduce zero new warnings/errors.
- Concurrent Claude sessions share this checkout: `git add` only the files you changed (there are unrelated uncommitted `worker/` and `flockhopper-tiles/` changes; never stage them), commit atomically per task.
- `docs/` is gitignored; spec/plan files need `git add -f`. Source files under `src/` stage normally.
- `countInBounds`'s public signature and behavior must not change (existing tests prove it).
- Colors: rank 1-4 blues `#0080BC`, `#4db3e0`, `#7dd0f2`, `#b8e5fa`; "Unknown" always `#3f4550`; "others" row `#6b7280`. Gray never means a named ranked brand.
- Percentages render as whole numbers, `tabular-nums`.
- Run all commands from the repo root: `/Users/jackcauthen/Documents/Developer/FLOCK/DEFLOCK Website/DEFLOCK MAPS/FOGGED LENS/flockhopper 3`.

---

### Task 1: `tallyInBounds` in cameraIndexService

**Files:**
- Modify: `src/services/cameraIndexService.ts`
- Test: `src/services/cameraIndexService.test.ts`

**Interfaces:**
- Consumes: existing `CameraIndex`, `decodeCameraIndex`, `countInBounds`, private `countRange`/`lowerBound`.
- Produces: `export interface BrandTally { total: number; counts: Uint32Array }` and `export function tallyInBounds(idx: CameraIndex, bounds: { north: number; south: number; east: number; west: number }): BrandTally`. Task 3 imports both.

- [ ] **Step 1: Write the failing tests**

Append to `src/services/cameraIndexService.test.ts` (add `tallyInBounds` to the existing import from `'./cameraIndexService'`):

```ts
describe('tallyInBounds', () => {
  const brands = ['unknown', 'Flock Safety', 'Motorola Solutions', 'Genetec'];
  const cams = [
    { lat: 29.7604, lng: -95.3698, brand: 1 }, // Houston, Flock
    { lat: 29.7405, lng: -95.4, brand: 2 },    // Houston, Motorola
    { lat: 29.75, lng: -95.39, brand: 0 },     // Houston, unknown
    { lat: 40.7128, lng: -74.006, brand: 3 },  // NYC, Genetec
    { lat: 61.2181, lng: -149.9003, brand: 1 },// Anchorage, Flock
  ];
  const idx = decodeCameraIndex(makeBin(cams), sidecarFor(cams, brands));

  it('tallies per-brand counts for a city viewport', () => {
    const t = tallyInBounds(idx, { north: 30.2, south: 29.3, east: -94.9, west: -95.9 });
    expect(t.total).toBe(3);
    expect(t.counts[0]).toBe(1); // unknown
    expect(t.counts[1]).toBe(1); // Flock
    expect(t.counts[2]).toBe(1); // Motorola
    expect(t.counts[3]).toBe(0); // Genetec (NYC, out of view)
  });

  it('total always equals countInBounds for identical bounds', () => {
    const boxes = [
      { north: 30.2, south: 29.3, east: -94.9, west: -95.9 },
      { north: 90, south: -90, east: 250, west: -250 },   // whole world
      { north: 60, south: 45, east: -175, west: 175 },    // antimeridian wrap
      { north: 45, south: 20, east: -60, west: -200 },    // out-of-range lng
      { north: 0, south: 10, east: 10, west: 0 },         // inverted lat
    ];
    for (const b of boxes) {
      const t = tallyInBounds(idx, b);
      expect(t.total, JSON.stringify(b)).toBe(countInBounds(idx, b));
      let sum = 0;
      for (let i = 0; i < 256; i++) sum += t.counts[i];
      expect(sum, JSON.stringify(b)).toBe(t.total);
    }
  });

  it('interior-cell fast path tallies brands exactly (cell fully inside bounds)', () => {
    // Cluster fills one 0.5-degree cell; bounds cover the whole cell plus margin.
    const cluster = [
      { lat: 29.6, lng: -95.4, brand: 1 },
      { lat: 29.7, lng: -95.3, brand: 1 },
      { lat: 29.8, lng: -95.2, brand: 2 },
    ];
    const cIdx = decodeCameraIndex(makeBin(cluster), sidecarFor(cluster, brands));
    const t = tallyInBounds(cIdx, { north: 35, south: 25, east: -90, west: -100 });
    expect(t.total).toBe(3);
    expect(t.counts[1]).toBe(2);
    expect(t.counts[2]).toBe(1);
  });

  it('matches per-brand brute force on 200 random viewports over 2000 random cameras', () => {
    const rnd = mulberry32(1337);
    const records = Array.from({ length: 2000 }, () => ({
      lat: rnd() * 180 - 90,
      lng: rnd() * 360 - 180,
      brand: Math.floor(rnd() * 5),
    }));
    const names = ['unknown', 'A', 'B', 'C', 'D'];
    const rIdx = decodeCameraIndex(makeBin(records), sidecarFor(records, names));
    for (let i = 0; i < 200; i++) {
      const south = rnd() * 170 - 90;
      const north = south + rnd() * (90 - south);
      const west = rnd() * 400 - 220;
      const east = west + rnd() * 380;
      const b = { north, south, east, west };
      const t = tallyInBounds(rIdx, b);
      for (let brand = 0; brand < 5; brand++) {
        const expected = bruteForce(records.filter((r) => r.brand === brand), b);
        expect(t.counts[brand], `brand ${brand} ${JSON.stringify(b)}`).toBe(expected);
      }
      expect(t.total).toBe(countInBounds(rIdx, b));
    }
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `npx vitest run src/services/cameraIndexService.test.ts`
Expected: FAIL — `tallyInBounds` is not exported.

- [ ] **Step 3: Implement `tallyInBounds`**

In `src/services/cameraIndexService.ts`, add below `countRange` (keep `countRange` and `countInBounds` untouched):

```ts
export interface BrandTally {
  total: number;
  /** Count per brandId (index = brandId, 0 = unknown). Length 256. */
  counts: Uint32Array;
}

/** Like countRange, but tallies brandIds. Interior cells skip the bounds
 *  comparisons but still iterate members to read each brandId. */
function tallyRange(
  idx: CameraIndex,
  southM: number,
  northM: number,
  westM: number,
  eastM: number,
  counts: Uint32Array
): number {
  const y0 = Math.max(0, Math.floor((southM + 90_000_000) / CELL_MICRO));
  const y1 = Math.min(CELLS_Y - 1, Math.floor((northM + 90_000_000) / CELL_MICRO));
  const x0 = Math.max(0, Math.floor((westM + 180_000_000) / CELL_MICRO));
  const x1 = Math.min(CELLS_X - 1, Math.floor((eastM + 180_000_000) / CELL_MICRO));
  const { cellKeys, cellStarts, order, latMicro, lngMicro, brandIds } = idx;

  let total = 0;
  for (let y = y0; y <= y1; y++) {
    const rowInteriorLat =
      y * CELL_MICRO - 90_000_000 >= southM && (y + 1) * CELL_MICRO - 90_000_000 <= northM;
    const from = lowerBound(cellKeys, y * CELLS_X + x0);
    const to = lowerBound(cellKeys, y * CELLS_X + x1 + 1);
    for (let s = from; s < to; s++) {
      const x = cellKeys[s] - y * CELLS_X;
      const interior =
        rowInteriorLat &&
        x * CELL_MICRO - 180_000_000 >= westM &&
        (x + 1) * CELL_MICRO - 180_000_000 <= eastM;
      if (interior) {
        for (let k = cellStarts[s]; k < cellStarts[s + 1]; k++) counts[brandIds[order[k]]]++;
        total += cellStarts[s + 1] - cellStarts[s];
        continue;
      }
      for (let k = cellStarts[s]; k < cellStarts[s + 1]; k++) {
        const i = order[k];
        const lat = latMicro[i];
        const lng = lngMicro[i];
        if (lat >= southM && lat <= northM && lng >= westM && lng <= eastM) {
          counts[brandIds[i]]++;
          total++;
        }
      }
    }
  }
  return total;
}

/**
 * Per-brand viewport tally. Bounds semantics are identical to countInBounds
 * (lat clamped, lng may exceed [-180, 180] or wrap the antimeridian), and
 * `total` always equals countInBounds for the same bounds.
 */
export function tallyInBounds(
  idx: CameraIndex,
  bounds: { north: number; south: number; east: number; west: number }
): BrandTally {
  const counts = new Uint32Array(256);
  const southM = Math.round(Math.max(-90, bounds.south) * 1e6);
  const northM = Math.round(Math.min(90, bounds.north) * 1e6);
  if (northM < southM) return { total: 0, counts };

  let span = bounds.east - bounds.west;
  if (span < 0) span += 360;
  if (span >= 360) {
    return {
      total: tallyRange(idx, southM, northM, -180_000_000, 180_000_000, counts),
      counts,
    };
  }
  const w = ((bounds.west + 180) % 360 + 360) % 360 - 180;
  const e = w + span;
  const westM = Math.round(w * 1e6);
  const eastM = Math.round(e * 1e6);
  if (eastM <= 180_000_000) {
    return { total: tallyRange(idx, southM, northM, westM, eastM, counts), counts };
  }
  const total =
    tallyRange(idx, southM, northM, westM, 180_000_000, counts) +
    tallyRange(idx, southM, northM, -180_000_000, eastM - 360_000_000, counts);
  return { total, counts };
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `npx vitest run src/services/cameraIndexService.test.ts`
Expected: PASS, including all pre-existing `countInBounds` tests.

- [ ] **Step 5: Commit**

```bash
git add src/services/cameraIndexService.ts src/services/cameraIndexService.test.ts
git commit -m "feat: per-brand viewport tally on the positions index"
```

---

### Task 2: `deriveBrandStats`

**Files:**
- Modify: `src/services/cameraIndexService.ts`
- Test: `src/services/cameraIndexService.test.ts`

**Interfaces:**
- Consumes: `BrandTally` from Task 1.
- Produces (Tasks 3-5 import these):

```ts
export interface TileViewBrandStats {
  total: number;
  /** Top 4 by count. Ties break by lower brandId. */
  top: { label: string; count: number; unknown: boolean }[];
  otherCount: number;   // cameras beyond top 4
  otherBrands: number;  // distinct brands folded into "other"
}
export function deriveBrandStats(tally: BrandTally, brands: string[]): TileViewBrandStats;
```

- [ ] **Step 1: Write the failing tests**

Append to `src/services/cameraIndexService.test.ts` (extend the import with `deriveBrandStats`):

```ts
describe('deriveBrandStats', () => {
  const brands = ['unknown', 'Flock Safety', 'Motorola Solutions', 'Genetec', 'Leonardo', 'Ekin', 'Rekor'];

  function tallyOf(pairs: Array<[number, number]>): { total: number; counts: Uint32Array } {
    const counts = new Uint32Array(256);
    let total = 0;
    for (const [id, c] of pairs) { counts[id] = c; total += c; }
    return { total, counts };
  }

  it('ranks top 4 by count and folds the rest into other', () => {
    const s = deriveBrandStats(
      tallyOf([[1, 985], [0, 409], [2, 289], [3, 35], [4, 9], [5, 5], [6, 2]]),
      brands
    );
    expect(s.total).toBe(1734);
    expect(s.top.map((t) => t.label)).toEqual(['Flock Safety', 'Unknown', 'Motorola Solutions', 'Genetec']);
    expect(s.top.map((t) => t.count)).toEqual([985, 409, 289, 35]);
    expect(s.top[1].unknown).toBe(true);
    expect(s.top[0].unknown).toBe(false);
    expect(s.otherCount).toBe(16);
    expect(s.otherBrands).toBe(3);
  });

  it('handles fewer than 4 brands with no other row', () => {
    const s = deriveBrandStats(tallyOf([[1, 22], [6, 1]]), brands);
    expect(s.top).toHaveLength(2);
    expect(s.otherCount).toBe(0);
    expect(s.otherBrands).toBe(0);
  });

  it('labels an id beyond the sidecar as Other and marks it unknown', () => {
    const s = deriveBrandStats(tallyOf([[200, 7]]), brands);
    expect(s.top[0]).toEqual({ label: 'Other', count: 7, unknown: true });
  });

  it('returns an empty shape for an empty tally', () => {
    const s = deriveBrandStats(tallyOf([]), brands);
    expect(s).toEqual({ total: 0, top: [], otherCount: 0, otherBrands: 0 });
  });

  it('breaks count ties by lower brandId for a stable order', () => {
    const s = deriveBrandStats(tallyOf([[2, 5], [1, 5], [3, 5], [4, 5], [5, 5]]), brands);
    expect(s.top.map((t) => t.label)).toEqual(['Flock Safety', 'Motorola Solutions', 'Genetec', 'Leonardo']);
    expect(s.otherBrands).toBe(1);
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `npx vitest run src/services/cameraIndexService.test.ts`
Expected: FAIL — `deriveBrandStats` is not exported.

- [ ] **Step 3: Implement**

Add to `src/services/cameraIndexService.ts` below `tallyInBounds`:

```ts
export interface TileViewBrandStats {
  total: number;
  /** Top 4 by count. Ties break by lower brandId. */
  top: { label: string; count: number; unknown: boolean }[];
  otherCount: number;
  otherBrands: number;
}

/**
 * Fold a raw tally into the compact object the UI renders: top 4 brands plus
 * an aggregate for the rest. brandId 0 displays as "Unknown"; ids beyond the
 * sidecar's brands array display as "Other". Both carry unknown: true so the
 * UI renders them gray in any rank slot.
 */
export function deriveBrandStats(tally: BrandTally, brands: string[]): TileViewBrandStats {
  const entries: { id: number; count: number }[] = [];
  for (let id = 0; id < 256; id++) {
    const c = tally.counts[id];
    if (c > 0) entries.push({ id, count: c });
  }
  entries.sort((a, b) => b.count - a.count || a.id - b.id);

  const top = entries.slice(0, 4).map((e) => ({
    label: e.id === 0 ? 'Unknown' : e.id < brands.length ? brands[e.id] : 'Other',
    count: e.count,
    unknown: e.id === 0 || e.id >= brands.length,
  }));
  let otherCount = 0;
  for (const e of entries.slice(4)) otherCount += e.count;
  return { total: tally.total, top, otherCount, otherBrands: Math.max(0, entries.length - 4) };
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `npx vitest run src/services/cameraIndexService.test.ts`
Expected: PASS (all describes).

- [ ] **Step 5: Commit**

```bash
git add src/services/cameraIndexService.ts src/services/cameraIndexService.test.ts
git commit -m "feat: derive top-4 brand stats from a viewport tally"
```

---

### Task 3: Store field + MapLibreContainer wiring

**Files:**
- Modify: `src/store/mapStore.ts`
- Modify: `src/components/map/MapLibreContainer.tsx` (two index sites + two clearing sites)

**Interfaces:**
- Consumes: `tallyInBounds`, `deriveBrandStats`, `TileViewBrandStats` (Tasks 1-2).
- Produces: `useMapStore` state `tileViewBrandStats: TileViewBrandStats | null` and action `setTileViewBrandStats(stats)`. Tasks 4-5 subscribe to it.

- [ ] **Step 1: Add the store field**

In `src/store/mapStore.ts`:

Add the import at the top:

```ts
import type { TileViewBrandStats } from '../services/cameraIndexService';
```

In `MapStoreState`, directly below the `tileViewCameraCount` declaration (line ~24), add:

```ts
  /** Top-4 brand mix in view. Non-null only when rendering unfiltered tiles
   *  with the positions index loaded; null hides the breakdown UI. */
  tileViewBrandStats: TileViewBrandStats | null;
```

Below `setTileViewCameraCount` in the actions block of the interface:

```ts
  setTileViewBrandStats: (stats: TileViewBrandStats | null) => void;
```

In the store initializer, below `tileViewCameraCount: null,`:

```ts
  tileViewBrandStats: null,
```

And below the `setTileViewCameraCount` implementation:

```ts
  setTileViewBrandStats: (stats) => set({ tileViewBrandStats: stats }),
```

- [ ] **Step 2: Wire the two index sites in MapLibreContainer**

In `src/components/map/MapLibreContainer.tsx`:

Extend the existing import (line 60):

```ts
import { ensureCameraIndex, getCameraIndex, countInBounds, tallyInBounds, deriveBrandStats } from '../../services/cameraIndexService';
```

**Site A — idle recount** (inside `updateVisibleCameras`, the `renderMode === 'tiles'` index branch around line 310). Replace:

```ts
    if (renderMode === 'tiles') {
      const idx = getCameraIndex(country);
      if (idx) {
        const b = map.getBounds();
        useMapStore.getState().setTileViewCameraCount(countInBounds(idx, {
          north: b.getNorth(),
          south: b.getSouth(),
          east: b.getEast(),
          west: b.getWest(),
        }));
        return;
      }
    }
```

with:

```ts
    if (renderMode === 'tiles') {
      const idx = getCameraIndex(country);
      if (idx) {
        const b = map.getBounds();
        const tally = tallyInBounds(idx, {
          north: b.getNorth(),
          south: b.getSouth(),
          east: b.getEast(),
          west: b.getWest(),
        });
        const store = useMapStore.getState();
        store.setTileViewCameraCount(tally.total);
        store.setTileViewBrandStats(deriveBrandStats(tally, idx.brands));
        return;
      }
    }
```

**Clearing site 1 — query fallback** (same function, after the `queryRenderedFeatures` call around line 364). Immediately after:

```ts
        useMapStore.getState().setTileViewCameraCount(feats.length);
```

add:

```ts
        // Query counts carry no brand data; hide the breakdown.
        useMapStore.getState().setTileViewBrandStats(null);
```

**Clearing site 2 — geojson path** (same function, around line 371). Change:

```ts
    useMapStore.getState().setTileViewCameraCount(null);
```

to:

```ts
    useMapStore.getState().setTileViewCameraCount(null);
    useMapStore.getState().setTileViewBrandStats(null);
```

**Site B — live count during a gesture** (inside `onMove`, around line 857). Replace:

```ts
          const b = map.getBounds();
          useMapStore.getState().setTileViewCameraCount(countInBounds(idx, {
            north: b.getNorth(),
            south: b.getSouth(),
            east: b.getEast(),
            west: b.getWest(),
          }));
```

with:

```ts
          const b = map.getBounds();
          const tally = tallyInBounds(idx, {
            north: b.getNorth(),
            south: b.getSouth(),
            east: b.getEast(),
            west: b.getWest(),
          });
          const store = useMapStore.getState();
          store.setTileViewCameraCount(tally.total);
          store.setTileViewBrandStats(deriveBrandStats(tally, idx.brands));
```

If `countInBounds` is now unused in this file, remove it from the import.

- [ ] **Step 3: Typecheck, build, and full test run**

Run: `npm run build && npm run test`
Expected: build succeeds; all tests pass. (No new unit test here: both sites are thin glue over Task 1/2 functions, and the render-path behavior is covered by the Task 6 E2E pass.)

- [ ] **Step 4: Commit**

```bash
git add src/store/mapStore.ts src/components/map/MapLibreContainer.tsx
git commit -m "feat: publish live viewport brand stats from the index recounts"
```

---

### Task 4: BrandBreakdown component + desktop panel section

**Files:**
- Create: `src/components/map/BrandBreakdown.tsx`
- Modify: `src/components/map/index.ts`
- Modify: `src/components/panels/MapPanel.tsx`

**Interfaces:**
- Consumes: `useMapStore(s => s.tileViewBrandStats)` (Task 3), `TileViewBrandStats` (Task 2).
- Produces: `export function BrandBreakdown({ variant }: { variant?: 'full' | 'strip' })` and `export function CamerasInViewSection()`. Task 5 imports `BrandBreakdown` (strip variant); `MapPanelContent` renders `CamerasInViewSection`, which also covers the mobile full sheet (it already renders `MapPanelContent`).

- [ ] **Step 1: Create the component**

Create `src/components/map/BrandBreakdown.tsx`:

```tsx
import { useMapStore } from '../../store';
import type { TileViewBrandStats } from '../../services/cameraIndexService';

/** Rank-slot blues. Unknown/Other never consume one; grays are reserved for
 *  "not a named brand" so the accent ramp always means identified vendors. */
const BLUE_RAMP = ['#0080BC', '#4db3e0', '#7dd0f2', '#b8e5fa'];
const UNKNOWN_GRAY = '#3f4550';
const OTHER_GRAY = '#6b7280';

interface Segment {
  label: string;
  count: number;
  pct: number;
  color: string;
}

function toSegments(stats: TileViewBrandStats): Segment[] {
  let blue = 0;
  const segs: Segment[] = stats.top.map((t) => ({
    label: t.label,
    count: t.count,
    pct: Math.round((100 * t.count) / stats.total),
    color: t.unknown ? UNKNOWN_GRAY : BLUE_RAMP[blue++],
  }));
  if (stats.otherCount > 0) {
    segs.push({
      label: `${stats.otherBrands} other${stats.otherBrands === 1 ? '' : 's'}`,
      count: stats.otherCount,
      pct: Math.round((100 * stats.otherCount) / stats.total),
      color: OTHER_GRAY,
    });
  }
  return segs;
}

function StackedBar({ segments }: { segments: Segment[] }) {
  return (
    <div className="flex h-2 rounded-full overflow-hidden bg-white/[0.06]">
      {segments.map((s) => (
        <div
          key={s.label}
          style={{ width: `${(100 * s.count) / segments.reduce((a, x) => a + x.count, 0)}%`, background: s.color }}
        />
      ))}
    </div>
  );
}

/**
 * Viewport brand composition from the positions index. Renders nothing when
 * stats are unavailable (filters active, geojson modes, index not loaded).
 * variant="full": stacked bar + two-column legend (desktop panel, mobile full sheet).
 * variant="strip": micro-label + leader summary + bar only (mobile minimized drawer).
 */
export function BrandBreakdown({ variant = 'full' }: { variant?: 'full' | 'strip' }) {
  const stats = useMapStore((s) => s.tileViewBrandStats);
  if (!stats || stats.total === 0 || stats.top.length === 0) return null;
  const segments = toSegments(stats);

  if (variant === 'strip') {
    const leader = segments[0];
    return (
      <div className="mt-2.5 animate-fade-in">
        <div className="flex items-center justify-between mb-1.5">
          <span className="text-2xs text-dark-500 uppercase">In view by brand</span>
          <span className="text-xs text-dark-400">
            <span className="text-dark-200 font-semibold tabular-nums">{leader.pct}%</span> {leader.label}
          </span>
        </div>
        <StackedBar segments={segments} />
      </div>
    );
  }

  return (
    <div>
      <StackedBar segments={segments} />
      <div className="grid grid-cols-2 gap-x-4 gap-y-1.5 mt-3">
        {segments.map((s) => (
          <div key={s.label} className="flex items-center gap-2 min-w-0">
            <span
              className="w-2 h-2 rounded-sm flex-shrink-0"
              style={{ background: s.color }}
              aria-hidden="true"
            />
            <span className="text-xs text-dark-400 truncate">{s.label}</span>
            <span className="ml-auto text-xs text-dark-200 font-semibold tabular-nums">{s.pct}%</span>
          </div>
        ))}
      </div>
    </div>
  );
}

/**
 * "Cameras in view" panel section: total + full breakdown, hairline below.
 * Collapses entirely when the breakdown is unavailable, so the Map panel
 * degrades to its current About-first layout.
 */
export function CamerasInViewSection() {
  const stats = useMapStore((s) => s.tileViewBrandStats);
  if (!stats || stats.total === 0 || stats.top.length === 0) return null;
  return (
    <div className="px-6 pt-5 pb-4 border-b border-dark-700/50">
      <div className="flex items-baseline justify-between mb-3">
        <span className="text-2xs text-dark-500 uppercase">Cameras in view</span>
        <span className="text-lg font-display font-bold text-accent tabular-nums">
          {stats.total.toLocaleString()}
        </span>
      </div>
      <BrandBreakdown variant="full" />
    </div>
  );
}
```

- [ ] **Step 2: Export from the barrel**

In `src/components/map/index.ts` add:

```ts
export { BrandBreakdown, CamerasInViewSection } from './BrandBreakdown';
```

- [ ] **Step 3: Render the section in the Map panel**

In `src/components/panels/MapPanel.tsx`, add the import:

```ts
import { CamerasInViewSection } from '../map/BrandBreakdown';
```

and change `MapPanelContent`'s return from:

```tsx
  return <AboutContent />;
```

to:

```tsx
  return (
    <>
      <CamerasInViewSection />
      <AboutContent />
    </>
  );
```

This covers desktop AND the mobile full sheet: `MobileTabDrawer`'s `case 'map'` already renders `MapPanelContent`.

- [ ] **Step 4: Build, test, lint**

Run: `npm run build && npm run test && npm run lint`
Expected: all pass, zero new lint findings.

- [ ] **Step 5: Commit**

```bash
git add src/components/map/BrandBreakdown.tsx src/components/map/index.ts src/components/panels/MapPanel.tsx
git commit -m "feat: cameras-in-view brand breakdown in the Map panel"
```

---

### Task 5: Mobile minimized-drawer strip

**Files:**
- Modify: `src/components/panels/MobileTabDrawer.tsx`

**Interfaces:**
- Consumes: `BrandBreakdown` (Task 4), `useMapStore` boolean presence selector (Task 3).
- Produces: minimized Map drawer at 160px with the strip, falling back to today's 108px layout when stats are null.

- [ ] **Step 1: Add the strip and conditional height**

In `src/components/panels/MobileTabDrawer.tsx`:

Add imports:

```ts
import { useMapStore } from '../../store';
import { BrandBreakdown } from '../map/BrandBreakdown';
```

(`useMapStore` may already be re-exported from `'../../store'`; extend the existing store import line instead of adding a duplicate if so.)

Inside the `MobileTabDrawer` component body, next to the other store subscriptions, add a presence-only selector (a boolean, so 8Hz stat updates during panning do NOT re-render the drawer; only appearance/disappearance does):

```ts
  // Presence only: height + strip slot flip together, and per-pan stat
  // updates re-render just the BrandBreakdown leaf, never this drawer.
  const hasBrandStrip = useMapStore(
    (s) => s.tileViewBrandStats !== null && s.tileViewBrandStats.total > 0
  );
```

Change the `minimizedHeight` line (line ~317) from:

```ts
  const minimizedHeight = appMode === 'map' ? 108 : appMode === 'explore' ? UNIFORM_PEEK_HEIGHT : 80;
```

to:

```ts
  // Map's minimized floor grows to fit the live brand strip when the index
  // has stats; without them it is exactly the pre-strip layout.
  const minimizedHeight =
    appMode === 'map' ? (hasBrandStrip ? 160 : 108)
    : appMode === 'explore' ? UNIFORM_PEEK_HEIGHT
    : 80;
```

In `headerContent`, change the Map-mode hint block from:

```tsx
      {appMode === 'map' && snapPoint === 'minimized' && (
        <div className="mt-2.5 flex items-center justify-center gap-1 text-dark-400 animate-fade-in">
          <ChevronUp className="w-3.5 h-3.5 animate-nudge-up" />
          <span className="text-[11px] font-medium">Swipe up to learn about this map</span>
        </div>
      )}
```

to (strip above, hint kept verbatim — approved decision):

```tsx
      {appMode === 'map' && snapPoint === 'minimized' && (
        <>
          <BrandBreakdown variant="strip" />
          <div className="mt-2.5 flex items-center justify-center gap-1 text-dark-400 animate-fade-in">
            <ChevronUp className="w-3.5 h-3.5 animate-nudge-up" />
            <span className="text-[11px] font-medium">Swipe up to learn about this map</span>
          </div>
        </>
      )}
```

- [ ] **Step 2: Build, test, lint**

Run: `npm run build && npm run test && npm run lint`
Expected: all pass, zero new lint findings.

- [ ] **Step 3: Commit**

```bash
git add src/components/panels/MobileTabDrawer.tsx
git commit -m "feat: live brand strip in the minimized mobile Map drawer"
```

---

### Task 6: End-to-end verification

**Files:**
- None created; visual/behavioral verification only. Fix-ups discovered here are committed with scoped messages.

**Interfaces:**
- Consumes: everything above, running against the real published index artifacts.

- [ ] **Step 1: Run the project verify skill**

Invoke the `flockhopper 3:verify` skill (Playwright drive of the real app). Verify each of the following, capturing screenshots:

1. **Desktop (1440px)**: Map tab left panel shows "CAMERAS IN VIEW" + total above About; stacked bar + two-column legend with plausible percentages; total matches the top-right CameraStats card's "in view" number.
2. **Desktop pan reactivity**: pan from a national view into a metro (e.g. Chicago area); the legend percentages change.
3. **Mobile (390px viewport)**: Map tab minimized drawer shows tabs row, then "IN VIEW BY BRAND" + leader summary + bar, then the unchanged "Swipe up to learn about this map" hint; drawer height ~160px; map controls/attribution ride above it (`--drawer-height` plumbing).
4. **Mobile full sheet**: swipe up; sheet leads with Cameras in view section (bar + legend) above the About card.
5. **Hides on filter**: apply any brand filter via the filter control; the desktop section and mobile strip disappear and the mobile drawer returns to the 108px layout. Clearing the filter brings them back.
6. **Heatmap hides it**: switch Map visualization to heatmap; breakdown hides.
7. **Strip height tuning**: if 160px clips the strip or leaves a visible gap at real rendering, adjust the constant in `MobileTabDrawer.tsx` (and this plan's Task 5 value) to the measured fit, keeping the no-stats fallback at exactly 108.

- [ ] **Step 2: Lint gate + full suite, final**

Run: `npm run lint && npm run test && npm run build`
Expected: zero new lint findings, all tests pass, clean build.

- [ ] **Step 3: Commit any verification fix-ups**

```bash
git add <only files changed during verification>
git commit -m "fix: brand breakdown polish from E2E verification"
```

(Skip if nothing changed.)
