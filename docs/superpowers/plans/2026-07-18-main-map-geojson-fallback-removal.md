# Main-map GeoJSON Fallback Removal Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make the full camera GeoJSON dataset structurally unreachable from the plain map and route views, so those views can never enter the per-frame CPU path; a camera-tile failure keeps the basemap usable and surfaces a retry pill instead.

**Architecture:** Remove both GeoJSON fallbacks (tiles-failure and filter-failure) from the render-mode resolver, and gate `ensureCamerasLoaded()` behind an explicit `isGeojsonMode` predicate so only Timeline/Explore/heatmap can hydrate. On tile failure, reveal the basemap and show a non-blocking retry pill; the existing 15s watchdog then fires the full-screen error only when the basemap itself is dead.

**Tech Stack:** React 18 + TypeScript + Vite, Zustand stores, MapLibre GL + react-map-gl, Tailwind. Path alias `@/` → `src/`.

## Global Constraints

- GeoJSON hydration must be unreachable from `appMode === 'map'` and `appMode === 'route'`. The only legitimate GeoJSON triggers are `timelineActive`, `appMode === 'explore'`, and `appMode === 'map' && mapModeViz === 'heatmap'`.
- User-facing copy: plain declarative sentences, no em dashes.
- Lint gate: zero new lint errors (`npm run lint`).
- Commit atomically; scope each `git add` to the files the task changed (the working tree is shared with concurrent sessions).
- Test harness: pure `vitest run` over logic and Zustand stores. There is NO DOM/hook/component test harness (no `@testing-library/react`, no jsdom). Hook, effect, and component changes are validated by `npm run build` (typecheck) and the `flockhopper 3:verify` E2E skill, not by unit tests.
- Test command: `npm run test` (alias for `vitest run`). Single file: `npx vitest run <path>`.

---

### Task 1: Remove both GeoJSON fallbacks from the render-mode resolver

Removes `tilesFailed` as a routing input and stops the filter-failure branch from falling back to GeoJSON. Adds an exported `isGeojsonMode` predicate as the single source of truth, and gates the hook's `ensureCamerasLoaded()` on it.

**Files:**
- Modify: `src/hooks/cameraRenderModeLogic.ts`
- Modify: `src/hooks/useCameraRenderMode.ts`
- Test: `src/hooks/cameraRenderModeLogic.test.ts`

**Interfaces:**
- Produces: `isGeojsonMode(i: Pick<RenderModeInputs, 'appMode' | 'mapModeViz' | 'timelineActive'>): boolean` — exported from `cameraRenderModeLogic.ts`, consumed by Task 3's reasoning and by the hook.
- Produces: `RenderModeInputs` no longer has a `tilesFailed` field. `resolveCameraRenderMode` never returns `needsGeojson: true` unless `isGeojsonMode(i)` is true.

- [ ] **Step 1: Rewrite the test file to the new expectations**

Replace the entire contents of `src/hooks/cameraRenderModeLogic.test.ts` with:

```ts
import { describe, it, expect } from 'vitest';
import { resolveCameraRenderMode, isGeojsonMode, type RenderModeInputs } from './cameraRenderModeLogic';

const base: RenderModeInputs = {
  filterTilesFailed: false,
  attributeFiltersActive: false,
  timelineActive: false,
  appMode: 'map',
  mapModeViz: 'dots',
  manifestPhase: 'idle',
  geojsonReady: false,
};

describe('isGeojsonMode', () => {
  it('is true only for explore, heatmap, and timeline', () => {
    expect(isGeojsonMode({ appMode: 'explore', mapModeViz: 'dots', timelineActive: false })).toBe(true);
    expect(isGeojsonMode({ appMode: 'map', mapModeViz: 'heatmap', timelineActive: false })).toBe(true);
    expect(isGeojsonMode({ appMode: 'map', mapModeViz: 'dots', timelineActive: true })).toBe(true);
  });

  it('is false for plain map and route views', () => {
    expect(isGeojsonMode({ appMode: 'map', mapModeViz: 'dots', timelineActive: false })).toBe(false);
    expect(isGeojsonMode({ appMode: 'route', mapModeViz: 'dots', timelineActive: false })).toBe(false);
    // heatmap viz forces geojson only in map mode, not route
    expect(isGeojsonMode({ appMode: 'route', mapModeViz: 'heatmap', timelineActive: false })).toBe(false);
  });
});

describe('resolveCameraRenderMode', () => {
  it('defaults to tiles', () => {
    expect(resolveCameraRenderMode(base)).toEqual({
      renderMode: 'tiles', needsGeojson: false, needsManifest: false,
    });
  });

  it('uses filter-tiles when filters active and manifest ready', () => {
    expect(resolveCameraRenderMode({
      ...base, attributeFiltersActive: true, manifestPhase: 'ready',
    })).toEqual({ renderMode: 'filter-tiles', needsGeojson: false, needsManifest: true });
  });

  it('stays on tiles (unfiltered) while manifest loads, requesting it', () => {
    expect(resolveCameraRenderMode({
      ...base, attributeFiltersActive: true, manifestPhase: 'loading',
    })).toEqual({ renderMode: 'tiles', needsGeojson: false, needsManifest: true });
  });

  it('degrades to unfiltered tiles (never geojson) when manifest errored', () => {
    expect(resolveCameraRenderMode({
      ...base, attributeFiltersActive: true, manifestPhase: 'error', geojsonReady: true,
    })).toEqual({ renderMode: 'tiles', needsGeojson: false, needsManifest: false });
  });

  it('degrades to unfiltered tiles (never geojson) when filter tiles failed', () => {
    expect(resolveCameraRenderMode({
      ...base, attributeFiltersActive: true, manifestPhase: 'ready',
      filterTilesFailed: true, geojsonReady: true,
    })).toEqual({ renderMode: 'tiles', needsGeojson: false, needsManifest: false });
  });

  it('timeline date forces geojson even with manifest ready', () => {
    const r = resolveCameraRenderMode({
      ...base, timelineActive: true, manifestPhase: 'ready', geojsonReady: true,
    });
    expect(r.renderMode).toBe('geojson');
    expect(r.needsGeojson).toBe(true);
  });

  it('explore and heatmap force geojson', () => {
    for (const patch of [
      { appMode: 'explore' },
      { mapModeViz: 'heatmap' },
    ] as Partial<RenderModeInputs>[]) {
      const r = resolveCameraRenderMode({ ...base, ...patch, geojsonReady: true });
      expect(r.renderMode).toBe('geojson');
      expect(r.needsGeojson).toBe(true);
    }
  });

  it('holds tiles until geojson hydrates for a genuine geojson mode', () => {
    const r = resolveCameraRenderMode({ ...base, appMode: 'explore', geojsonReady: false });
    expect(r.renderMode).toBe('tiles');
    expect(r.needsGeojson).toBe(true);
  });
});
```

- [ ] **Step 2: Run the tests to verify they fail**

Run: `npx vitest run src/hooks/cameraRenderModeLogic.test.ts`
Expected: FAIL — `isGeojsonMode` is not exported yet, and the manifest-error / filter-tiles-failed cases still return `geojson`.

- [ ] **Step 3: Rewrite `cameraRenderModeLogic.ts`**

Replace the entire contents of `src/hooks/cameraRenderModeLogic.ts` with:

```ts
export type CameraRenderMode = 'tiles' | 'filter-tiles' | 'geojson';

export interface RenderModeInputs {
  filterTilesFailed: boolean;
  /** Any brand/operator/zone/mount filter applied (filters.showAll === false). */
  attributeFiltersActive: boolean;
  /** Timeline date cutoff set — needs per-camera timestamps (GeoJSON only). */
  timelineActive: boolean;
  appMode: string;
  mapModeViz: string;
  manifestPhase: 'idle' | 'loading' | 'ready' | 'error';
  /** Full GeoJSON dataset hydrated (cameraStore.isInitialized). */
  geojsonReady: boolean;
}

export interface RenderModeResult {
  renderMode: CameraRenderMode;
  needsGeojson: boolean;
  needsManifest: boolean;
}

/**
 * The only modes that legitimately need per-camera attributes at all zooms,
 * which tiles cannot provide: Timeline/Explore (per-camera timestamps) and the
 * heatmap visualization. This is the SOLE gate for loading the full GeoJSON.
 * Tile and filter failures deliberately do NOT appear here — the plain map and
 * route views never load GeoJSON; a failure surfaces a retry pill instead.
 */
export function isGeojsonMode(
  i: Pick<RenderModeInputs, 'appMode' | 'mapModeViz' | 'timelineActive'>
): boolean {
  return (
    i.timelineActive ||
    i.appMode === 'explore' ||
    (i.appMode === 'map' && i.mapModeViz === 'heatmap')
  );
}

/**
 * Decides the camera rendering path. Precedence:
 * 1. GeoJSON-only modes (Explore, heatmap, timeline) → geojson.
 * 2. Attribute filters → filter-tiles when manifest + filter tileset are
 *    healthy; degrade to plain unfiltered tiles when either failed (never
 *    geojson); hold plain tiles while the manifest is still loading.
 * 3. Otherwise plain tiles.
 * A geojson decision renders as 'tiles' until hydration completes so the swap
 * never blanks the map. Tile/filter failures no longer route to geojson: they
 * are surfaced as a retry pill by the UI (see CameraTileStatusPill).
 */
export function resolveCameraRenderMode(i: RenderModeInputs): RenderModeResult {
  if (isGeojsonMode(i)) {
    return {
      renderMode: i.geojsonReady ? 'geojson' : 'tiles',
      needsGeojson: true,
      needsManifest: false,
    };
  }

  if (i.attributeFiltersActive) {
    // Filter tileset or manifest broken → show all cameras unfiltered; the UI
    // shows a "filters unavailable" pill. GeoJSON is never used here.
    if (i.manifestPhase === 'error' || i.filterTilesFailed) {
      return { renderMode: 'tiles', needsGeojson: false, needsManifest: false };
    }
    if (i.manifestPhase === 'ready') {
      return { renderMode: 'filter-tiles', needsGeojson: false, needsManifest: true };
    }
    // idle/loading: stay unfiltered briefly; effect below kicks off the load
    return { renderMode: 'tiles', needsGeojson: false, needsManifest: true };
  }

  return { renderMode: 'tiles', needsGeojson: false, needsManifest: false };
}
```

- [ ] **Step 4: Update the hook to drop `tilesFailed` and add the guard**

Replace the entire contents of `src/hooks/useCameraRenderMode.ts` with:

```ts
import { useEffect } from 'react';
import { useCameraStore } from '../store/cameraStore';
import { useAppModeStore } from '../store/appModeStore';
import { useMapModeStore } from '../store/mapModeStore';
import { resolveCameraRenderMode, isGeojsonMode, type CameraRenderMode } from './cameraRenderModeLogic';

export type { CameraRenderMode };

/**
 * Decides which camera rendering path is active — see resolveCameraRenderMode
 * for the decision table. Wires the stores in and lazily hydrates whichever
 * dataset the decision needs (manifest for filter-tiles, full GeoJSON for the
 * geojson path). GeoJSON hydration is gated on isGeojsonMode so it is
 * structurally unreachable from the plain map/route views.
 */
export function useCameraRenderMode(): {
  renderMode: CameraRenderMode;
  needsGeojson: boolean;
} {
  const filters = useCameraStore(s => s.filters);
  const isInitialized = useCameraStore(s => s.isInitialized);
  const filterTilesFailed = useCameraStore(s => s.filterTilesFailed);
  const manifestPhase = useCameraStore(s => s.manifestPhase);
  const appMode = useAppModeStore(s => s.appMode);
  const mapModeViz = useMapModeStore(s => s.visualization);

  const timelineActive = !!filters.timelineDate;

  const { renderMode, needsGeojson, needsManifest } = resolveCameraRenderMode({
    filterTilesFailed,
    attributeFiltersActive: !filters.showAll,
    timelineActive,
    appMode,
    mapModeViz,
    manifestPhase,
    geojsonReady: isInitialized,
  });

  // Guard: the full dataset is only ever hydrated from a genuine geojson mode.
  // Gating on isGeojsonMode (not merely needsGeojson) keeps GeoJSON
  // structurally unreachable from the plain map/route views even if a future
  // edit re-routes a failure into needsGeojson.
  useEffect(() => {
    if (needsGeojson && isGeojsonMode({ appMode, mapModeViz, timelineActive })) {
      void useCameraStore.getState().ensureCamerasLoaded();
    }
  }, [needsGeojson, appMode, mapModeViz, timelineActive]);

  useEffect(() => {
    if (needsManifest) void useCameraStore.getState().ensureManifestLoaded();
  }, [needsManifest]);

  return { renderMode, needsGeojson };
}
```

- [ ] **Step 5: Run the tests to verify they pass**

Run: `npx vitest run src/hooks/cameraRenderModeLogic.test.ts`
Expected: PASS (all cases green).

- [ ] **Step 6: Typecheck the touched hook wiring**

Run: `npm run build`
Expected: build succeeds with no TypeScript errors. (This is the only check that covers `useCameraRenderMode.ts`, since there is no hook test harness. If any other file referenced `RenderModeInputs.tilesFailed`, the build fails here — search and fix with `grep -rn "tilesFailed" src` if so; the render-mode resolver must no longer receive it.)

- [ ] **Step 7: Commit**

```bash
git add src/hooks/cameraRenderModeLogic.ts src/hooks/useCameraRenderMode.ts src/hooks/cameraRenderModeLogic.test.ts
git commit -m "refactor: stop routing map/route tile failures to GeoJSON

Remove tilesFailed as a render-mode input and stop the filter-failure
branch from falling back to GeoJSON; add an isGeojsonMode guard so the
full dataset is only hydrated for Timeline/Explore/heatmap.

Co-Authored-By: Claude Fable 5 <noreply@anthropic.com>"
```

---

### Task 2: Add `retryFilterTiles` store action and refresh stale fallback comments

Adds the action the filter-failure pill calls, and updates `ensureManifestLoaded`'s now-inaccurate "GeoJSON path" comments/logs (filter failure degrades to unfiltered tiles, not GeoJSON).

**Files:**
- Modify: `src/store/cameraStore.ts` (interface near line 105; implementation near line 176; comments/logs in `ensureManifestLoaded` near lines 180-201)
- Test: `src/store/cameraStore.test.ts`

**Interfaces:**
- Produces: `retryFilterTiles: () => void` on the camera store — resets `filterTilesFailed`, `manifestPhase`, and `manifest`, then calls `ensureManifestLoaded()`. Consumed by Task 4's `CameraTileStatusPill`.

- [ ] **Step 1: Write the failing test**

Add this `describe` block to `src/store/cameraStore.test.ts` (after the existing `ensureManifestLoaded` block; reuse the file's existing `validManifest` and `beforeEach`):

```ts
describe('retryFilterTiles', () => {
  it('clears filter failure state synchronously and re-requests the manifest', async () => {
    useCameraStore.setState({ filterTilesFailed: true, manifestPhase: 'error', manifest: null });
    const fetchMock = vi.fn().mockResolvedValue(
      new Response(JSON.stringify(validManifest), { status: 200 })
    );
    vi.stubGlobal('fetch', fetchMock);

    useCameraStore.getState().retryFilterTiles();

    // Failure flag is cleared immediately (synchronous reset)
    expect(useCameraStore.getState().filterTilesFailed).toBe(false);

    // The manifest is re-fetched and resolves
    await vi.waitFor(() => expect(useCameraStore.getState().manifestPhase).toBe('ready'));
    expect(useCameraStore.getState().manifest).not.toBeNull();
    expect(fetchMock).toHaveBeenCalled();
  });
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `npx vitest run src/store/cameraStore.test.ts -t retryFilterTiles`
Expected: FAIL — `retryFilterTiles is not a function`.

- [ ] **Step 3: Declare the action in the store interface**

In `src/store/cameraStore.ts`, add to the `CameraState` interface immediately after the `setFilterTilesFailed` line (currently line 105):

```ts
  /** Reset filter-tile/manifest failure state and re-request the manifest so
   *  the filter-tiles path can recover. Never loads GeoJSON. */
  retryFilterTiles: () => void;
```

- [ ] **Step 4: Implement the action**

In `src/store/cameraStore.ts`, add the implementation immediately after the `setFilterTilesFailed` implementation (currently line 176):

```ts
  retryFilterTiles: () => {
    set({ filterTilesFailed: false, manifestPhase: 'idle', manifest: null });
    void get().ensureManifestLoaded();
  },
```

- [ ] **Step 5: Refresh the stale "GeoJSON path" wording in `ensureManifestLoaded`**

In `src/store/cameraStore.ts`, update the three now-inaccurate references (filter failures degrade to unfiltered tiles, not GeoJSON):

Change the block comment above `ensureManifestLoaded` (currently near line 180) from:

```ts
  // Never rejects — failure is a state ('error'), consumed by the render-mode
  // fallback. Re-invoking after an error retries (service clears in-flight).
```

to:

```ts
  // Never rejects — failure is a state ('error'), consumed by the render-mode
  // logic (degrades to unfiltered tiles, not GeoJSON). Re-invoking after an
  // error retries (service clears in-flight).
```

Change the inline comment (currently near line 191) from:

```ts
      // Build-scoped ids: if the tileset predates/postdates this manifest,
      // expressions would select the wrong cameras. Degrade to the geojson
      // path rather than filter wrongly. 'unknown' (unstamped build) skips.
```

to:

```ts
      // Build-scoped ids: if the tileset predates/postdates this manifest,
      // expressions would select the wrong cameras. Degrade to unfiltered
      // tiles rather than filter wrongly. 'unknown' (unstamped build) skips.
```

Change the two `console.warn` strings from:

```ts
          console.warn('[CameraStore] Filter tileset/manifest build mismatch — using GeoJSON path for filters');
```

to:

```ts
          console.warn('[CameraStore] Filter tileset/manifest build mismatch; showing all cameras unfiltered');
```

and from:

```ts
      console.warn('[CameraStore] Manifest load failed — filters will use the GeoJSON path', error);
```

to:

```ts
      console.warn('[CameraStore] Manifest load failed; filters degrade to showing all cameras', error);
```

- [ ] **Step 6: Run the test to verify it passes**

Run: `npx vitest run src/store/cameraStore.test.ts -t retryFilterTiles`
Expected: PASS.

- [ ] **Step 7: Run the full store test file (guard against regressions)**

Run: `npx vitest run src/store/cameraStore.test.ts`
Expected: PASS (all existing store tests still green).

- [ ] **Step 8: Commit**

```bash
git add src/store/cameraStore.ts src/store/cameraStore.test.ts
git commit -m "feat: add retryFilterTiles store action

Resets filter-tile/manifest failure state and re-requests the manifest
for the filters-unavailable retry pill; refresh stale GeoJSON-path
comments (filter failure now degrades to unfiltered tiles).

Co-Authored-By: Claude Fable 5 <noreply@anthropic.com>"
```

---

### Task 3: Reveal the basemap when camera tiles fail

`markersReady` (which gates the map fade-in and the 15s watchdog) is set only when the camera source loads. On a tiles failure that never happens, so the map stays hidden and the watchdog fires the full-screen error. Add an effect that reveals the interactive basemap once it is loaded and tiles have failed, leaving the retry pill (Task 4) to carry the failure.

**Files:**
- Modify: `src/components/map/MapLibreContainer.tsx`

**Interfaces:**
- Consumes: `useCameraStore` (already imported in this file), `mapLoaded` state (line 172), `setMarkersReady` (line 173).
- Produces: no new exports; behavioral change to when `markersReady` becomes true.

- [ ] **Step 1: Add a `tilesFailed` selector**

In `src/components/map/MapLibreContainer.tsx`, near the other `useCameraStore` selectors at the top of the component body, add:

```ts
  const tilesFailed = useCameraStore(s => s.tilesFailed);
```

This component currently touches `tilesFailed` only via `useCameraStore.getState()`/`setTilesFailed`, so a reactive selector does not yet exist — add it.

- [ ] **Step 2: Add the reveal effect**

In `src/components/map/MapLibreContainer.tsx`, add this effect immediately after the existing "Notify parent when markers are ready" effect (currently lines 416-418):

```ts
  // Reveal the basemap on a camera-tile failure. markersReady normally waits
  // for the camera source to load, which never happens when tiles fail — so
  // without this the map stays hidden and the 15s watchdog fires a full-screen
  // error even though the basemap is fine. Once the basemap is up and tiles
  // have given up, reveal the interactive map; the retry pill carries the
  // camera-tile failure instead. GeoJSON is never loaded on this path.
  useEffect(() => {
    if (mapLoaded && tilesFailed) setMarkersReady(true);
  }, [mapLoaded, tilesFailed]);
```

- [ ] **Step 3: Typecheck / build**

Run: `npm run build`
Expected: build succeeds, no TypeScript errors.

- [ ] **Step 4: Lint the changed file**

Run: `npm run lint`
Expected: zero new lint errors (the new effect's deps are `mapLoaded` and `tilesFailed`, both listed).

- [ ] **Step 5: Commit**

```bash
git add src/components/map/MapLibreContainer.tsx
git commit -m "fix: reveal basemap when camera tiles fail

markersReady waited on the camera source, so a tiles failure left the map
hidden and tripped the 15s full-screen watchdog. Reveal the interactive
basemap once it is loaded and tiles have failed; the retry pill carries
the failure. No GeoJSON is loaded.

Co-Authored-By: Claude Fable 5 <noreply@anthropic.com>"
```

---

### Task 4: Add the camera-tile failure retry pill

A non-blocking pill for the map/route views that surfaces tile/filter failures with tap-to-retry, reusing the existing `StatusPill` error variant.

**Files:**
- Create: `src/components/map/CameraTileStatusPill.tsx`
- Modify: `src/pages/MapPage.tsx` (import; render near the existing `LoadingPill` at line 346)

**Interfaces:**
- Consumes: `StatusPill` from `@/components/common/StatusPill`; `useCameraStore` (`tilesFailed`, `filterTilesFailed`, `manifestPhase`, `filters.showAll`, `retryFilterTiles`); `handleRetryWithRemount` from MapPage.
- Produces: `CameraTileStatusPill({ onRetryTiles }: { onRetryTiles: () => void })`.

- [ ] **Step 1: Create the pill component**

Create `src/components/map/CameraTileStatusPill.tsx` with:

```tsx
import { useCameraStore } from '@/store';
import { StatusPill } from '@/components/common/StatusPill';

interface CameraTileStatusPillProps {
  /** Remount-based retry for the camera tile source (from MapPage). */
  onRetryTiles: () => void;
}

/**
 * Non-blocking failure pill for the map/route views. Those views never load
 * GeoJSON, so a camera-tile or filter-tile failure surfaces here as a
 * tap-to-retry pill rather than a blank map or a full-screen error.
 * Precedence: a full camera-tile failure wins over a filter-only failure —
 * if no cameras load at all, the filter notice is moot.
 */
export function CameraTileStatusPill({ onRetryTiles }: CameraTileStatusPillProps) {
  const tilesFailed = useCameraStore(s => s.tilesFailed);
  const filterTilesFailed = useCameraStore(s => s.filterTilesFailed);
  const manifestPhase = useCameraStore(s => s.manifestPhase);
  const filtersActive = useCameraStore(s => !s.filters.showAll);
  const retryFilterTiles = useCameraStore(s => s.retryFilterTiles);

  if (tilesFailed) {
    return (
      <StatusPill
        loading={false}
        text=""
        error="Camera layer unavailable. Tap to retry."
        onRetry={onRetryTiles}
      />
    );
  }

  if (filtersActive && (filterTilesFailed || manifestPhase === 'error')) {
    return (
      <StatusPill
        loading={false}
        text=""
        error="Filters unavailable. Showing all cameras. Tap to retry."
        onRetry={retryFilterTiles}
      />
    );
  }

  return null;
}
```

- [ ] **Step 2: Import it in MapPage**

In `src/pages/MapPage.tsx`, add near the other map-component imports (after the `MapThemeControl` import, currently line 26):

```tsx
import { CameraTileStatusPill } from '@/components/map/CameraTileStatusPill';
```

- [ ] **Step 3: Render it on the map/route views**

In `src/pages/MapPage.tsx`, add immediately after the existing `LoadingPill` render line (`{showCameraPill && <LoadingPill />}`, currently line 346):

```tsx
            {(appMode === 'map' || appMode === 'route') && (
              <CameraTileStatusPill onRetryTiles={handleRetryWithRemount} />
            )}
```

- [ ] **Step 4: Typecheck / build**

Run: `npm run build`
Expected: build succeeds, no TypeScript errors.

- [ ] **Step 5: Lint**

Run: `npm run lint`
Expected: zero new lint errors.

- [ ] **Step 6: Commit**

```bash
git add src/components/map/CameraTileStatusPill.tsx src/pages/MapPage.tsx
git commit -m "feat: camera-tile failure retry pill

Non-blocking tap-to-retry pill for the map/route views: 'Camera layer
unavailable' on a tiles failure (remount retry), 'Filters unavailable,
showing all cameras' on a filter failure (retryFilterTiles). Reuses the
StatusPill error variant.

Co-Authored-By: Claude Fable 5 <noreply@anthropic.com>"
```

---

### Task 5: End-to-end verification

Prove the guarantee (no GeoJSON on map/route) and the failure UX with the full gate plus the browser E2E skill.

**Files:** none (verification only).

- [ ] **Step 1: Run the full unit gate**

Run: `npm run test`
Expected: PASS — all suites, including the rewritten `cameraRenderModeLogic.test.ts` and the new `retryFilterTiles` store test.

- [ ] **Step 2: Lint gate**

Run: `npm run lint`
Expected: zero new lint errors (per the project lint gate).

- [ ] **Step 3: Production build**

Run: `npm run build`
Expected: TypeScript check + Vite build succeed.

- [ ] **Step 4: E2E — happy path, plain map loads no GeoJSON**

Invoke the `flockhopper 3:verify` skill. Drive the app on `/` (default map mode) at a metro zoom and confirm:
- Camera dots/points render from tiles.
- There is NO network request to `data.dontgetflocked.com/cameras.geojson.gz`.

Expected: cameras visible via tiles; zero GeoJSON requests.

- [ ] **Step 5: E2E — tiles blocked, basemap stays usable with the pill**

Using the `flockhopper 3:verify` skill, intercept and abort all requests to `tiles.dontgetflocked.com` for the camera archive (`cameras-us-hourly.pmtiles`) so the camera-tiles source errors, then load `/`. Confirm:
- The basemap remains visible and the map is pannable (not a full-screen error, not a blank faded map).
- The pill reads exactly: `Camera layer unavailable. Tap to retry.`
- There is NO request to `data.dontgetflocked.com/cameras.geojson.gz` (the core guarantee: a tiles failure never triggers GeoJSON).

Expected: basemap usable, retry pill shown, zero GeoJSON requests.

- [ ] **Step 6: E2E — Timeline still loads GeoJSON (no regression)**

Using the `flockhopper 3:verify` skill, switch to Timeline/Explore mode and confirm a request to `data.dontgetflocked.com/cameras.geojson.gz` DOES fire and the timeline renders. This proves the guard only fences map/route, not the legitimate consumers.

Expected: GeoJSON loads in Timeline; timeline renders.

- [ ] **Step 7: Final commit (only if Steps 4-6 required source fixes)**

If any E2E step surfaced a fix, commit it with a scoped `git add` and a descriptive message. If no fixes were needed, this step is a no-op.

---

## Notes / accepted limitations

- **Silent camera-tile stall (basemap up, camera archive hangs with no error):** `tilesFailed` only flips on error events, so a silent stall does not trigger the reveal effect and still hits the 15s full-screen watchdog. This matches pre-change behavior and is out of scope; the tiles host serves both the basemap and camera archive, so a basemap that streams almost always means the camera archive resolves or errors rather than hanging.
- **Lost resilience:** if the camera tile archive is broken but `data.dontgetflocked.com` is healthy, the map now shows the retry pill instead of recovering via GeoJSON. Accepted per the spec — the GeoJSON recovery pegs CPU, and an explicit retry is preferable to a silent CPU-pegging degrade.
