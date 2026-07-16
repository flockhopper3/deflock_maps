# Timeline Refactor Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make the Timeline page responsive and bug-free by removing the zoom≥13 marker layer, replacing the dot size/opacity sliders with one tuned zoom curve, and rebuilding the sparkline as an SVG area chart.

**Architecture:** Timeline (`appMode === 'explore'` + `mapVisualization === 'dots'`) becomes dots-only at every zoom. `CameraMarkerLayers` is no longer mounted there, so its two large sources are never built. `TimelineBar` decomposes into a sparkline component plus two hooks, and a shared `useIsMobile` becomes the single breakpoint source.

**Tech Stack:** React 18, TypeScript, Zustand, MapLibre GL via react-map-gl, Tailwind CSS, Vite.

**Spec:** `docs/superpowers/specs/2026-07-15-timeline-refactor-design.md`

## Global Constraints

- **No test runner exists for the frontend.** `package.json` has no `test` script; the vitest files under `worker/tests/` are worker-only. Do **not** add a test framework — it is out of scope. Every task verifies via `npm run build`, `npm run lint`, and explicit browser checks against `npm run dev` (port 3000).
- **Scope is Timeline only.** Route, Map, and Explore-heatmap behavior must not change. The heatmap's own zoom≥13 filter bug is **deliberately out of scope** — do not fix it.
- **Preserve the RAF/throttle machinery.** `TICK_THROTTLE_MS = 80` and the RAF coalescing are load-bearing for playback performance on low-end devices. Relocate them; do not simplify them away.
- **Do not commit unrelated working-tree changes.** `src/components/map/layers/CameraMarkerLayers.tsx` and `src/components/map/layers/CameraTileLayers.tsx` have pre-existing uncommitted edits from other work. `git add` only the exact files each task names.
- **`docs/` is gitignored** but specs/plans are tracked by precedent — use `git add -f` for files under `docs/`.
- Existing sparkline colors are exact and must be preserved: active `rgba(34,211,238,0.6)`, inactive `rgba(255,255,255,0.1)`.

## File Structure

**Create:**
| File | Responsibility |
|---|---|
| `src/hooks/useIsMobile.ts` | Single source of truth for the 1024px breakpoint |
| `src/modes/timeline/TimelineSparkline.tsx` | SVG cumulative area chart + progress clip |
| `src/modes/timeline/useTimelineTicker.ts` | Throttled tick dispatch + RAF playback loop |
| `src/modes/timeline/useTimelineScrubber.ts` | Pointer + keyboard input → day index |

**Modify:**
| File | Change |
|---|---|
| `src/modes/timeline/timelineUtils.ts` | Add `TIMELINE_START`, `VISIBLE_START`, `buildSparklinePath` |
| `src/modes/timeline/TimelineBar.tsx` | Reduce to composition + layout |
| `src/components/map/MapLibreContainer.tsx` | Drop dots-mode markers; gate `CameraMarkerLayers` mount |
| `src/components/map/layers/DotDensityLayers.tsx` | Static zoom curves; delete `setPaintProperty` effect |
| `src/modes/dots/DotDensityControls.tsx` | Remove sliders; rewrite About copy |
| `src/store/appModeStore.ts` | `DotDensitySettings` → `{ color }`; export `TIMELINE_START` usage |
| `src/pages/MapPage.tsx` | Use `useIsMobile`; `TIMELINE_START`; safe-area inset |
| `src/components/panels/ExplorePanel.tsx` | Use `useIsMobile` |

---

### Task 1: Shared `useIsMobile` hook

Two components run their own 1024px resize listener, and they disagree in embed mode:
`MapPage.tsx:99-105` returns early when `isEmbed`, so it is frozen at `false`; `ExplorePanel.tsx:19-24`
has no embed awareness. In a narrow embed today you get ExplorePanel's mobile BottomSheet *and*
MapPage's desktop timeline bar simultaneously. One hook fixes the divergence.

**Files:**
- Create: `src/hooks/useIsMobile.ts`
- Modify: `src/pages/MapPage.tsx:96-105`, `src/components/panels/ExplorePanel.tsx:1-24`

**Interfaces:**
- Produces: `useIsMobile(): boolean` — `true` when `window.innerWidth < 1024`.

- [ ] **Step 1: Create the hook**

```ts
// src/hooks/useIsMobile.ts
import { useEffect, useState } from 'react';

/** Tailwind's `lg` breakpoint — the single source of truth for mobile layout. */
export const MOBILE_BREAKPOINT = 1024;

/**
 * Tracks whether the viewport is below the `lg` breakpoint.
 *
 * Deliberately width-only: an embed narrower than 1024px gets the mobile
 * layout, same as any other narrow viewport. Two components previously kept
 * private copies of this state and disagreed in embed mode.
 */
export function useIsMobile(): boolean {
  const [isMobile, setIsMobile] = useState(
    () => typeof window !== 'undefined' && window.innerWidth < MOBILE_BREAKPOINT
  );

  useEffect(() => {
    const query = window.matchMedia(`(max-width: ${MOBILE_BREAKPOINT - 1}px)`);
    const update = () => setIsMobile(query.matches);
    update();
    query.addEventListener('change', update);
    return () => query.removeEventListener('change', update);
  }, []);

  return isMobile;
}
```

- [ ] **Step 2: Use it in MapPage**

In `src/pages/MapPage.tsx`, add to the imports near `useEmbedMode`:

```ts
import { useIsMobile } from '@/hooks/useIsMobile';
```

Delete this entire block (lines 96-105):

```ts
  // Responsive breakpoint — single source of truth for timeline bar layout
  // Never go mobile in embed mode — the iframe width should not affect layout
  const [isMobile, setIsMobile] = useState(false);
  useEffect(() => {
    if (isEmbed) return;
    const checkMobile = () => setIsMobile(window.innerWidth < 1024);
    checkMobile();
    window.addEventListener('resize', checkMobile);
    return () => window.removeEventListener('resize', checkMobile);
  }, [isEmbed]);
```

Replace with:

```ts
  const isMobile = useIsMobile();
```

- [ ] **Step 3: Use it in ExplorePanel**

In `src/components/panels/ExplorePanel.tsx`, change line 1 from:

```ts
import { useState, useEffect } from 'react';
```

to:

```ts
import { useState, useEffect } from 'react';
import { useIsMobile } from '../../hooks/useIsMobile';
```

Delete lines 11 and 19-24:

```ts
  const [isMobile, setIsMobile] = useState(false);
```
```ts
  useEffect(() => {
    const checkMobile = () => setIsMobile(window.innerWidth < 1024);
    checkMobile();
    window.addEventListener('resize', checkMobile);
    return () => window.removeEventListener('resize', checkMobile);
  }, []);
```

Add in their place, next to the other hooks:

```ts
  const isMobile = useIsMobile();
```

- [ ] **Step 4: Verify build and lint**

Run: `npm run build && npm run lint`
Expected: build succeeds, no new lint errors. If `useState`/`useEffect` are now unused in either file, remove them from the import — lint will flag it.

- [ ] **Step 5: Verify in the browser**

Run: `npm run dev`, open `http://localhost:3000/timeline`.
- Resize across 1024px: the timeline bar switches between the mobile and desktop wrappers, and the panel switches between BottomSheet and side panel, **at the same width** (previously they could disagree).
- Open `http://localhost:3000/timeline?embed=1` at ~400px wide: you now get the mobile layout consistently, instead of a mobile BottomSheet under a desktop timeline bar. This is an intentional embed behavior change.

- [ ] **Step 6: Commit**

```bash
git add src/hooks/useIsMobile.ts src/pages/MapPage.tsx src/components/panels/ExplorePanel.tsx
git commit -m "refactor: single useIsMobile hook for the lg breakpoint

MapPage and ExplorePanel each ran their own 1024px listener and disagreed in
embed mode — MapPage returned early when embedded and froze at desktop while
ExplorePanel switched to its mobile sheet on width alone, so a narrow embed
rendered a mobile bottom sheet under a desktop timeline bar."
```

---

### Task 2: Consolidate timeline constants

`'2024-07-01'` is written in three places and `VISIBLE_START` is private to `TimelineBar`.
`timelineUtils.ts` imports nothing, so it is safe for the store to import from it (no cycle).

**Files:**
- Modify: `src/modes/timeline/timelineUtils.ts:1-2`, `src/store/appModeStore.ts:70`, `src/pages/MapPage.tsx:119,153`, `src/modes/timeline/TimelineBar.tsx:14-15`

**Interfaces:**
- Produces: `TIMELINE_START = '2024-07-01'`, `VISIBLE_START = '2024-01-01'` exported from `src/modes/timeline/timelineUtils.ts`.

- [ ] **Step 1: Add the constants to timelineUtils**

In `src/modes/timeline/timelineUtils.ts`, after line 2 (`export const MONTH_NAMES = ...`), add:

```ts
/** Date the timeline scrubber starts at, and the `/timeline` route resets to. */
export const TIMELINE_START = '2024-07-01';

/** Only render the sparkline from this date forward — earlier data is a flat tail. */
export const VISIBLE_START = '2024-01-01';
```

- [ ] **Step 2: Use TIMELINE_START in the store**

In `src/store/appModeStore.ts`, add to the top imports (after line 1):

```ts
import { TIMELINE_START } from '../modes/timeline/timelineUtils';
```

Delete line 70:

```ts
const TIMELINE_START = '2024-07-01';
```

Then update the comment on lines 108-109 so it does not restate the literal:

```ts
      // Default to today so all cameras are visible (no timeline filtering).
      // The /timeline route explicitly overrides this to TIMELINE_START.
```

- [ ] **Step 3: Use TIMELINE_START in MapPage**

In `src/pages/MapPage.tsx`, add to the imports:

```ts
import { TIMELINE_START } from '@/modes/timeline/timelineUtils';
```

At line 119, change:

```ts
          currentDate: isTimelinePath ? '2024-07-01' : new Date().toISOString().slice(0, 10),
```

to:

```ts
          currentDate: isTimelinePath ? TIMELINE_START : new Date().toISOString().slice(0, 10),
```

At line 153, change:

```ts
          currentDate: '2024-07-01',
```

to:

```ts
          currentDate: TIMELINE_START,
```

- [ ] **Step 4: Use VISIBLE_START in TimelineBar**

In `src/modes/timeline/TimelineBar.tsx`, delete lines 14-15:

```ts
/** Only show the sparkline from this date forward */
const VISIBLE_START = '2024-01-01';
```

Add `VISIBLE_START` to the existing import from `./timelineUtils` (lines 6-12):

```ts
import {
  DAY_MS,
  VISIBLE_START,
  dayIndexToDate,
  dateToDayIndex,
  formatDateFixed,
  totalDays,
} from './timelineUtils';
```

- [ ] **Step 5: Verify no literals remain**

Run: `grep -rn "2024-07-01\|2024-01-01" src/`
Expected: exactly two hits, both the definitions in `src/modes/timeline/timelineUtils.ts`.

- [ ] **Step 6: Verify build and behavior**

Run: `npm run build && npm run lint`
Expected: succeeds. A circular-import error here means the store↔utils direction is wrong — `timelineUtils` must not import from the store.

Run `npm run dev`, open `/timeline`: the scrubber still starts at Jul 01, 2024 and the sparkline still begins at Jan 2024.

- [ ] **Step 7: Commit**

```bash
git add src/modes/timeline/timelineUtils.ts src/store/appModeStore.ts src/pages/MapPage.tsx src/modes/timeline/TimelineBar.tsx
git commit -m "refactor: consolidate timeline start constants

'2024-07-01' was written in appModeStore, MapPage's mount effect, and
MapPage's mode handler, so a change to the timeline start needed three edits
that could silently drift apart."
```

---

### Task 3: Remove the marker layer from Timeline

This is the core fix. `showCameraMarkers` (`MapLibreContainer.tsx:240-245`) force-shows
`CameraMarkerLayers` past z13, but `handleTimelineTick` (line 361-363) only date-filters those
layers when `showMarkers` is set — so past z13 the markers render **unfiltered** while the dots
below stay filtered. `CameraMarkerLayers` is also always mounted (line 1068), building a
114k-feature source and a cone polygon per camera that Timeline never shows.

**Files:**
- Modify: `src/components/map/MapLibreContainer.tsx:236-245, 355-363, 1066-1073`, `src/store/appModeStore.ts:33-38, 63-68`

**Interfaces:**
- Consumes: nothing from earlier tasks.
- Produces: `DotDensitySettings` no longer has `showMarkers`.

- [ ] **Step 1: Drop the dots branch from showCameraMarkers**

In `src/components/map/MapLibreContainer.tsx`, replace lines 236-245:

```ts
  // In explore mode, auto-show markers when zoomed past 13 (heatmap crossfades out 13-14),
  // or when the user explicitly toggles "Show Markers" at any zoom.
  // In density mode, hide camera markers entirely to keep choropleth clean.
  const isMapModeHeatmap = isMapMode && mapModeViz === 'heatmap';
  const showCameraMarkers = !isNetworkMode && !isDensityMode && !isMapModeHeatmap && (
    appMode === 'route'
    || isMapMode
    || (isHeatmapMode && (heatmapSettings.showMarkers || zoom >= 13))
    || (isDotsMode && (dotDensitySettings.showMarkers || zoom >= 13))
  );
```

with:

```ts
  // In heatmap explore, auto-show markers when zoomed past 13 (heatmap crossfades out 13-14),
  // or when the user explicitly toggles "Show Markers" at any zoom.
  // In density mode, hide camera markers entirely to keep choropleth clean.
  // Timeline (dots) never shows markers: the dot layer carries every zoom, and the
  // markers it used to stack on top were never date-filtered past z13.
  const isMapModeHeatmap = isMapMode && mapModeViz === 'heatmap';
  const showCameraMarkers = !isNetworkMode && !isDensityMode && !isMapModeHeatmap && (
    appMode === 'route'
    || isMapMode
    || (isHeatmapMode && (heatmapSettings.showMarkers || zoom >= 13))
  );
```

- [ ] **Step 2: Simplify markersVisible in handleTimelineTick**

In the same file, replace lines 355-363:

```ts
    const { mapVisualization, appMode, heatmapSettings, dotDensitySettings } = useAppModeStore.getState();
    const isExplore = appMode === 'explore';
    const isHeatmap = isExplore && mapVisualization === 'heatmap';
    const isDots = isExplore && mapVisualization === 'dots';
    const markersVisible = !isExplore
      || (isHeatmap && heatmapSettings.showMarkers)
      || (isDots && dotDensitySettings.showMarkers);
```

with:

```ts
    const { mapVisualization, appMode, heatmapSettings } = useAppModeStore.getState();
    const isExplore = appMode === 'explore';
    const isHeatmap = isExplore && mapVisualization === 'heatmap';
    const isDots = isExplore && mapVisualization === 'dots';
    // Timeline (dots) no longer mounts CameraMarkerLayers at all.
    const markersVisible = !isExplore || (isHeatmap && heatmapSettings.showMarkers);
```

Leave `isDots` in place — it is still used further down to filter `dot-density-layer`.

- [ ] **Step 3: Gate the CameraMarkerLayers mount**

In the same file, replace lines 1066-1073:

```tsx
      {/* Legacy GeoJSON camera layers — empty until the dataset lazily loads;
          becomes the active path for filters/timeline/heatmap/Canada. */}
      <CameraMarkerLayers
        cameras={cameraSource}
        visible={!isTilesMode && showCameraMarkers}
        mapLoaded={mapLoaded}
        mapRef={mapRef}
      />
```

with:

```tsx
      {/* Legacy GeoJSON camera layers — empty until the dataset lazily loads;
          becomes the active path for filters/heatmap/Canada.
          Unmounted entirely in Timeline: `visible` only toggles layout visibility,
          so a mounted instance still builds a 114k-feature source plus a cone
          polygon per camera that Timeline would never draw. */}
      {!isDotsMode && (
        <CameraMarkerLayers
          cameras={cameraSource}
          visible={!isTilesMode && showCameraMarkers}
          mapLoaded={mapLoaded}
          mapRef={mapRef}
        />
      )}
```

- [ ] **Step 4: Remove showMarkers from the store**

In `src/store/appModeStore.ts`, replace lines 33-38:

```ts
export interface DotDensitySettings {
  radius: number;          // dot size in px (1-6)
  opacity: number;         // per-dot opacity (0.05-0.5) — stacks visually in dense areas
  color: string;           // dot color hex
  showMarkers: boolean;
}
```

with:

```ts
export interface DotDensitySettings {
  radius: number;          // dot size in px (1-6)
  opacity: number;         // per-dot opacity (0.05-0.5) — stacks visually in dense areas
  color: string;           // dot color hex
}
```

and replace lines 63-68:

```ts
const DEFAULT_DOT_DENSITY_SETTINGS: DotDensitySettings = {
  radius: 2,
  opacity: 0.25,
  color: '#4DA6FF',
  showMarkers: false,
};
```

with:

```ts
const DEFAULT_DOT_DENSITY_SETTINGS: DotDensitySettings = {
  radius: 2,
  opacity: 0.25,
  color: '#4DA6FF',
};
```

Leave `HeatmapSettings.showMarkers` alone — the heatmap still uses it.

- [ ] **Step 5: Verify build and lint**

Run: `npm run build && npm run lint`
Expected: succeeds. TypeScript will flag any remaining `dotDensitySettings.showMarkers` reader — there should be none left after Steps 1-2.

Run: `grep -rn "dotDensitySettings" src/components/map/MapLibreContainer.tsx`
Expected: only line 212 (`const dotDensitySettings = useAppModeStore(...)`). If nothing else in the file reads it, delete line 212 too and re-run build.

- [ ] **Step 6: Verify the bug is fixed**

Run `npm run dev`, open `/timeline`.
- **The bug:** zoom to z16 over a dense metro, then scrub the date backwards. Only dots render and they *disappear as the date moves back*. Previously, solid blue points and direction cones appeared at z13+ and stayed put regardless of date.
- Click a dot at z16: **no popup opens** (Timeline has no metadata layer now).
- **Regression checks:** `/route` still shows markers, cones, and popups. `/` (Map mode) still shows markers and popups. In `/timeline`, switch the map-type dropdown to Heatmap and zoom past 13 — markers still appear there (unchanged, and its filter bug is deliberately out of scope).

- [ ] **Step 7: Commit**

```bash
git add src/components/map/MapLibreContainer.tsx src/store/appModeStore.ts
git commit -m "fix: drop the zoom>=13 marker layer from Timeline

handleTimelineTick only date-filtered the marker layers when showMarkers was
set, but showCameraMarkers also turned them on at zoom>=13 — so zooming past
13 during playback rendered every camera unfiltered while the dots beneath
stayed filtered, making the scrubber look broken.

CameraMarkerLayers was also always mounted, with `visible` toggling only
layout visibility, so Timeline built a 114k-feature source and a cone polygon
per camera it never drew. Unmounting it in dots mode drops two of three
sources."
```

---

### Task 4: Dot zoom curve, sliders removed

**Files:**
- Modify: `src/components/map/layers/DotDensityLayers.tsx:1-111`, `src/store/appModeStore.ts:33-38, 63-67`, `src/modes/dots/DotDensityControls.tsx:1-129`

**Interfaces:**
- Consumes: `DotDensitySettings` from Task 3 (already without `showMarkers`).
- Produces: `DotDensitySettings` is `{ color: string }`.

- [ ] **Step 1: Shrink DotDensitySettings to color**

In `src/store/appModeStore.ts`, replace the interface:

```ts
export interface DotDensitySettings {
  color: string;           // dot color hex — size and opacity are tuned zoom curves
}
```

and the defaults:

```ts
const DEFAULT_DOT_DENSITY_SETTINGS: DotDensitySettings = {
  color: '#4DA6FF',
};
```

- [ ] **Step 2: Replace DotDensityLayers with static curves**

Replace the whole body of `src/components/map/layers/DotDensityLayers.tsx` with:

```tsx
import { useMemo } from 'react';
import { Source, Layer } from 'react-map-gl/maplibre';
import type maplibregl from 'maplibre-gl';
import { useCameraStore, useAppModeStore } from '../../../store';
import type { ALPRCamera } from '../../../types';

/**
 * Dot size across zoom.
 *
 * Through z11 this holds the historical 2-3px, which is what makes overlapping
 * dots stack into a readable density field. From z13 dots grow into individually
 * legible marks — deliberately taking over the job the removed marker layer did.
 * Linear between hand-tuned anchors: the anchors are the design.
 */
const DOT_RADIUS: maplibregl.DataDrivenPropertyValueSpecification<number> = [
  'interpolate', ['linear'], ['zoom'],
  0, 1.5,
  4, 2,
  10, 3,
  13, 4.8,
  14, 6,
  16, 9,
  18, 12,
];

/**
 * Dot opacity across zoom.
 *
 * Stays at the historical 0.25 while stacking does the work. Once cameras
 * separate past z13 nothing stacks, so a 25% dot would just read as faint —
 * it solidifies to near-opaque by z15.
 */
const DOT_OPACITY: maplibregl.DataDrivenPropertyValueSpecification<number> = [
  'interpolate', ['linear'], ['zoom'],
  4, 0.25,
  11, 0.25,
  13, 0.55,
  15, 0.9,
];

/**
 * Convert cameras to unclustered GeoJSON for dot density rendering.
 * Each camera becomes one small semi-transparent dot.
 * Where dots overlap, opacity stacks — dense areas appear brighter/more solid.
 */
function camerasToDotsGeoJSON(cameras: ALPRCamera[]): GeoJSON.FeatureCollection {
  const features = new Array(cameras.length);
  for (let i = 0; i < cameras.length; i++) {
    const camera = cameras[i];
    features[i] = {
      type: 'Feature' as const,
      geometry: {
        type: 'Point' as const,
        coordinates: [
          Math.round(camera.lon * 10000) / 10000,
          Math.round(camera.lat * 10000) / 10000,
        ],
      },
      properties: {
        ts: camera.osmTimestamp ? new Date(camera.osmTimestamp).getTime() : 0,
      },
    };
  }
  return { type: 'FeatureCollection', features };
}

export function DotDensityLayers() {
  const filteredCameras = useCameraStore(s => s.filteredCameras);
  const cameras = useCameraStore(s => s.cameras);
  const dotColor = useAppModeStore((s) => s.dotDensitySettings.color);
  const appMode = useAppModeStore((s) => s.appMode);
  const isTimelineActive = appMode === 'explore';

  // Derive camera source outside memo so reference equality prevents recomputation on tab switches
  const cameraSource = isTimelineActive ? cameras : filteredCameras;

  // During timeline, load ALL cameras once; visibility controlled via filter prop
  const geojsonData = useMemo(
    () => camerasToDotsGeoJSON(cameraSource),
    [cameraSource]
  );

  // Timeline filtering is handled entirely by MapLibreContainer's imperative
  // handleTimelineTick (calls map.setFilter on 'dot-density-layer').
  // This initial filter prevents a flash of all dots before the first tick runs.
  const initialFilter = useMemo(() => {
    if (!isTimelineActive) return undefined;
    const { currentDate } = useAppModeStore.getState().timelineSettings;
    const parts = currentDate.split('-').map(Number);
    const cutoffMs = new Date(parts[0], parts[1] - 1, parts[2], 23, 59, 59, 999).getTime();
    // ts=0 (no-date cameras) is always <= cutoffMs, so single comparison suffices
    return ['<=', ['get', 'ts'], cutoffMs] as maplibregl.FilterSpecification;
  }, [isTimelineActive]);

  // Size and opacity are static curves, so color is the only paint property that
  // can change — and only on a rare click. react-map-gl diffs paint props and
  // calls setPaintProperty itself, so no imperative effect is needed here.
  return (
    <Source
      id="cameras-dots"
      type="geojson"
      data={geojsonData}
    >
      <Layer
        id="dot-density-layer"
        type="circle"
        source="cameras-dots"
        filter={initialFilter}
        paint={{
          'circle-color': dotColor,
          'circle-radius': DOT_RADIUS,
          'circle-opacity': DOT_OPACITY,
          'circle-stroke-width': 0,
        }}
      />
    </Source>
  );
}
```

Note what this deletes: the `useEffect` + `prevSettingsRef` + `useMap` import. They existed only to
push slider changes into the layer.

- [ ] **Step 3: Remove the sliders from DotDensityControls**

Replace the whole body of `src/modes/dots/DotDensityControls.tsx` with:

```tsx
import { useAppModeStore } from '../../store';

const DOT_COLORS = [
  { id: '#4DA6FF', name: 'Blue', preview: '#4DA6FF' },
  { id: '#f97316', name: 'Orange', preview: '#f97316' },
  { id: '#eab308', name: 'Yellow', preview: '#eab308' },
  { id: '#22c55e', name: 'Green', preview: '#22c55e' },
  { id: '#06b6d4', name: 'Cyan', preview: '#06b6d4' },
  { id: '#ffffff', name: 'White', preview: '#ffffff' },
];

export function DotDensityControls() {
  const dotColor = useAppModeStore((s) => s.dotDensitySettings.color);
  const updateDotDensitySettings = useAppModeStore((s) => s.updateDotDensitySettings);

  return (
    <div className="space-y-6">
      {/* Dot Color */}
      <div>
        <span className="block text-xs font-medium text-dark-400 uppercase tracking-wider mb-3">
          Dot Color
        </span>
        <div className="grid grid-cols-3 gap-2">
          {DOT_COLORS.map((c) => {
            const isActive = dotColor === c.id;
            return (
              <button
                key={c.id}
                onClick={() => updateDotDensitySettings({ color: c.id })}
                className={`flex items-center gap-2.5 px-3 py-2.5 rounded-xl border transition-all ${
                  isActive
                    ? 'bg-dark-700 border-dark-600'
                    : 'bg-dark-800 border-dark-600 hover:border-dark-500'
                }`}
              >
                <div
                  className="w-4 h-4 rounded-full flex-shrink-0 border border-dark-500"
                  style={{ backgroundColor: c.preview }}
                />
                <span className={`text-xs font-medium ${isActive ? 'text-white' : 'text-dark-300'}`}>
                  {c.name}
                </span>
              </button>
            );
          })}
        </div>
      </div>

      {/* About */}
      <div className="bg-dark-800/50 rounded-xl p-4 border border-dark-700/50">
        <div className="flex items-start gap-3">
          <div className="w-8 h-8 rounded-lg bg-accent/10 flex items-center justify-center flex-shrink-0">
            <svg className="w-4 h-4 text-accent" viewBox="0 0 24 24" fill="currentColor">
              <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm1 15h-2v-6h2v6zm0-8h-2V7h2v2z" />
            </svg>
          </div>
          <div>
            <p className="text-sm text-dark-300 font-medium mb-1">About Dot Density</p>
            <p className="text-xs text-dark-400 leading-relaxed">
              Each camera is one dot. Zoomed out, dots are small and translucent, so
              where cameras cluster the overlaps stack into brighter, more solid areas —
              density you can read at a glance. Zoom in and dots grow into individual
              cameras.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
```

The old copy ended with "Lower the opacity for stronger contrast between sparse and dense areas,"
which describes a control that no longer exists.

- [ ] **Step 4: Verify build and lint**

Run: `npm run build && npm run lint`
Expected: succeeds. TypeScript flags any leftover `.radius` / `.opacity` reader on `dotDensitySettings`.

Run: `grep -rn "dotDensitySettings.radius\|dotDensitySettings.opacity\|SliderControl" src/modes/dots/ src/components/map/layers/DotDensityLayers.tsx`
Expected: no output.

- [ ] **Step 5: Verify the curve in the browser**

Run `npm run dev`, open `/timeline`.
- Zoom slowly z4 → z18. Dots grow smoothly with **no visible step or pop** at any anchor (0/4/10/13/14/16/18).
- At z4-z10 the national density field looks the same as before this change (2-3px at 25%).
- At z15-z16 individual dots are clearly legible — this is what replaces the removed markers.
- Panel shows Color swatches and the About card, with **no Dot Size or Dot Opacity slider**.
- Click each color swatch: dots recolor immediately (this proves declarative paint diffing works without the deleted effect).

- [ ] **Step 6: Commit**

```bash
git add src/components/map/layers/DotDensityLayers.tsx src/store/appModeStore.ts src/modes/dots/DotDensityControls.tsx
git commit -m "feat: tuned dot zoom curve, drop size and opacity sliders

dot-density-layer used a flat circle-radius with no zoom interpolation — the
only camera layer that didn't — so a dot was 2px at z16 exactly as at z4.

Size and opacity are now one coupled curve: unchanged through z11 so stacking
still reads as density, then growing and solidifying past z13 to take over the
job the removed marker layer was doing. That makes them a design decision
rather than a slider, so both sliders come out, and with them the
setPaintProperty effect that existed only to push slider values into the layer."
```

---

### Task 5: SVG sparkline

~130 bars in `flex-1 gap-px` land under 1px each on a 360px phone and alias away. An SVG
`viewBox` is resolution-independent, so the problem stops existing rather than being worked around.

**Files:**
- Create: `src/modes/timeline/TimelineSparkline.tsx`
- Modify: `src/modes/timeline/timelineUtils.ts`, `src/modes/timeline/TimelineBar.tsx:132-150, 350-384`

**Interfaces:**
- Consumes: `VISIBLE_START` from Task 2.
- Produces: `buildSparklinePath(bars: number[], peak: number): string`;
  `<TimelineSparkline path={string} progressPercent={number} />`.

- [ ] **Step 1: Add the path builder to timelineUtils**

Append to `src/modes/timeline/timelineUtils.ts`:

```ts
/**
 * Build an SVG area path for a cumulative series, normalized to a 0 0 1000 100
 * viewBox. The viewBox is what makes the chart resolution-independent: it renders
 * identically at 320px and 2560px, so bars can never fall below a pixel.
 *
 * Returns '' for an empty or all-zero series (nothing to draw before the camera
 * dataset hydrates).
 */
export function buildSparklinePath(bars: number[], peak: number): string {
  if (bars.length === 0 || peak <= 0) return '';
  const stepX = bars.length > 1 ? 1000 / (bars.length - 1) : 1000;
  let d = 'M 0 100';
  for (let i = 0; i < bars.length; i++) {
    const x = (i * stepX).toFixed(2);
    const y = (100 - (bars[i] / peak) * 100).toFixed(2);
    d += ` L ${x} ${y}`;
  }
  return `${d} L 1000 100 Z`;
}
```

- [ ] **Step 2: Create the sparkline component**

```tsx
// src/modes/timeline/TimelineSparkline.tsx

/**
 * Cumulative growth chart for the timeline scrubber.
 *
 * Two identical paths: one dim, one accent-colored and clipped to the current
 * progress. The path never changes during playback, so React diffs both as
 * unchanged and only the clip rect's width is written to the DOM per tick —
 * matching the performance of the imperative per-bar coloring this replaces.
 */

// Static: exactly one TimelineBar is mounted at a time. useId() would emit ':r0:',
// whose colons are hostile to url(#...) references.
const CLIP_ID = 'timeline-sparkline-clip';

interface TimelineSparklineProps {
  /** SVG path in a 0 0 1000 100 viewBox — see buildSparklinePath */
  path: string;
  /** Scrubber position, 0-100 */
  progressPercent: number;
}

export function TimelineSparkline({ path, progressPercent }: TimelineSparklineProps) {
  if (!path) return null;

  return (
    <svg
      viewBox="0 0 1000 100"
      preserveAspectRatio="none"
      className="absolute inset-0 w-full h-full"
      aria-hidden="true"
    >
      <defs>
        <clipPath id={CLIP_ID}>
          {/* viewBox is 1000 wide, so percent maps to units at 10x */}
          <rect x="0" y="0" width={progressPercent * 10} height="100" />
        </clipPath>
      </defs>
      <path d={path} fill="rgba(255,255,255,0.1)" />
      <path d={path} fill="rgba(34,211,238,0.6)" clipPath={`url(#${CLIP_ID})`} />
    </svg>
  );
}
```

- [ ] **Step 3: Use it in TimelineBar**

In `src/modes/timeline/TimelineBar.tsx`:

Add to imports:

```ts
import { TimelineSparkline } from './TimelineSparkline';
```

Add `buildSparklinePath` to the `./timelineUtils` import list.

Delete the imperative coloring block entirely (lines 132-150):

```ts
  // --- Imperative sparkline color updates (avoids React diffing ~110 bars per tick) ---
  const barsRef = useRef<HTMLDivElement>(null);
  const prevBpRef = useRef(-1);

  useLayoutEffect(() => {
    ...
  }, [sparklinePosition]);
```

Replace the `sparklinePosition` memo (lines 124-130) with a percent, since the SVG clip wants a
percentage rather than a bar index:

```ts
  // Scrubber position as a percentage of the visible (clipped) range
  const progressPercent = useMemo(() => {
    const visibleRange = maxIndex - visibleStartIndex;
    if (visibleRange <= 0) return 0;
    const ratio = (clampedIndex - visibleStartIndex) / visibleRange;
    return Math.max(0, Math.min(1, ratio)) * 100;
  }, [clampedIndex, visibleStartIndex, maxIndex]);
```

Add the memoized path next to `sparklineData`:

```ts
  const sparklinePath = useMemo(
    () => buildSparklinePath(sparklineData.bars, sparklineData.peak),
    [sparklineData]
  );
```

Delete the now-unused `handlePercent` computation (lines 327-331) and use `progressPercent` for the
handle instead.

Replace the track JSX (lines 350-384) with:

```tsx
      {/* Sparkline + Scrubber */}
      <div
        ref={trackRef}
        className="flex-1 h-8 lg:h-9 relative cursor-pointer"
        style={{ touchAction: 'none' }}
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={onPointerUp}
      >
        <TimelineSparkline path={sparklinePath} progressPercent={progressPercent} />

        {/* Scrubber handle */}
        <div
          className="absolute top-0 bottom-0 w-px bg-accent/80 pointer-events-none"
          style={{ left: `${progressPercent}%` }}
        >
          <div className="absolute -bottom-0.5 left-1/2 -translate-x-1/2 w-2 h-2 rounded-full bg-accent" />
        </div>
      </div>
```

Note the container loses `flex items-end gap-px` — the SVG is absolutely positioned now.

Remove `useLayoutEffect` from the React import if it is no longer used.

- [ ] **Step 4: Verify build and lint**

Run: `npm run build && npm run lint`
Expected: succeeds, no unused-variable warnings for `barsRef`, `prevBpRef`, `useLayoutEffect`, or `handlePercent`.

- [ ] **Step 5: Verify rendering at every width**

Run `npm run dev`, open `/timeline`. Using DevTools device toolbar, check **320, 375, 414, 768, 1024, 1440**:
- The curve renders as a smooth filled area at every width, with **no gaps, aliasing, or missing bars** (the old bars vanished below ~500px).
- The filled (cyan) portion ends exactly at the scrubber handle.
- Drag the scrubber: fill tracks the handle with no lag or tearing.
- Press play: fill advances smoothly.

- [ ] **Step 6: Commit**

```bash
git add src/modes/timeline/TimelineSparkline.tsx src/modes/timeline/timelineUtils.ts src/modes/timeline/TimelineBar.tsx
git commit -m "refactor: SVG sparkline replaces ~130 flex bars

Each bar got flex-1 of the track, so on a 360px phone they landed under a
pixel and aliased away. A viewBox'd path renders identically at any width.

Progress is now a clip rect driven by one number, which retires the
barsRef/prevBpRef/useLayoutEffect hack that reached into DOM children to
recolor bars imperatively and dodge React diffing 130 nodes. The path is
memoized and never changes during playback, so only the rect width is
written per tick."
```

---

### Task 6: Extract `useTimelineTicker`

**Files:**
- Create: `src/modes/timeline/useTimelineTicker.ts`
- Modify: `src/modes/timeline/TimelineBar.tsx:32-78, 180-186, 279-324`

**Interfaces:**
- Consumes: `dayIndexToDate`, `dateToDayIndex` from `timelineUtils`.
- Produces:
  ```ts
  interface TimelineTicker {
    dispatchTick: (date: string) => void;  // throttled to ~12fps
    flushTick: (date: string) => void;     // immediate + clears pending
  }
  function useTimelineTicker(args: {
    timelineMinDay: string;
    maxIndex: number;
    isPlaying: boolean;
    playSpeed: number;
  }): TimelineTicker;
  ```

- [ ] **Step 1: Create the hook**

```ts
// src/modes/timeline/useTimelineTicker.ts
import { useCallback, useEffect, useRef } from 'react';
import { useMapStore } from '../../store/mapStore';
import { useAppModeStore } from '../../store/appModeStore';
import { dateToDayIndex, dayIndexToDate } from './timelineUtils';

/**
 * Map filter updates are throttled to ~12fps while the UI stays at 60fps.
 * Every setFilter drives a render cycle across 71 Protomaps vector layers, so
 * this ceiling is load-bearing on low-end devices — do not raise it casually.
 */
const TICK_THROTTLE_MS = 80;

export interface TimelineTicker {
  /** Throttled — for continuous updates (drag, playback) */
  dispatchTick: (date: string) => void;
  /**
   * Immediate — for exact final positions. Drops any pending throttled tick,
   * so callers never need to clear the throttle themselves.
   */
  flushTick: (date: string) => void;
}

interface TimelineTickerArgs {
  timelineMinDay: string;
  maxIndex: number;
  isPlaying: boolean;
  playSpeed: number;
}

/**
 * Owns the throttled tick dispatch and the RAF playback loop. They live together
 * because playback dispatches through the same throttle state that scrubbing does.
 */
export function useTimelineTicker({
  timelineMinDay,
  maxIndex,
  isPlaying,
  playSpeed,
}: TimelineTickerArgs): TimelineTicker {
  const tickCallback = useMapStore((s) => s._timelineTickCallback);

  const lastTickTimeRef = useRef(0);
  const pendingDateRef = useRef<string | null>(null);
  const flushTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const clearThrottle = useCallback(() => {
    pendingDateRef.current = null;
    if (flushTimerRef.current) {
      clearTimeout(flushTimerRef.current);
      flushTimerRef.current = null;
    }
  }, []);

  const dispatchTick = useCallback(
    (date: string) => {
      const now = performance.now();
      const elapsed = now - lastTickTimeRef.current;

      if (elapsed >= TICK_THROTTLE_MS) {
        // Enough time has passed — fire immediately
        lastTickTimeRef.current = now;
        clearThrottle();
        tickCallback?.(date);
        return;
      }

      // Too soon — store pending and schedule a flush
      pendingDateRef.current = date;
      if (!flushTimerRef.current) {
        flushTimerRef.current = setTimeout(() => {
          flushTimerRef.current = null;
          if (pendingDateRef.current) {
            lastTickTimeRef.current = performance.now();
            tickCallback?.(pendingDateRef.current);
            pendingDateRef.current = null;
          }
        }, TICK_THROTTLE_MS - elapsed);
      }
    },
    [tickCallback, clearThrottle]
  );

  const flushTick = useCallback(
    (date: string) => {
      clearThrottle();
      lastTickTimeRef.current = performance.now();
      tickCallback?.(date);
    },
    [tickCallback, clearThrottle]
  );

  useEffect(() => clearThrottle, [clearThrottle]);

  // Playback loop
  useEffect(() => {
    if (!isPlaying) return;

    const msPerTick = 1000 / playSpeed;
    let lastTickTime = -1; // -1 = uninitialized, set on first frame
    let rafId: number;

    const tick = (timestamp: number) => {
      // Initialize on first frame to avoid a giant elapsed delta
      if (lastTickTime < 0) {
        lastTickTime = timestamp;
        rafId = requestAnimationFrame(tick);
        return;
      }

      const elapsed = timestamp - lastTickTime;
      if (elapsed >= msPerTick) {
        // Allow multi-day jumps when frames are slow (e.g. tab backgrounded)
        const daysToAdvance = Math.floor(elapsed / msPerTick);
        // Accumulate rather than assign — preserves fractional remainder
        lastTickTime += daysToAdvance * msPerTick;

        const { timelineSettings, updateTimelineSettings } = useAppModeStore.getState();
        const current = dateToDayIndex(timelineSettings.currentDate, timelineMinDay);
        const nextIndex = Math.min(current + daysToAdvance, maxIndex);

        if (nextIndex >= maxIndex) {
          const finalDate = dayIndexToDate(maxIndex, timelineMinDay);
          updateTimelineSettings({ currentDate: finalDate, isPlaying: false });
          flushTick(finalDate);
          return;
        }

        const nextDate = dayIndexToDate(nextIndex, timelineMinDay);
        updateTimelineSettings({ currentDate: nextDate });
        dispatchTick(nextDate);
      }

      rafId = requestAnimationFrame(tick);
    };

    rafId = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(rafId);
  }, [isPlaying, playSpeed, timelineMinDay, maxIndex, dispatchTick, flushTick]);

  return { dispatchTick, flushTick };
}
```

`clearThrottle` stays private: `flushTick` clears the throttle itself, so no caller ever needs it.

- [ ] **Step 2: Use it in TimelineBar**

In `src/modes/timeline/TimelineBar.tsx`:

Delete the throttle block (lines 32-78: `TICK_THROTTLE_MS` through `clearThrottleState`), the flush-timer
cleanup in the unmount effect (lines 180-186 — keep the RAF cleanup, which moves to Task 7), and the
whole playback loop effect (lines 279-324).

Add the import:

```ts
import { useTimelineTicker } from './useTimelineTicker';
```

After `maxIndex` / `clampedIndex` are computed, add:

```ts
  const ticker = useTimelineTicker({ timelineMinDay, maxIndex, isPlaying, playSpeed });
  const { dispatchTick, flushTick } = ticker;
```

Keep `ticker` itself bound — Task 7 passes the whole object to `useTimelineScrubber`.

Then update the remaining call sites:
- in `applyIndex`: `throttledTickCallback(date)` → `dispatchTick(date)`
- in `onPointerUp`: `tickCallback?.(pendingDateRef.current)` → `flushTick(pendingDateRef.current)`, and delete the trailing `clearThrottleState()` (`flushTick` clears it)
- in `handlePlayPause`: `tickCallback?.(startDate); clearThrottleState();` → `flushTick(startDate);`

Remove the now-unused `tickCallback` selector (`const tickCallback = useMapStore(...)`) and the
`useMapStore` import — after these substitutions nothing else in `TimelineBar` reads either.

- [ ] **Step 3: Verify build and lint**

Run: `npm run build && npm run lint`
Expected: succeeds, no unused vars.

- [ ] **Step 4: Verify playback is unchanged**

Run `npm run dev`, open `/timeline`.
- Play: dots accumulate smoothly; the date advances at the shown rate.
- Cycle the speed button through 7/14/28/45 d/s while playing: rate changes, no stutter or double-speed.
- Let playback run to the end: it stops at the final date and the play button resets to Play.
- Press Play at the end: it restarts from Jan 2024 (the visible start).
- Switch to another tab for ~10s, come back: the timeline catches up rather than replaying every frame.

- [ ] **Step 5: Commit**

```bash
git add src/modes/timeline/useTimelineTicker.ts src/modes/timeline/TimelineBar.tsx
git commit -m "refactor: extract useTimelineTicker

Pulls the throttled tick dispatch and the RAF playback loop out of
TimelineBar. They belong together because playback dispatches through the
same throttle state scrubbing uses. Behavior is unchanged — the 80ms ceiling
still holds map filter updates to ~12fps while the UI runs at 60."
```

---

### Task 7: Extract `useTimelineScrubber` with pointer-cancel and keyboard support

Two bugs here: there is no `onPointerCancel`, so an interrupted touch leaves `isDraggingRef` stuck
`true` and the track then scrubs on hover without a press; and there is no keyboard path at all.

**Files:**
- Create: `src/modes/timeline/useTimelineScrubber.ts`
- Modify: `src/modes/timeline/TimelineBar.tsx`

**Interfaces:**
- Consumes: `TimelineTicker` from Task 6; `dayIndexToDate` from `timelineUtils`.
- Produces:
  ```ts
  function useTimelineScrubber(args: {
    trackRef: React.RefObject<HTMLDivElement>;
    timelineMinDay: string;
    visibleStartIndex: number;
    maxIndex: number;
    currentIndex: number;
    ticker: TimelineTicker;
  }): {
    onPointerDown: (e: React.PointerEvent) => void;
    onPointerMove: (e: React.PointerEvent) => void;
    onPointerUp: () => void;
    onPointerCancel: () => void;
    onLostPointerCapture: () => void;
    onKeyDown: (e: React.KeyboardEvent) => void;
  };
  ```

- [ ] **Step 1: Create the hook**

```ts
// src/modes/timeline/useTimelineScrubber.ts
import { useCallback, useEffect, useRef } from 'react';
import { useAppModeStore } from '../../store/appModeStore';
import { dayIndexToDate } from './timelineUtils';
import type { TimelineTicker } from './useTimelineTicker';

interface TimelineScrubberArgs {
  trackRef: React.RefObject<HTMLDivElement>;
  timelineMinDay: string;
  visibleStartIndex: number;
  maxIndex: number;
  currentIndex: number;
  ticker: TimelineTicker;
}

/** Days moved per arrow key press, and per shift+arrow. */
const STEP_DAY = 1;
const STEP_WEEK = 7;
const STEP_PAGE = 30;

/**
 * Pointer and keyboard input for the timeline scrubber.
 *
 * Pointer drags coalesce into one RAF so the map filter and React state land in
 * the same frame, which throttles 120Hz+ pointer streams to ~60fps.
 */
export function useTimelineScrubber({
  trackRef,
  timelineMinDay,
  visibleStartIndex,
  maxIndex,
  currentIndex,
  ticker,
}: TimelineScrubberArgs) {
  const { dispatchTick, flushTick } = ticker;

  const isDraggingRef = useRef(false);
  const pendingDateRef = useRef<string | null>(null);
  const rafRef = useRef(0);

  useEffect(() => {
    return () => {
      if (rafRef.current) cancelAnimationFrame(rafRef.current);
    };
  }, []);

  const indexFromPointer = useCallback(
    (clientX: number) => {
      const track = trackRef.current;
      if (!track) return visibleStartIndex;
      const rect = track.getBoundingClientRect();
      if (rect.width === 0) return visibleStartIndex;
      const ratio = Math.max(0, Math.min(1, (clientX - rect.left) / rect.width));
      return Math.round(visibleStartIndex + ratio * (maxIndex - visibleStartIndex));
    },
    [trackRef, visibleStartIndex, maxIndex]
  );

  const applyIndex = useCallback(
    (index: number) => {
      const clamped = Math.max(visibleStartIndex, Math.min(index, maxIndex));
      const newDate = dayIndexToDate(clamped, timelineMinDay);

      // Coalesce map filter + React state into a single RAF so both happen in
      // the same frame.
      pendingDateRef.current = newDate;
      if (!rafRef.current) {
        rafRef.current = requestAnimationFrame(() => {
          const date = pendingDateRef.current;
          if (date) {
            dispatchTick(date);
            useAppModeStore.getState().updateTimelineSettings({ currentDate: date });
            pendingDateRef.current = null;
          }
          rafRef.current = 0;
        });
      }
    },
    [timelineMinDay, visibleStartIndex, maxIndex, dispatchTick]
  );

  const pauseIfPlaying = useCallback(() => {
    const { timelineSettings, updateTimelineSettings } = useAppModeStore.getState();
    if (timelineSettings.isPlaying) updateTimelineSettings({ isPlaying: false });
  }, []);

  /**
   * Ends a drag from any terminal path — pointerup, pointercancel, or lost
   * capture. Without the cancel paths an interrupted touch left isDragging true
   * and the track kept scrubbing with no button held.
   */
  const endDrag = useCallback(() => {
    if (!isDraggingRef.current) return;
    isDraggingRef.current = false;

    // Cancel the pending RAF and flush synchronously so the final position is exact
    if (rafRef.current) {
      cancelAnimationFrame(rafRef.current);
      rafRef.current = 0;
    }
    if (pendingDateRef.current) {
      flushTick(pendingDateRef.current);
      useAppModeStore.getState().updateTimelineSettings({ currentDate: pendingDateRef.current });
      pendingDateRef.current = null;
    }
  }, [flushTick]);

  const onPointerDown = useCallback(
    (e: React.PointerEvent) => {
      isDraggingRef.current = true;
      (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
      applyIndex(indexFromPointer(e.clientX));
      pauseIfPlaying();
    },
    [applyIndex, indexFromPointer, pauseIfPlaying]
  );

  const onPointerMove = useCallback(
    (e: React.PointerEvent) => {
      if (!isDraggingRef.current) return;
      applyIndex(indexFromPointer(e.clientX));
    },
    [applyIndex, indexFromPointer]
  );

  const onKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      let next: number;
      switch (e.key) {
        case 'ArrowLeft':
        case 'ArrowDown':
          next = currentIndex - (e.shiftKey ? STEP_WEEK : STEP_DAY);
          break;
        case 'ArrowRight':
        case 'ArrowUp':
          next = currentIndex + (e.shiftKey ? STEP_WEEK : STEP_DAY);
          break;
        case 'PageDown':
          next = currentIndex - STEP_PAGE;
          break;
        case 'PageUp':
          next = currentIndex + STEP_PAGE;
          break;
        case 'Home':
          next = visibleStartIndex;
          break;
        case 'End':
          next = maxIndex;
          break;
        default:
          return;
      }
      e.preventDefault();
      pauseIfPlaying();
      applyIndex(next);
    },
    [currentIndex, visibleStartIndex, maxIndex, applyIndex, pauseIfPlaying]
  );

  return {
    onPointerDown,
    onPointerMove,
    onPointerUp: endDrag,
    onPointerCancel: endDrag,
    onLostPointerCapture: endDrag,
    onKeyDown,
  };
}
```

`endDrag` guards on `isDraggingRef`, so `onPointerUp` and `onLostPointerCapture` both firing is safe —
the second call is a no-op.

- [ ] **Step 2: Use it in TimelineBar**

In `src/modes/timeline/TimelineBar.tsx`, delete `indexFromPointer`, `applyIndex`, `onPointerDown`,
`onPointerMove`, `onPointerUp`, `isDraggingRef`, `pendingDateRef`, `rafRef`, and the RAF cleanup effect.

Add the import:

```ts
import { useTimelineScrubber } from './useTimelineScrubber';
```

Keep `trackRef` in TimelineBar and pass it in, after the ticker:

```ts
  const trackRef = useRef<HTMLDivElement>(null);
  const scrubber = useTimelineScrubber({
    trackRef,
    timelineMinDay,
    visibleStartIndex,
    maxIndex,
    currentIndex: clampedIndex,
    ticker,
  });
```

- [ ] **Step 3: Wire the handlers and ARIA onto the track**

Replace the track wrapper element with:

```tsx
      {/* Sparkline + Scrubber */}
      <div
        ref={trackRef}
        role="slider"
        tabIndex={0}
        aria-label="Timeline date"
        aria-valuemin={visibleStartIndex}
        aria-valuemax={maxIndex}
        aria-valuenow={clampedIndex}
        aria-valuetext={dateLabel}
        className="flex-1 h-8 lg:h-9 relative cursor-pointer rounded-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent/70"
        style={{ touchAction: 'none' }}
        onPointerDown={scrubber.onPointerDown}
        onPointerMove={scrubber.onPointerMove}
        onPointerUp={scrubber.onPointerUp}
        onPointerCancel={scrubber.onPointerCancel}
        onLostPointerCapture={scrubber.onLostPointerCapture}
        onKeyDown={scrubber.onKeyDown}
      >
        <TimelineSparkline path={sparklinePath} progressPercent={progressPercent} />

        {/* Scrubber handle */}
        <div
          className="absolute top-0 bottom-0 w-px bg-accent/80 pointer-events-none"
          style={{ left: `${progressPercent}%` }}
        >
          <div className="absolute -bottom-0.5 left-1/2 -translate-x-1/2 w-2.5 h-2.5 rounded-full bg-accent" />
        </div>
      </div>
```

`aria-valuenow` uses the day index because `role="slider"` requires a number; `aria-valuetext` gives
screen readers the human date.

- [ ] **Step 4: Verify build and lint**

Run: `npm run build && npm run lint`
Expected: succeeds.

- [ ] **Step 5: Verify pointer and keyboard**

Run `npm run dev`, open `/timeline`.
- **Pointer-cancel fix:** in DevTools device mode, start dragging the scrubber and drag off the top of
  the viewport, then release outside and move the cursor back over the track. The scrubber must **not**
  follow the cursor — it only moves while pressed. (Before this fix it stayed stuck in drag.)
- Drag normally: scrubbing is smooth; playback pauses on press.
- **Keyboard:** Tab to the track — a visible focus ring appears. `←`/`→` move one day, `Shift+←`/`→`
  seven, `PageUp`/`PageDown` thirty, `Home` jumps to Jan 2024, `End` to the latest date. Arrow keys must
  **not** scroll the page.
- Press play, then press an arrow key: playback pauses.

- [ ] **Step 6: Commit**

```bash
git add src/modes/timeline/useTimelineScrubber.ts src/modes/timeline/TimelineBar.tsx
git commit -m "fix: scrubber pointer-cancel and keyboard support

The track handled pointerdown/move/up but not pointercancel or lost capture,
so an interrupted touch — a system gesture, a drag off-viewport — left
isDragging stuck true and the track scrubbed on hover with nothing pressed.
All three terminal paths now end the drag.

Adds the keyboard path the scrubber never had: role=slider with arrow keys,
shift for a week, PageUp/Down for a month, and Home/End."
```

---

### Task 8: Responsive layout polish

**Files:**
- Modify: `src/modes/timeline/TimelineBar.tsx`, `src/pages/MapPage.tsx:533-541`

**Interfaces:**
- Consumes: everything from Tasks 5-7.

- [ ] **Step 1: Selective store subscriptions in TimelineBar**

`TimelineBar` subscribes to the whole camera store and the whole app-mode store, re-rendering on every
unrelated change. Replace the destructuring near the top of the component (the `tickCallback` selector
that sat alongside it was already removed in Task 6):

```ts
  const {
    cameras,
    timelineMinDay,
    timelineMaxDay,
    timelineDailyCounts,
    timelineWeeklyCounts,
    timelineMinWeek,
    timelineMaxWeek,
  } = useCameraStore();
  const { timelineSettings, updateTimelineSettings } = useAppModeStore();

  const { currentDate, isPlaying, playSpeed } = timelineSettings;
```

with:

```ts
  const cameraCount = useCameraStore((s) => s.cameras.length);
  const timelineMinDay = useCameraStore((s) => s.timelineMinDay);
  const timelineMaxDay = useCameraStore((s) => s.timelineMaxDay);
  const timelineDailyCounts = useCameraStore((s) => s.timelineDailyCounts);
  const timelineWeeklyCounts = useCameraStore((s) => s.timelineWeeklyCounts);
  const timelineMinWeek = useCameraStore((s) => s.timelineMinWeek);
  const timelineMaxWeek = useCameraStore((s) => s.timelineMaxWeek);

  const currentDate = useAppModeStore((s) => s.timelineSettings.currentDate);
  const isPlaying = useAppModeStore((s) => s.timelineSettings.isPlaying);
  const playSpeed = useAppModeStore((s) => s.timelineSettings.playSpeed);
  const updateTimelineSettings = useAppModeStore((s) => s.updateTimelineSettings);
```

In `cumulativeCount`, `cameras.length` becomes `cameraCount`, and its dep array uses `cameraCount`.

- [ ] **Step 2: Touch targets on the play button**

Replace the play/pause button's className:

```tsx
        className="flex-shrink-0 flex items-center justify-center w-11 h-11 lg:w-8 lg:h-8 rounded-full bg-white/10 hover:bg-white/15 active:bg-white/20 transition-colors"
```

44px on touch (the WCAG minimum), unchanged at 32px on desktop.

- [ ] **Step 3: Responsive date label**

Replace the date/count span:

```tsx
      {/* Date · count — fixed width to prevent shifting as the date changes */}
      <span className="flex-shrink-0 text-[11px] sm:text-xs lg:text-sm text-white/90 tabular-nums font-mono tracking-tight whitespace-nowrap w-[84px] sm:w-[92px] lg:w-[180px] text-right">
        {dateLabel}
        <span className="hidden lg:inline text-white/30"> · {cumulativeCount.toLocaleString()}</span>
      </span>
```

- [ ] **Step 4: Safe-area inset on the mobile bar**

In `src/pages/MapPage.tsx`, replace the timeline bar wrapper (lines 534-541):

```tsx
            {isExploreMode && (
              <div className={isMobile
                ? "timeline-bar-mobile fixed left-3 right-3 z-[51] h-12 bg-dark-900/70 backdrop-blur-xl rounded-xl border border-white/[0.06] shadow-lg shadow-black/30"
                : "timeline-bar-desktop absolute bottom-4 left-4 right-20 z-20 h-14 bg-dark-900/70 backdrop-blur-xl rounded-xl border border-white/[0.06] shadow-lg shadow-black/30"
              }
              // 84px clears the BottomSheet's minimized height; the inset keeps the
              // bar off the iOS home indicator on notched phones.
              style={isMobile ? { bottom: 'calc(84px + env(safe-area-inset-bottom))' } : undefined}
              >
                <TimelineBar />
              </div>
            )}
```

`bottom-[84px]` moves out of the class list because the `calc()` needs `env()`, which Tailwind's
arbitrary values handle poorly here.

- [ ] **Step 5: Verify build and lint**

Run: `npm run build && npm run lint`
Expected: succeeds.

- [ ] **Step 6: Full responsive sweep**

Run `npm run dev`, open `/timeline`. In DevTools device toolbar check **320, 375, 414, 768, 1024, 1440**
plus **iPhone 14 Pro** (notched) and **iPad**:
- The bar never overflows its container; the date label never wraps or clips.
- The play button is comfortably tappable at every mobile width.
- On the notched profile the bar sits above the home indicator, not under it.
- At ≥1024 the count (`· 114,231`) and the `45d/s` speed button appear; below that they are hidden.
- `?embed=1` at 400px: mobile layout, bar positioned correctly.
- Rotate portrait ↔ landscape: the layout switches cleanly with no stuck state.

- [ ] **Step 7: Commit**

```bash
git add src/modes/timeline/TimelineBar.tsx src/pages/MapPage.tsx
git commit -m "fix: timeline bar responsive layout and touch targets

Play button was 32px, below the 44px touch minimum. The mobile bar's
bottom-[84px] ignored env(safe-area-inset-bottom), so it could sit under the
iOS home indicator. The date label had no room to breathe under 375px.

TimelineBar also subscribed to two whole stores, re-rendering on every
unrelated change; it now selects only the fields it reads."
```

---

### Task 9: Final verification

**Files:** none — verification only.

- [ ] **Step 1: Clean build and lint**

```bash
npm run build && npm run lint
```
Expected: both succeed with no errors.

- [ ] **Step 2: Confirm dead code is gone**

```bash
grep -rn "showMarkers" src/ | grep -i dot
grep -rn "prevSettingsRef\|barsRef\|prevBpRef\|SliderControl" src/modes/timeline/ src/modes/dots/ src/components/map/layers/DotDensityLayers.tsx
grep -rn "2024-07-01\|2024-01-01" src/
```
Expected: first two produce **no output**; the third produces exactly the two definitions in
`src/modes/timeline/timelineUtils.ts`.

- [ ] **Step 3: Confirm the scoped-out work was left alone**

```bash
git diff --stat master...HEAD -- src/modes/heatmap/ src/components/map/layers/HeatmapLayers.tsx
```
Expected: **no output** — the heatmap's own z13 filter bug is deliberately untouched.
(The default branch is `master`, not `main`.)

Also confirm the pre-existing uncommitted edits to `CameraMarkerLayers.tsx` and `CameraTileLayers.tsx`
were never committed by this work:

```bash
git status --short
```
Expected: both files still listed as ` M` (modified, uncommitted).

- [ ] **Step 4: Full acceptance pass**

Run `npm run dev` and confirm the three original complaints:
1. **No metadata layer:** `/timeline` at z16 — dots only, no points, no cones, no popup on click.
2. **Dots stay a good size:** zoom z4 → z18, dots scale smoothly with no dead zone and no pop.
3. **Responsive:** the bar and sparkline are clean at 320-1440, in embed, and on a notched phone.

Then confirm no regressions: `/route` and `/` still show markers, cones, and popups; `/timeline` +
Heatmap still shows its markers past z13; `/analysis` and `/network` are unaffected.

- [ ] **Step 5: Report**

Summarize what was verified and anything that behaved unexpectedly. Flag in particular:
- the intentional embed behavior change (narrow embeds now get the mobile layout),
- the two deferred issues from the spec's Known Issues (heatmap z13 filter bug; stale
  `'2026-02-15'` placeholder in `cameraStore.ts:169-174`).

---

## Notes for the implementer

- **`_timelineTickCallback`** is registered by `MapLibreContainer` into `mapStore` and read by the
  ticker. It is `null` until the map is ready, so every call site uses `?.` — keep that.
- **`filteredCameras` vs `cameras`:** with no filters active these are the *same reference*, which is
  why `cameraSource` is derived outside the memo. Do not inline it — doing so recomputes a
  114k-feature GeoJSON on tab switches.
- **Task 3 is the highest-value change.** If time is short, it alone fixes the correctness bug and the
  worst of the performance problem.
- The dot curve anchors in Task 4 are a starting point tuned from the existing layer values. If z13-z14
  reads too heavy in a dense metro, lower the `13` and `14` radius anchors before touching the opacity
  curve — size is the more visually dominant of the two.
