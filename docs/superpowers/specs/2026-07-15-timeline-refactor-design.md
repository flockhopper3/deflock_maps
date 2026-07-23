# Timeline Refactor — Design

**Date:** 2026-07-15
**Status:** Approved
**Scope:** Timeline mode (`appMode === 'explore'` + `mapVisualization === 'dots'`)

## Problem

The Timeline page is unreliable across devices and visually breaks down when zoomed in.

Three root causes, found by reading the current implementation:

### 1. The zoom≥13 marker layer is unwanted *and* buggy

`MapLibreContainer.tsx:240-245` force-enables `CameraMarkerLayers` in Timeline whenever
`zoom >= 13`, painting points, glow halos, and direction cones over the dots, and making
each camera clickable for a metadata popup.

`handleTimelineTick` (`MapLibreContainer.tsx:361-363`) decides whether to date-filter those
marker layers by reading **only** `dotDensitySettings.showMarkers` — it never accounts for
the `zoom >= 13` auto-show. So past z13 during playback the markers and cones render
**completely unfiltered**: every camera appears regardless of the current date, while the
dots beneath them stay correctly filtered. Scrubbing looks broken at high zoom.

### 2. Timeline builds two large sources it never uses

`CameraMarkerLayers` is **always mounted** (`MapLibreContainer.tsx:1068`); its `visible` prop
only toggles MapLibre layout visibility. Its `geojsonData` and `directionConesData` memos
build regardless of `visible`, gated only on `showCameraLayer`.

Timeline therefore builds and uploads three sources on every device:

| Source | Contents | Needed by Timeline? |
|---|---|---|
| `cameras-dots` | 114k points, 1 property | Yes — this *is* the timeline |
| `cameras` | 114k points × 13 properties | No |
| `direction-cones` | One polygon per directional camera | No |

Two thirds of that work feeds a layer that is invisible below z13 and is being removed.
This is the primary suspect for poor performance on low-end devices.

### 3. Dots do not scale with zoom

`dot-density-layer` uses a flat `circle-radius: dotDensitySettings.radius` (default 2px) with
no zoom interpolation — the only camera layer in the codebase that doesn't use an
`interpolate ['zoom']` expression. At z16 you get the same 2px dot you had at z4.

### Responsive faults

- Two independent `isMobile` states (`MapPage.tsx:98`, `ExplorePanel.tsx:11`) duplicate the
  same 1024px listener. MapPage's returns early in embed mode (`if (isEmbed) return`), so a
  narrow embed is frozen into the desktop layout positioned `right-20`.
- The sparkline packs ~130 weekly bars into `flex-1 gap-px`. On a 360px phone each bar lands
  under 1px and aliases away.
- No `onPointerCancel` — an interrupted touch leaves `isDraggingRef` stuck `true`, so the
  track scrubs without a press.
- Play button is 32px (`w-8 h-8`), below the 44px touch-target minimum.
- Mobile bar's `bottom-[84px]` is a magic number tied to `BottomSheet`'s `minimizedHeight`,
  and ignores `env(safe-area-inset-bottom)` — it can collide with the iOS home indicator.
- No keyboard path at all: no `role="slider"`, no arrow keys.

## Decisions

| Decision | Choice | Rationale |
|---|---|---|
| Marker removal scope | Timeline only | Route/Map keep markers, cones, popups. Explore-heatmap keeps its marker affordance. |
| Dot sizing | Tuned zoom curve, no slider | One perfected look; nothing left to drag out of tune. |
| Dot opacity | Tuned with size as one coupled curve | Opacity is what makes size read; perfecting one and leaving the other configurable is incoherent. |
| Dot color | Keep the swatches | Pure preference, can't break the visualization, cheap to keep. |
| Sparkline | SVG area chart | Resolution-independent — the sub-pixel problem stops existing rather than being worked around. |
| Heatmap z13 filter bug | **Out of scope** | Same bug class one branch over, explicitly deferred. See Known Issues. |

## Design

### 1. Remove the marker layer from Timeline

In `MapLibreContainer.tsx`, drop the dots branch from `showCameraMarkers`:

```ts
const showCameraMarkers = !isNetworkMode && !isDensityMode && !isMapModeHeatmap && (
  appMode === 'route'
  || isMapMode
  || (isHeatmapMode && (heatmapSettings.showMarkers || zoom >= 13))
  // dots branch removed — Timeline is dots-only at every zoom
);
```

Gate the mount so the unused sources are never built:

```tsx
{!isDotsMode && (
  <CameraMarkerLayers cameras={cameraSource} visible={!isTilesMode && showCameraMarkers} … />
)}
```

This mirrors the existing `{isDotsMode && <DotDensityLayers />}` pattern, so conditional
source mounting is already proven in this component.

Consequences:
- `dotDensitySettings.showMarkers` becomes dead → removed from the store.
- `markersVisible` in `handleTimelineTick` simplifies to
  `!isExplore || (isHeatmap && heatmapSettings.showMarkers)`.
- The unfiltered-markers-at-z13 bug disappears by construction — the layer no longer exists
  in Timeline.

**Load-order note:** in Timeline, `needsGeojson` is true, so `isTilesMode` is true only until
the dataset hydrates. With the dots branch gone, `showCameraMarkers` is false in Timeline, so
`CameraTileLayers` is also hidden there. No cameras render pre-hydration — which is correct,
because `MapLoadingScreen` covers the map until `isFullyReady` (which requires
`camerasReady`), and Timeline autoplay is already gated on the same flag.

### 2. Dot layer: one tuned curve

`DotDensityLayers.tsx` becomes a static paint spec:

```ts
'circle-radius': ['interpolate', ['linear'], ['zoom'],
  0, 1.5,  4, 2,  10, 3,  13, 4.8,  14, 6,  16, 9,  18, 12],
'circle-opacity': ['interpolate', ['linear'], ['zoom'],
  4, 0.25,  11, 0.25,  13, 0.55,  15, 0.9],
```

Through z11 this reproduces today's 2–3px at 25%, preserving the stacking accumulation that
makes dot density legible at low zoom. From z13 dots grow and solidify; by z15 a 9px
near-solid dot reads as an individual camera. That is deliberately the job the removed marker
layer was doing.

Linear interpolation between hand-tuned anchors (rather than an exponential base) keeps the
curve predictable and directly tunable — the anchors *are* the design.

The `setPaintProperty` effect and `prevSettingsRef` (`DotDensityLayers.tsx:66-89`) are
deleted. They existed only to push slider changes into the layer. Color is the sole remaining
variable and changes on a rare click, so react-map-gl's declarative paint diffing handles it.

Store (`appModeStore.ts`):

```ts
export interface DotDensitySettings { color: string; }
const DEFAULT_DOT_DENSITY_SETTINGS: DotDensitySettings = { color: '#4DA6FF' };
```

`DotDensityControls.tsx` loses `SliderControl` and both sliders, keeping the color grid and
the About card. The About copy must be rewritten — it currently ends with "Lower the opacity
for stronger contrast between sparse and dense areas," which will no longer be possible.

### 3. TimelineBar decomposition

`TimelineBar.tsx` is ~400 lines doing throttling, sparkline math, scrubbing, playback, and
layout. Split into focused units:

| File | Responsibility |
|---|---|
| `modes/timeline/TimelineSparkline.tsx` | SVG area chart — memoized `d` paths + clip rect for progress |
| `modes/timeline/useTimelineTicker.ts` | Throttled tick dispatch + RAF playback loop (they share throttle state) |
| `modes/timeline/useTimelineScrubber.ts` | Pointer + keyboard → day index |
| `modes/timeline/TimelineBar.tsx` | Composition and layout |
| `hooks/useIsMobile.ts` | Single breakpoint source of truth |

**Sparkline rendering:**

```tsx
<svg viewBox="0 0 1000 100" preserveAspectRatio="none">
  <defs><clipPath id="progress"><rect width={pct * 10} height={100} /></clipPath></defs>
  <path d={areaPath} className="dim" />
  <path d={areaPath} className="accent" clipPath="url(#progress)" />
</svg>
```

The cumulative data doesn't change during playback, so `areaPath` is memoized and React diffs
both paths as identical — only the clip rect's `width` is written to the DOM per tick. This
matches the performance of today's imperative `barsRef`/`prevBpRef`/`useLayoutEffect` hack
while deleting it. ~130 DOM nodes → 2 paths.

`buildSparklinePath(bars, peak)` goes in `timelineUtils.ts` alongside the existing date
helpers.

The RAF coalescing and `TICK_THROTTLE_MS` machinery is load-bearing for playback performance
and is preserved as-is, relocated into `useTimelineTicker`.

`TimelineBar` currently subscribes to the whole store via `useAppModeStore()`, re-rendering on
every unrelated store change. Switch to selective selectors.

### 4. Responsive + correctness fixes

- **`useIsMobile`** replaces both duplicate listeners and drops the `if (isEmbed) return`
  early-return that froze narrow embeds into the desktop layout.
- **`onPointerCancel` + `onLostPointerCapture`** clear `isDraggingRef`, fixing stuck drags.
- **Touch targets:** play button `w-11 h-11 lg:w-8 lg:h-8`; larger scrubber handle.
- **Safe area:** `bottom-[calc(84px+env(safe-area-inset-bottom))]`.
- **Keyboard/ARIA:** `role="slider"` with `aria-valuenow`/`valuemin`/`valuemax`/`valuetext`;
  arrow keys ±1 day, shift+arrow ±7, Home/End to jump.
- **`TIMELINE_START`** consolidates the three copies of `'2024-07-01'` (`appModeStore.ts:82`,
  `MapPage.tsx:119`, `MapPage.tsx:153`) into one exported constant, alongside `VISIBLE_START`.

## Files

**New:** `hooks/useIsMobile.ts`, `modes/timeline/TimelineSparkline.tsx`,
`modes/timeline/useTimelineTicker.ts`, `modes/timeline/useTimelineScrubber.ts`

**Modified:** `MapLibreContainer.tsx`, `layers/DotDensityLayers.tsx`,
`modes/dots/DotDensityControls.tsx`, `store/appModeStore.ts`,
`modes/timeline/TimelineBar.tsx`, `modes/timeline/timelineUtils.ts`, `pages/MapPage.tsx`,
`components/panels/ExplorePanel.tsx`

## Verification

No test infrastructure exists in this repo, so verification is by driving the real app.

1. `npm run dev`
2. **Dot curve:** Timeline at z4 / z10 / z13 / z16 — dots scale smoothly, no size jump.
3. **The z13 bug:** scrub the date at z16 — dots filter by date; no unfiltered markers or
   cones appear. Confirm no camera popup on click in Timeline.
4. **Regression:** Route and Map modes still show markers, cones, and popups. Explore-heatmap
   still shows its markers.
5. **Responsive:** 320 / 375 / 768 / 1024 / 1440 widths, plus embed mode at narrow width.
   Sparkline renders cleanly at every width.
6. **Touch:** interrupted drag doesn't leave the scrubber stuck.
7. **Keyboard:** tab to scrubber, arrows scrub, Home/End jump.
8. `npm run build` && `npm run lint`

## Known Issues (deferred)

- **Heatmap z13 filter bug:** `showCameraMarkers` fires on `zoom >= 13` for the heatmap path,
  but `markersVisible` in `handleTimelineTick` only checks `heatmapSettings.showMarkers` —
  the same unfiltered-markers bug this spec fixes for Timeline. Explicitly out of scope.
  A fix would read `map.getZoom()` imperatively (keeping the callback stable) and reset
  `lastCutoffRef` when marker visibility changes.
- **Stale timeline placeholders:** `cameraStore.ts:169-174` defaults `timelineMaxDay` to
  `'2026-02-15'`, now in the past. Not a crash (the strings parse fine, and the loading screen
  covers the map until hydration), but the values are stale.
